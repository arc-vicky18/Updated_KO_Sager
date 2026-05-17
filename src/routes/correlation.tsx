import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { CorrelationRule, Severity } from "@/lib/types";
import { GitMerge, Play, Plus, Trash2, Power } from "lucide-react";

export const Route = createFileRoute("/correlation")({
  head: () => ({ meta: [{ title: "Correlation Engine — Splunk KnowBot" }] }),
  component: Correlation,
});

function Correlation() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ["rules"], queryFn: api.listCorrelationRules });
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const [results, setResults] = useState<Record<string, number>>({});

  const update = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<CorrelationRule> }) => api.updateCorrelationRule(id, patch), onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }) });
  const del = useMutation({ mutationFn: (id: string) => api.deleteCorrelationRule(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }) });
  const run = useMutation({ mutationFn: (id: string) => api.runCorrelationRule(id), onSuccess: (r, id) => { setResults(prev => ({ ...prev, [id]: r.matched })); qc.invalidateQueries({ queryKey: ["rules"] }); qc.invalidateQueries({ queryKey: ["cases"] }); } });
  const create = useMutation({
    mutationFn: () => api.createCorrelationRule({ name: "New rule", description: "", windowMinutes: 15, threshold: 1, tagIds: [], groupBy: "host", severity: "medium", enabled: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });

  return (
    <div className="p-6 bg-grid min-h-screen space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Phase 3 · Detection</div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><GitMerge className="size-6 text-primary" /> Correlation Engine</h1>
          <p className="text-sm text-muted-foreground">Rules that combine multiple tags within a time window to escalate into incident cases.</p>
        </div>
        <button onClick={() => create.mutate()} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm"><Plus className="size-4" /> New rule</button>
      </header>

      <div className="space-y-3">
        {(rules.data || []).map(r => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1.5">
                <input value={r.name} onChange={e => update.mutate({ id: r.id, patch: { name: e.target.value } })} className="w-full bg-transparent font-semibold focus:outline-none" />
                <input value={r.description} onChange={e => update.mutate({ id: r.id, patch: { description: e.target.value } })} placeholder="Description" className="w-full bg-transparent text-sm text-muted-foreground focus:outline-none" />
              </div>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">{r.hits} hits</span>
              <button onClick={() => update.mutate({ id: r.id, patch: { enabled: !r.enabled } })} className="rounded-md border border-border p-2"><Power className={`size-4 ${r.enabled ? "text-success" : "text-muted-foreground"}`} /></button>
              <button onClick={() => run.mutate(r.id)} disabled={run.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm"><Play className="size-3.5" /> Test</button>
              <button onClick={() => del.mutate(r.id)} className="rounded-md border border-border p-2 hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="size-3.5" /></button>
            </div>

            <div className="grid grid-cols-4 gap-3 text-xs">
              <label className="space-y-1"><span className="text-muted-foreground">Window (min)</span>
                <input type="number" value={r.windowMinutes} onChange={e => update.mutate({ id: r.id, patch: { windowMinutes: +e.target.value } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
              </label>
              <label className="space-y-1"><span className="text-muted-foreground">Threshold</span>
                <input type="number" value={r.threshold} onChange={e => update.mutate({ id: r.id, patch: { threshold: +e.target.value } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
              </label>
              <label className="space-y-1"><span className="text-muted-foreground">Group by</span>
                <select value={r.groupBy} onChange={e => update.mutate({ id: r.id, patch: { groupBy: e.target.value as any } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5">
                  <option>host</option><option>user</option><option>src_ip</option>
                </select>
              </label>
              <label className="space-y-1"><span className="text-muted-foreground">Severity</span>
                <select value={r.severity} onChange={e => update.mutate({ id: r.id, patch: { severity: e.target.value as Severity } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5">
                  <option>info</option><option>low</option><option>medium</option><option>high</option><option>critical</option>
                </select>
              </label>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Tags that must ALL appear within window</div>
              <select multiple value={r.tagIds} onChange={e => update.mutate({ id: r.id, patch: { tagIds: Array.from(e.target.selectedOptions).map(o => o.value) } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs h-20">
                {(tags.data || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {results[r.id] !== undefined && (
              <div className="text-xs text-success border-l-2 border-success pl-3">Last test matched {results[r.id]} event group(s) → opened a case automatically.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
