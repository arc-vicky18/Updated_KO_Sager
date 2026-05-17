import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ScheduledReport } from "@/lib/types";
import { FileText, Play, Plus, Trash2, Power, Download } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Splunk KnowBot" }] }),
  component: Reports,
});

function Reports() {
  const qc = useQueryClient();
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.listReports });
  const [out, setOut] = useState<Record<string, { rows: number; downloadUrl: string }>>({});
  const update = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<ScheduledReport> }) => api.updateReport(id, patch), onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }) });
  const del = useMutation({ mutationFn: (id: string) => api.deleteReport(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }) });
  const run = useMutation({ mutationFn: (id: string) => api.runReport(id), onSuccess: (r, id) => { setOut(prev => ({ ...prev, [id]: { rows: r.rows, downloadUrl: r.downloadUrl } })); qc.invalidateQueries({ queryKey: ["reports"] }); } });
  const create = useMutation({ mutationFn: () => api.createReport({ name: "New scheduled report", description: "", cron: "0 8 * * *", format: "pdf", recipients: [], spl: "index=* | head 100", enabled: false }), onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }) });

  return (
    <div className="p-6 bg-grid min-h-screen space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Phase 3 · Compliance</div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><FileText className="size-6 text-primary" /> Scheduled Reports</h1>
        </div>
        <button onClick={() => create.mutate()} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm"><Plus className="size-4" /> New report</button>
      </header>

      <div className="grid gap-3">
        {(reports.data || []).map(r => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <input value={r.name} onChange={e => update.mutate({ id: r.id, patch: { name: e.target.value } })} className="w-full bg-transparent font-semibold focus:outline-none" />
                <input value={r.description} onChange={e => update.mutate({ id: r.id, patch: { description: e.target.value } })} placeholder="Description" className="w-full bg-transparent text-sm text-muted-foreground focus:outline-none" />
              </div>
              <button onClick={() => update.mutate({ id: r.id, patch: { enabled: !r.enabled } })} className="rounded-md border border-border p-2"><Power className={`size-4 ${r.enabled ? "text-success" : "text-muted-foreground"}`} /></button>
              <button onClick={() => run.mutate(r.id)} disabled={run.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm"><Play className="size-3.5" /> Run now</button>
              <button onClick={() => del.mutate(r.id)} className="rounded-md border border-border p-2 hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="size-3.5" /></button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <label className="space-y-1"><span className="text-muted-foreground">Cron schedule</span>
                <input value={r.cron} onChange={e => update.mutate({ id: r.id, patch: { cron: e.target.value } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono" />
              </label>
              <label className="space-y-1"><span className="text-muted-foreground">Format</span>
                <select value={r.format} onChange={e => update.mutate({ id: r.id, patch: { format: e.target.value as any } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5">
                  <option value="pdf">PDF</option><option value="csv">CSV</option><option value="json">JSON</option>
                </select>
              </label>
              <label className="space-y-1"><span className="text-muted-foreground">Recipients (comma-sep)</span>
                <input value={r.recipients.join(", ")} onChange={e => update.mutate({ id: r.id, patch: { recipients: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } })} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
              </label>
            </div>

            <label className="block text-xs space-y-1"><span className="text-muted-foreground">SPL</span>
              <textarea value={r.spl} onChange={e => update.mutate({ id: r.id, patch: { spl: e.target.value } })} rows={2} className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono" />
            </label>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{r.lastRunAt ? `Last run ${new Date(r.lastRunAt).toLocaleString()}` : "Never run"}</span>
              {out[r.id] && (
                <a href={out[r.id].downloadUrl} download={`${r.name}.${r.format}`} className="inline-flex items-center gap-1 text-success hover:underline"><Download className="size-3.5" /> Download ({out[r.id].rows} rows)</a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
