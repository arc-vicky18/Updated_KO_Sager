import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Hunt } from "@/lib/types";
import { Telescope, Play, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/threat-hunting")({
  head: () => ({ meta: [{ title: "Threat Hunting — Splunk KnowBot" }] }),
  component: ThreatHunting,
});

function ThreatHunting() {
  const qc = useQueryClient();
  const hunts = useQuery({ queryKey: ["hunts"], queryFn: api.listHunts });
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const [sel, setSel] = useState<string | null>(null);
  const [results, setResults] = useState<{ matched: any[] } | null>(null);
  const [draft, setDraft] = useState({ name: "", hypothesis: "", spl: "", mitre: "", tagIds: [] as string[] });

  const create = useMutation({
    mutationFn: () => api.createHunt({ ...draft, mitre: draft.mitre.split(",").map(s => s.trim()).filter(Boolean), tagIds: draft.tagIds, status: "draft" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hunts"] }); setDraft({ name: "", hypothesis: "", spl: "", mitre: "", tagIds: [] }); },
  });
  const run = useMutation({ mutationFn: (id: string) => api.runHunt(id), onSuccess: r => { setResults(r); qc.invalidateQueries({ queryKey: ["hunts"] }); } });
  const del = useMutation({ mutationFn: (id: string) => api.deleteHunt(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["hunts"] }) });
  const update = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<Hunt> }) => api.updateHunt(id, patch), onSuccess: () => qc.invalidateQueries({ queryKey: ["hunts"] }) });

  const active = hunts.data?.find(h => h.id === sel);

  return (
    <div className="p-6 grid grid-cols-12 gap-4 bg-grid min-h-screen">
      <header className="col-span-12 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Phase 2</div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Telescope className="size-6 text-primary" /> Threat Hunting</h1>
        </div>
      </header>

      <aside className="col-span-3 rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase">Hunts</div>
        {(hunts.data || []).map(h => (
          <button key={h.id} onClick={() => { setSel(h.id); setResults(null); }} className={`w-full text-left rounded-md border px-3 py-2 transition ${sel === h.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
            <div className="text-sm font-medium truncate">{h.name}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${h.status === "active" ? "bg-success" : h.status === "complete" ? "bg-muted-foreground" : "bg-warning"}`} />
              {h.status} · {h.findings.length} findings
            </div>
          </button>
        ))}
      </aside>

      <section className="col-span-6 rounded-xl border border-border bg-card p-4 space-y-3">
        {active ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{active.name}</h2>
                <p className="text-sm text-muted-foreground italic">"{active.hypothesis}"</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => run.mutate(active.id)} disabled={run.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"><Play className="size-3.5" /> Run hunt</button>
                <select value={active.status} onChange={e => update.mutate({ id: active.id, patch: { status: e.target.value as any } })} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                  <option value="draft">Draft</option><option value="active">Active</option><option value="complete">Complete</option>
                </select>
                <button onClick={() => del.mutate(active.id)} className="rounded-md border border-border p-1.5 hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">SPL</div>
              <pre className="rounded-md bg-muted/30 border border-border p-3 text-xs font-mono overflow-x-auto">{active.spl}</pre>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {active.mitre.map(m => <span key={m} className="rounded-full border border-primary/40 px-2 py-0.5 text-primary">{m}</span>)}
            </div>
            {results && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-md border border-success/40 bg-success/5 p-3">
                <div className="text-sm font-medium text-success">Hunt complete — {results.matched.length} matches</div>
                <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto text-xs font-mono">
                  {results.matched.map((m: any) => <li key={m.id} className="truncate text-muted-foreground">{m.host} · {m.message}</li>)}
                </ul>
              </motion.div>
            )}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Findings ({active.findings.length})</div>
              <ul className="space-y-1.5">
                {active.findings.map((f, i) => (
                  <li key={i} className="rounded-md border border-border p-2 text-xs"><span className="text-muted-foreground tabular-nums">{new Date(f.at).toLocaleTimeString()}</span> — {f.text}</li>
                ))}
                {active.findings.length === 0 && <li className="text-xs text-muted-foreground italic">No findings yet — run the hunt to begin.</li>}
              </ul>
            </div>
          </>
        ) : <div className="text-sm text-muted-foreground">Select a hunt or create a new one →</div>}
      </section>

      <aside className="col-span-3 rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1"><Plus className="size-3" /> New hunt</div>
        <input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <textarea className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" rows={2} placeholder="Hypothesis…" value={draft.hypothesis} onChange={e => setDraft({ ...draft, hypothesis: e.target.value })} />
        <textarea className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono" rows={3} placeholder="SPL query" value={draft.spl} onChange={e => setDraft({ ...draft, spl: e.target.value })} />
        <input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" placeholder="MITRE (T1110, T1059)" value={draft.mitre} onChange={e => setDraft({ ...draft, mitre: e.target.value })} />
        <select multiple value={draft.tagIds} onChange={e => setDraft({ ...draft, tagIds: Array.from(e.target.selectedOptions).map(o => o.value) })} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs h-24">
          {(tags.data || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={() => create.mutate()} disabled={!draft.name || !draft.spl} className="w-full rounded-md bg-primary text-primary-foreground py-1.5 text-sm disabled:opacity-50">Create hunt</button>
      </aside>
    </div>
  );
}
