import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TagChip } from "@/components/TagChip";
import { Activity, BellRing, Database, ScanSearch, Sparkles, TrendingUp, Radio, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveLogs, useLiveMetrics, useRealtime } from "@/hooks/use-realtime";
import type { Severity } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Splunk KnowBot" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const logs = useQuery({ queryKey: ["logs"], queryFn: () => api.searchLogs({ limit: 500 }) });
  const kos = useQuery({ queryKey: ["kos"], queryFn: api.listKnowledgeObjects });
  const activity = useQuery({ queryKey: ["activity"], queryFn: api.listActivity });
  const liveLogs = useLiveLogs(8);
  const metrics = useLiveMetrics();
  const [liveAlerts, setLiveAlerts] = useState<{ id: string; name: string; severity: Severity; at: string }[]>([]);
  useRealtime(e => {
    if (e.type === "alert") setLiveAlerts(p => [e.data, ...p].slice(0, 5));
    if (e.type === "log") {
      // periodically refresh aggregates
      if (Math.random() < 0.15) qc.invalidateQueries({ queryKey: ["logs"] });
    }
  });
  useEffect(() => { const t = setInterval(() => qc.invalidateQueries({ queryKey: ["activity"] }), 8000); return () => clearInterval(t); }, [qc]);

  // build timeline
  const timeline = (() => {
    const map = new Map<string, number>();
    for (const l of logs.data || []) {
      const d = new Date(l.timestamp); d.setMinutes(0, 0, 0);
      const k = d.toISOString();
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].sort().slice(-24).map(([t, c]) => ({ t: new Date(t).getHours() + ":00", c }));
  })();

  const sevCounts = (() => {
    const m: Record<string, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
    for (const l of logs.data || []) m[l.severity]++;
    return Object.entries(m).map(([k, v]) => ({ k, v }));
  })();

  const topTags = (tags.data || []).slice().sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <div className="p-6 space-y-6 bg-grid">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Operations</div>
          <h1 className="text-2xl font-semibold">Mission Control</h1>
        </div>
        <Link to="/log-explorer" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          <ScanSearch className="size-4" /> Open Log Explorer
        </Link>
      </header>

      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-4 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0 text-sm">
          <Radio className="size-4 text-success animate-pulse" />
          <span className="font-medium">Live stream</span>
          <span className="text-muted-foreground tabular-nums">{metrics.eps} EPS · {metrics.errorRate}% errors</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <AnimatePresence initial={false}>
            <div className="flex gap-2 text-xs font-mono">
              {liveLogs.slice(0, 4).map(l => (
                <motion.span key={l.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className={`shrink-0 truncate max-w-xs rounded px-2 py-0.5 ${l.severity === "critical" ? "bg-destructive/15 text-destructive" : l.severity === "high" ? "bg-orange-500/15 text-orange-300" : "bg-muted/40 text-muted-foreground"}`}>
                  {l.host} · {l.message.slice(0, 60)}
                </motion.span>
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={ScanSearch} label="Events ingested" value={(logs.data?.length || 0).toLocaleString()} delta={`+${metrics.eps}/sec live`} />
        <Stat icon={Sparkles} label="Tags in repository" value={(tags.data?.length || 0).toString()} delta={`${(tags.data?.filter(t => t.custom).length || 0)} custom`} />
        <Stat icon={Database} label="Knowledge objects" value={(kos.data?.length || 0).toString()} delta="ready to deploy" />
        <Stat icon={BellRing} label="Active alerts" value={(kos.data?.filter(k => k.type === "alert").length || 0).toString()} delta={`${liveAlerts.length} live`} />
      </div>

      <AnimatePresence>
        {liveAlerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-1">
            <div className="text-xs uppercase text-destructive flex items-center gap-1.5"><AlertTriangle className="size-3.5" /> Live alerts</div>
            {liveAlerts.map(a => (
              <div key={a.id} className="text-sm flex items-center justify-between">
                <span><span className={`inline-block size-1.5 rounded-full mr-2 ${a.severity === "critical" ? "bg-destructive" : "bg-orange-400"}`} />{a.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{new Date(a.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Event volume — last 24 hours</div>
            <TrendingUp className="size-4 text-primary" />
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.18 165)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.78 0.18 165)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="c" stroke="oklch(0.78 0.18 165)" fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium mb-2">By severity</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={sevCounts}>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis dataKey="k" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="v" fill="oklch(0.65 0.20 260)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Top tags</div>
            <Link to="/tags" className="text-xs text-primary hover:underline">Manage tags →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {topTags.map(t => (
              <Link key={t.id} to="/log-explorer" search={{ tag: t.id } as any}>
                <TagChip tag={t} />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Recent activity</div>
            <Activity className="size-4 text-muted-foreground" />
          </div>
          <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {(activity.data || []).slice(0, 12).map(a => (
              <li key={a.id} className="text-xs flex items-center justify-between border-b border-border/50 pb-1.5">
                <span><span className="text-primary">{a.actor}</span> <span className="text-muted-foreground">{a.action}</span> <span className="font-medium">{a.target}</span></span>
                <span className="text-muted-foreground tabular-nums">{new Date(a.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, delta }: { icon: any; label: string; value: string; delta: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{delta}</div>
    </motion.div>
  );
}
