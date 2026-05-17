import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { KnowledgeObject, Severity } from "@/lib/types";
import { BellRing, Plus, Play, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { SeverityDot } from "@/components/TagChip";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Alert Studio — Splunk KnowBot" }] }),
  component: Alerts,
});

function Alerts() {
  const qc = useQueryClient();
  const kos = useQuery({ queryKey: ["kos"], queryFn: api.listKnowledgeObjects });
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const alerts = (kos.data || []).filter(k => k.type === "alert");
  const [selected, setSelected] = useState<KnowledgeObject | null>(null);
  const [draft, setDraft] = useState({ name: "", spl: "", severity: "medium" as Severity, schedule: "*/5 * * * *", threshold: 10, tagId: "" });

  const create = useMutation({
    mutationFn: () => api.createKnowledgeObject({ type: "alert", name: draft.name || "New Alert", description: "", spl: draft.spl, config: { schedule: draft.schedule, threshold: draft.threshold, severity: draft.severity }, tags: draft.tagId ? [draft.tagId] : [], favorite: false, draft: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kos"] }); toast.success("Alert created"); setDraft({ name: "", spl: "", severity: "medium", schedule: "*/5 * * * *", threshold: 10, tagId: "" }); },
  });
  const update = useMutation({
    mutationFn: (k: KnowledgeObject) => api.updateKnowledgeObject(k.id, k, "edited in Alert Studio"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kos"] }); toast.success("Saved"); },
  });
  const del = useMutation({
    mutationFn: api.deleteKnowledgeObject,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kos"] }); setSelected(null); toast.success("Deleted"); },
  });

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Detection</div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><BellRing className="size-5 text-primary" /> Alert Studio</h1>
        </div>
        <Link to="/generator" className="text-xs text-primary hover:underline">Or generate from a template →</Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Active alerts ({alerts.length})</div>
          </div>
          <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {alerts.map(a => (
              <li key={a.id}>
                <button onClick={() => setSelected(a)} className={`w-full text-left p-3 hover:bg-muted/40 ${selected?.id === a.id ? "bg-primary/10" : ""}`}>
                  <div className="flex items-center gap-2">
                    <SeverityDot s={(a.config as any).severity || "medium"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono">{a.spl}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">v{a.version}</span>
                  </div>
                </button>
              </li>
            ))}
            {alerts.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No alerts yet.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-medium">{selected ? "Edit alert" : "New alert"}</div>
          {selected ? (
            <EditAlert key={selected.id} k={selected} onSave={update.mutate} onDelete={() => del.mutate(selected.id)} loading={update.isPending} />
          ) : (
            <>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Alert name" className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm" />
              <textarea value={draft.spl} onChange={e => setDraft(d => ({ ...d, spl: e.target.value }))} rows={5} placeholder='index=auth action=failure | stats count by src_ip | where count >= 10' className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" />
              <div className="grid grid-cols-3 gap-2">
                <select value={draft.severity} onChange={e => setDraft(d => ({ ...d, severity: e.target.value as Severity }))} className="rounded-md bg-input border border-border px-2 py-2 text-sm">
                  {(["info","low","medium","high","critical"] as Severity[]).map(s => <option key={s}>{s}</option>)}
                </select>
                <input value={draft.schedule} onChange={e => setDraft(d => ({ ...d, schedule: e.target.value }))} placeholder="cron" className="rounded-md bg-input border border-border px-2 py-2 text-sm font-mono" />
                <input type="number" value={draft.threshold} onChange={e => setDraft(d => ({ ...d, threshold: +e.target.value }))} placeholder="threshold" className="rounded-md bg-input border border-border px-2 py-2 text-sm" />
              </div>
              <select value={draft.tagId} onChange={e => setDraft(d => ({ ...d, tagId: e.target.value }))} className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm">
                <option value="">Link to tag (optional)</option>
                {(tags.data || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={() => create.mutate()} disabled={!draft.spl || create.isPending} className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
                <Plus className="size-4" /> Create alert
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditAlert({ k, onSave, onDelete, loading }: { k: KnowledgeObject; onSave: (k: KnowledgeObject) => void; onDelete: () => void; loading: boolean }) {
  const [form, setForm] = useState(k);
  return (
    <div className="space-y-3">
      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm" />
      <textarea value={form.spl || ""} onChange={e => setForm(f => ({ ...f, spl: e.target.value }))} rows={6} className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" />
      <div className="grid grid-cols-3 gap-2">
        <select value={(form.config as any).severity || "medium"} onChange={e => setForm(f => ({ ...f, config: { ...f.config, severity: e.target.value } }))} className="rounded-md bg-input border border-border px-2 py-2 text-sm">
          {(["info","low","medium","high","critical"] as Severity[]).map(s => <option key={s}>{s}</option>)}
        </select>
        <input value={(form.config as any).schedule || ""} onChange={e => setForm(f => ({ ...f, config: { ...f.config, schedule: e.target.value } }))} className="rounded-md bg-input border border-border px-2 py-2 text-sm font-mono" />
        <input type="number" value={(form.config as any).threshold ?? 0} onChange={e => setForm(f => ({ ...f, config: { ...f.config, threshold: +e.target.value } }))} className="rounded-md bg-input border border-border px-2 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(form)} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"><Save className="size-4" /> Save</button>
        <button onClick={() => toast.message("Test run", { description: "Would dispatch the SPL to your Splunk env" })} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><Play className="size-4" /> Test run</button>
        <button onClick={onDelete} className="ml-auto inline-flex items-center gap-2 rounded-md border border-destructive/40 text-destructive px-3 py-2 text-sm"><Trash2 className="size-4" /> Delete</button>
      </div>
      <div className="text-[11px] text-muted-foreground">v{form.version} · last updated {new Date(form.updatedAt).toLocaleString()}</div>
    </div>
  );
}
