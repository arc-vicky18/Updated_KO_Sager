import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Severity, Tag } from "@/lib/types";
import { TagChip, SeverityDot } from "@/components/TagChip";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { ScanSearch, X, Wand2, BellRing, BarChart3, Database, Crosshair, Shield, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type Search = { tag?: string; q?: string; severity?: Severity };
export const Route = createFileRoute("/log-explorer")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tag: typeof s.tag === "string" ? s.tag : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    severity: ["info","low","medium","high","critical"].includes(s.severity as string) ? s.severity as Severity : undefined,
  }),
  head: () => ({ meta: [{ title: "Log Explorer — Splunk KnowBot" }] }),
  component: LogExplorer,
});

function LogExplorer() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState(search.q ?? "");
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const logs = useQuery({
    queryKey: ["logs", search.q, search.tag, search.severity],
    queryFn: () => api.searchLogs({ q: search.q, tag: search.tag, severity: search.severity, limit: 300 }),
  });
  const drill = useQuery({
    queryKey: ["drill", search.tag],
    queryFn: () => api.tagDrilldown(search.tag!),
    enabled: !!search.tag,
  });

  const setSearch = (patch: Partial<Search>) => navigate({ search: (prev: Search) => ({ ...prev, ...patch }) });

  const tagMap = useMemo(() => Object.fromEntries((tags.data || []).map(t => [t.id, t])), [tags.data]);

  return (
    <div className="flex h-full min-h-screen">
      <div className={`flex-1 min-w-0 flex flex-col ${search.tag ? "border-r border-border" : ""}`}>
        <header className="px-6 py-4 border-b border-border bg-card/40 backdrop-blur">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Tag Intelligence</div>
          <div className="flex items-center justify-between gap-4 mt-1">
            <h1 className="text-2xl font-semibold">Log Explorer</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              {logs.data?.length ?? 0} events
            </div>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch({ q: query || undefined }); }}
            className="mt-3 flex items-center gap-2"
          >
            <div className="flex-1 flex items-center gap-2 rounded-md border border-input bg-input px-3 py-2">
              <ScanSearch className="size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search SPL-style (e.g. "failed password", "powershell", host=web-01)…'
                className="flex-1 bg-transparent outline-none text-sm font-mono"
              />
              {search.q && (
                <button type="button" onClick={() => { setQuery(""); setSearch({ q: undefined }); }} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
              )}
            </div>
            <select
              value={search.severity ?? ""}
              onChange={(e) => setSearch({ severity: (e.target.value || undefined) as any })}
              className="rounded-md border border-input bg-input px-2 py-2 text-sm"
            >
              <option value="">All severity</option>
              {(["critical","high","medium","low","info"] as Severity[]).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Run</button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(tags.data || []).slice(0, 14).map(t => (
              <TagChip key={t.id} tag={t} selected={search.tag === t.id} onClick={() => setSearch({ tag: search.tag === t.id ? undefined : t.id })} />
            ))}
            <Link to="/tags" className="text-xs text-primary px-2 py-0.5 self-center hover:underline">+ all tags</Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card/80 backdrop-blur text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium w-44">Time</th>
                <th className="px-2 py-2 font-medium w-8">Sev</th>
                <th className="px-2 py-2 font-medium w-28">Host</th>
                <th className="px-2 py-2 font-medium w-24">User</th>
                <th className="px-2 py-2 font-medium">Message</th>
                <th className="px-4 py-2 font-medium w-64">Tags</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(logs.data || []).map(l => (
                <tr key={l.id} className="border-t border-border/50 hover:bg-card/60">
                  <td className="px-4 py-1.5 text-muted-foreground tabular-nums">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="px-2 py-1.5"><SeverityDot s={l.severity} /></td>
                  <td className="px-2 py-1.5">{l.host}</td>
                  <td className="px-2 py-1.5 text-accent">{l.user || "—"}</td>
                  <td className="px-2 py-1.5 truncate max-w-[40ch]">{l.message}</td>
                  <td className="px-4 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {l.tags.map(id => tagMap[id] && (
                        <TagChip key={id} tag={tagMap[id] as Tag} onClick={() => setSearch({ tag: id })} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!logs.isLoading && (logs.data || []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No events match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {search.tag && (
          <motion.aside
            key={search.tag}
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            className="w-[460px] shrink-0 overflow-y-auto bg-card/40"
          >
            <DrillPanel tagId={search.tag} onClose={() => setSearch({ tag: undefined })} drill={drill.data} loading={drill.isLoading} />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

function DrillPanel({ tagId, drill, loading, onClose }: { tagId: string; drill: any; loading: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const generate = useMutation({
    mutationFn: async (mode: "alert" | "dashboard" | "spl" | "regex") => {
      const ko = await api.aiGenerate({ prompt: drill?.tag?.name || "", mode, tagId });
      if (mode === "alert") {
        const parsed = JSON.parse(ko.output);
        await api.createKnowledgeObject({ type: "alert", name: parsed.name, description: `Auto-generated from tag ${drill.tag.name}`, spl: parsed.spl, config: parsed, tags: [tagId], favorite: false, draft: false });
      } else if (mode === "dashboard") {
        const parsed = JSON.parse(ko.output);
        await api.createKnowledgeObject({ type: "dashboard", name: parsed.title, description: `Auto-generated from tag ${drill.tag.name}`, config: parsed, tags: [tagId], favorite: false, draft: false });
      }
      return ko;
    },
    onSuccess: (_data, mode) => {
      qc.invalidateQueries({ queryKey: ["kos"] });
      toast.success(`${mode.toUpperCase()} generated and saved to repository`);
    },
  });

  if (loading || !drill) return <div className="p-6 text-sm text-muted-foreground">Loading drilldown…</div>;
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Tag Drilldown</div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: drill.tag.color }} />{drill.tag.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{drill.tag.description}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Mini label="Threat score" value={String(drill.threatScore)} accent />
        <Mini label="Events" value={String(drill.events.length)} />
        <Mini label="Severity" value={drill.tag.severity} />
      </div>

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="text-xs text-muted-foreground mb-2">Frequency</div>
        <div className="h-24">
          <ResponsiveContainer>
            <AreaChart data={drill.timeline}>
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={drill.tag.color} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={drill.tag.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide /><YAxis hide />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} labelFormatter={(v) => new Date(v).toLocaleString()} />
              <Area type="monotone" dataKey="count" stroke={drill.tag.color} fill="url(#dg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ListBox title="Top hosts" items={drill.hosts.slice(0, 6).map((h: any) => [h.host, h.count])} />
        <ListBox title="Top users" items={drill.users.slice(0, 6).map((u: any) => [u.user, u.count])} />
      </div>

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted-foreground">Auto-generated SPL</div>
          <button
            onClick={async () => { await navigator.clipboard.writeText(drill.spl); setCopied(true); setTimeout(() => setCopied(false), 1200); toast.success("SPL copied"); }}
            className="text-xs text-primary inline-flex items-center gap-1"
          >{copied ? <Check className="size-3" /> : <Copy className="size-3" />} Copy</button>
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap text-primary">{drill.spl}</pre>
      </div>

      <div>
        <div className="text-xs text-muted-foreground mb-2">Generate from this tag</div>
        <div className="grid grid-cols-2 gap-2">
          <ActionBtn icon={BellRing} label="Generate Alert" onClick={() => generate.mutate("alert")} loading={generate.isPending && generate.variables === "alert"} />
          <ActionBtn icon={BarChart3} label="Generate Dashboard" onClick={() => generate.mutate("dashboard")} loading={generate.isPending && generate.variables === "dashboard"} />
          <ActionBtn icon={Wand2} label="Generate SPL" onClick={() => generate.mutate("spl")} loading={generate.isPending && generate.variables === "spl"} />
          <ActionBtn icon={Crosshair} label="Generate Regex" onClick={() => generate.mutate("regex")} loading={generate.isPending && generate.variables === "regex"} />
        </div>
      </div>

      {drill.mitre.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Shield className="size-3" /> MITRE ATT&CK</div>
          <div className="flex flex-wrap gap-1.5">
            {drill.mitre.map((m: any) => (
              <span key={m.id} className="text-[11px] rounded border border-accent/40 bg-accent/10 text-accent px-2 py-0.5">{m.id} · {m.tactic}</span>
            ))}
          </div>
        </div>
      )}

      {drill.iocs.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-xs text-muted-foreground mb-2">Indicators of Compromise</div>
          <ul className="text-xs font-mono space-y-1">
            {drill.iocs.map((i: any, idx: number) => (
              <li key={idx} className="flex items-center justify-between">
                <span>{i.type}: <span className="text-primary">{i.value}</span></span>
                <span className="text-muted-foreground">score {i.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="text-xs text-muted-foreground mb-2">Recommended dashboards</div>
        <div className="flex flex-col gap-1">
          {drill.recommendedDashboards.map((d: any) => (
            <Link key={d.id} to="/repository" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Database className="size-3" /> {d.name}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-background"}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
function ListBox({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground mb-1.5">{title}</div>
      <ul className="text-xs space-y-1">
        {items.map(([k, v]) => (
          <li key={k} className="flex justify-between"><span className="font-mono truncate">{k}</span><span className="text-muted-foreground tabular-nums">{v}</span></li>
        ))}
        {items.length === 0 && <li className="text-muted-foreground text-[11px]">none</li>}
      </ul>
    </div>
  );
}
function ActionBtn({ icon: Icon, label, onClick, loading }: { icon: any; label: string; onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} className="flex items-center gap-2 rounded-md border border-border bg-background hover:border-primary hover:bg-primary/5 px-3 py-2 text-xs disabled:opacity-50">
      <Icon className="size-3.5 text-primary" /> {loading ? "Generating…" : label}
    </button>
  );
}
