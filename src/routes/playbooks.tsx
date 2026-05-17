import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { PlaybookActionType } from "@/lib/types";
import { Workflow, Play, Plus, Trash2, Power } from "lucide-react";

const ACTIONS: { type: PlaybookActionType; label: string }[] = [
  { type: "create_case", label: "Create incident case" },
  { type: "notify_slack", label: "Notify Slack" },
  { type: "email", label: "Send email" },
  { type: "isolate_host", label: "Isolate host (EDR)" },
  { type: "disable_user", label: "Disable AD user" },
  { type: "block_ip", label: "Block IP at edge FW" },
  { type: "run_spl", label: "Run SPL query" },
  { type: "tag_event", label: "Tag matching events" },
];

export const Route = createFileRoute("/playbooks")({
  head: () => ({ meta: [{ title: "Playbooks — Splunk KnowBot" }] }),
  component: Playbooks,
});

function Playbooks() {
  const qc = useQueryClient();
  const playbooks = useQuery({ queryKey: ["playbooks"], queryFn: api.listPlaybooks });
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const [sel, setSel] = useState<string | null>(null);
  const [runLog, setRunLog] = useState<string[] | null>(null);

  const update = useMutation({ mutationFn: ({ id, patch }: any) => api.updatePlaybook(id, patch), onSuccess: () => qc.invalidateQueries({ queryKey: ["playbooks"] }) });
  const del = useMutation({ mutationFn: (id: string) => api.deletePlaybook(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["playbooks"] }) });
  const run = useMutation({ mutationFn: (id: string) => api.runPlaybook(id), onSuccess: r => { setRunLog(r.log); qc.invalidateQueries({ queryKey: ["playbooks"] }); } });
  const create = useMutation({
    mutationFn: () => api.createPlaybook({ name: "New Playbook", description: "", triggerTagIds: [], steps: [], enabled: false }),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["playbooks"] }); setSel(p.id); },
  });

  const active = playbooks.data?.find(p => p.id === sel);

  return (
    <div className="p-6 bg-grid min-h-screen space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Phase 3 · SOAR</div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Workflow className="size-6 text-primary" /> Playbooks</h1>
        </div>
        <button onClick={() => create.mutate()} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm"><Plus className="size-4" /> New playbook</button>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 space-y-2">
          {(playbooks.data || []).map(p => (
            <button key={p.id} onClick={() => { setSel(p.id); setRunLog(null); }} className={`w-full text-left rounded-xl border bg-card p-3 transition ${sel === p.id ? "border-primary" : "border-border hover:border-primary/40"}`}>
              <div className="flex items-start justify-between">
                <div className="text-sm font-medium">{p.name}</div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.enabled ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{p.enabled ? "ENABLED" : "DISABLED"}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{p.steps.length} steps · {p.runs} runs</div>
            </button>
          ))}
        </div>

        <div className="col-span-8">
          {active ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1.5">
                  <input value={active.name} onChange={e => update.mutate({ id: active.id, patch: { name: e.target.value } })} className="w-full bg-transparent text-lg font-semibold focus:outline-none border-b border-transparent focus:border-border" />
                  <input value={active.description} onChange={e => update.mutate({ id: active.id, patch: { description: e.target.value } })} placeholder="Description" className="w-full bg-transparent text-sm text-muted-foreground focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => update.mutate({ id: active.id, patch: { enabled: !active.enabled } })} className="rounded-md border border-border p-2 hover:border-primary"><Power className={`size-4 ${active.enabled ? "text-success" : "text-muted-foreground"}`} /></button>
                  <button onClick={() => run.mutate(active.id)} disabled={run.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm disabled:opacity-50"><Play className="size-4" /> Run now</button>
                  <button onClick={() => { del.mutate(active.id); setSel(null); }} className="rounded-md border border-border p-2 hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="size-4" /></button>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1.5">Trigger — when any of these tags fire</div>
                <select multiple value={active.triggerTagIds} onChange={e => update.mutate({ id: active.id, patch: { triggerTagIds: Array.from(e.target.selectedOptions).map(o => o.value) } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs h-24">
                  {(tags.data || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase text-muted-foreground">Steps</div>
                  <select onChange={e => { if (!e.target.value) return; const sel = ACTIONS.find(a => a.type === e.target.value)!; update.mutate({ id: active.id, patch: { steps: [...active.steps, { id: `s-${Date.now()}`, type: sel.type, label: sel.label, config: {} }] } }); e.target.value = ""; }} className="text-xs rounded-md border border-border bg-background px-2 py-1">
                    <option value="">+ Add step</option>
                    {ACTIONS.map(a => <option key={a.type} value={a.type}>{a.label}</option>)}
                  </select>
                </div>
                <ol className="space-y-2">
                  {active.steps.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-md border border-border bg-background/40 p-2">
                      <span className="size-6 rounded-full bg-primary/20 text-primary text-xs grid place-items-center font-bold">{i + 1}</span>
                      <span className="text-xs uppercase text-muted-foreground w-32">{s.type}</span>
                      <input value={s.label} onChange={e => update.mutate({ id: active.id, patch: { steps: active.steps.map(x => x.id === s.id ? { ...x, label: e.target.value } : x) } })} className="flex-1 bg-transparent text-sm focus:outline-none" />
                      <button onClick={() => update.mutate({ id: active.id, patch: { steps: active.steps.filter(x => x.id !== s.id) } })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                    </li>
                  ))}
                  {active.steps.length === 0 && <li className="text-xs text-muted-foreground italic">No steps yet — add one above.</li>}
                </ol>
              </div>

              {runLog && (
                <div className="rounded-md border border-success/40 bg-success/5 p-3">
                  <div className="text-sm font-medium text-success mb-1">Execution log</div>
                  <pre className="text-xs font-mono whitespace-pre-wrap">{runLog.join("\n")}</pre>
                </div>
              )}
            </div>
          ) : <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">Select a playbook</div>}
        </div>
      </div>
    </div>
  );
}
