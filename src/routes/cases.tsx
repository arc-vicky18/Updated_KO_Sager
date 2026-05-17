import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { IncidentCase, Severity } from "@/lib/types";
import { Briefcase, MessageSquarePlus, Workflow } from "lucide-react";

const SEV_COLORS: Record<Severity, string> = { info: "bg-muted text-muted-foreground", low: "bg-blue-500/20 text-blue-300", medium: "bg-warning/20 text-warning", high: "bg-orange-500/20 text-orange-300", critical: "bg-destructive/20 text-destructive" };

export const Route = createFileRoute("/cases")({
  head: () => ({ meta: [{ title: "Cases — Splunk KnowBot" }] }),
  component: Cases,
});

function Cases() {
  const qc = useQueryClient();
  const cases = useQuery({ queryKey: ["cases"], queryFn: api.listCases });
  const playbooks = useQuery({ queryKey: ["playbooks"], queryFn: api.listPlaybooks });
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const update = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<IncidentCase> }) => api.updateCase(id, patch), onSuccess: () => qc.invalidateQueries({ queryKey: ["cases"] }) });
  const addNote = useMutation({ mutationFn: ({ id, text }: { id: string; text: string }) => api.addCaseNote(id, text), onSuccess: () => { qc.invalidateQueries({ queryKey: ["cases"] }); setNote(""); } });
  const runPb = useMutation({ mutationFn: ({ pid, cid }: { pid: string; cid: string }) => api.runPlaybook(pid, cid), onSuccess: () => qc.invalidateQueries({ queryKey: ["cases"] }) });

  const active = cases.data?.find(c => c.id === sel);

  return (
    <div className="p-6 bg-grid min-h-screen grid grid-cols-12 gap-4">
      <header className="col-span-12 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Phase 3 · Response</div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Briefcase className="size-6 text-primary" /> Incident Cases</h1>
        </div>
      </header>

      <aside className="col-span-4 space-y-2 max-h-[80vh] overflow-y-auto pr-1">
        {(cases.data || []).map(c => (
          <button key={c.id} onClick={() => setSel(c.id)} className={`w-full text-left rounded-xl border bg-card p-3 transition ${sel === c.id ? "border-primary" : "border-border hover:border-primary/40"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{c.title}</div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${SEV_COLORS[c.severity]}`}>{c.severity.toUpperCase()}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{c.status} · {c.notes.length} notes · {c.eventIds.length} events</div>
          </button>
        ))}
      </aside>

      <section className="col-span-8">
        {active ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <input value={active.title} onChange={e => update.mutate({ id: active.id, patch: { title: e.target.value } })} className="flex-1 bg-transparent text-lg font-semibold focus:outline-none border-b border-transparent focus:border-border" />
              <select value={active.status} onChange={e => update.mutate({ id: active.id, patch: { status: e.target.value as any } })} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                <option value="open">Open</option><option value="investigating">Investigating</option><option value="contained">Contained</option><option value="resolved">Resolved</option><option value="false_positive">False Positive</option>
              </select>
              <select value={active.severity} onChange={e => update.mutate({ id: active.id, patch: { severity: e.target.value as Severity } })} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                <option>info</option><option>low</option><option>medium</option><option>high</option><option>critical</option>
              </select>
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1"><Workflow className="size-3" /> Run playbook on this case</div>
              <div className="flex flex-wrap gap-2">
                {(playbooks.data || []).filter(p => p.enabled).map(p => (
                  <button key={p.id} onClick={() => runPb.mutate({ pid: p.id, cid: active.id })} className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-primary">{p.name}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">Timeline</div>
              <ul className="space-y-2">
                {[...active.notes.map(n => ({ kind: "note" as const, at: n.at, text: `${n.author}: ${n.text}` })), ...active.playbookRuns.map(r => ({ kind: "run" as const, at: r.at, text: `Playbook ${r.playbookId} → ${r.result} · ${r.details}` }))].sort((a, b) => b.at.localeCompare(a.at)).map((e, i) => (
                  <li key={i} className={`text-xs rounded-md border-l-2 pl-3 py-1.5 ${e.kind === "run" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <div className="text-muted-foreground">{new Date(e.at).toLocaleString()}</div>
                    <div>{e.text}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2">
              <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && note.trim()) addNote.mutate({ id: active.id, text: note.trim() }); }} placeholder="Add an investigation note…" className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <button onClick={() => note.trim() && addNote.mutate({ id: active.id, text: note.trim() })} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 text-sm"><MessageSquarePlus className="size-4" /> Add</button>
            </div>
          </div>
        ) : <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">Select a case</div>}
      </section>
    </div>
  );
}
