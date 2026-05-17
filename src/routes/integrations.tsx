import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Plug, Plus, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Splunk KnowBot" }] }),
  component: Integrations,
});

function Integrations() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["integrations"], queryFn: api.listIntegrations });
  const [draft, setDraft] = useState({ name: "", type: "rest" as const, url: "", authHeader: "" });
  const [tester, setTester] = useState({ method: "GET", url: "", body: "", result: "" });

  const create = useMutation({ mutationFn: () => api.createIntegration(draft as any), onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); toast.success("Integration added"); setDraft({ name: "", type: "rest", url: "", authHeader: "" }); } });
  const test = useMutation({ mutationFn: api.testIntegration, onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["integrations"] }); toast[r.ok ? "success" : "error"](`${r.status} · ${r.latencyMs}ms`); } });
  const del = useMutation({ mutationFn: api.deleteIntegration, onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }) });

  const runTester = async () => {
    try {
      const start = performance.now();
      const r = await fetch(tester.url, { method: tester.method, body: tester.method === "GET" ? undefined : tester.body });
      const text = await r.text();
      setTester(t => ({ ...t, result: `${r.status} · ${Math.round(performance.now()-start)}ms\n\n${text.slice(0, 2000)}` }));
    } catch (e) { setTester(t => ({ ...t, result: `Error: ${(e as Error).message}` })); }
  };

  return (
    <div className="p-6 space-y-5">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Universal Data Integration</div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Plug className="size-5 text-primary" /> Integrations</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border text-sm font-medium">Connected sources</div>
          <ul className="divide-y divide-border">
            {(list.data || []).map(i => (
              <li key={i.id} className="px-4 py-3 flex items-center gap-3">
                <span className={`size-2.5 rounded-full ${i.status === "healthy" ? "bg-success" : i.status === "degraded" ? "bg-warning" : i.status === "down" ? "bg-destructive" : "bg-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{i.name} <span className="text-[10px] uppercase rounded bg-secondary text-secondary-foreground px-1.5 py-0.5 ml-1">{i.type}</span></div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">{i.url}</div>
                </div>
                <span className="text-[11px] text-muted-foreground">{i.lastSeen ? new Date(i.lastSeen).toLocaleTimeString() : "—"}</span>
                <button onClick={() => test.mutate(i.id)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"><Play className="size-3" /> Test</button>
                <button onClick={() => del.mutate(i.id)} className="rounded-md border border-destructive/40 text-destructive p-1.5"><Trash2 className="size-3" /></button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="text-sm font-medium">Add source</div>
          <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Name" className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm" />
          <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as any }))} className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm">
            {["rest","webhook","splunk","websocket","json_feed","batch"].map(t => <option key={t}>{t}</option>)}
          </select>
          <input value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="URL" className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" />
          <input value={draft.authHeader} onChange={e => setDraft(d => ({ ...d, authHeader: e.target.value }))} placeholder="Auth header (optional)" className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" />
          <button onClick={() => create.mutate()} disabled={!draft.name || !draft.url} className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"><Plus className="size-4" /> Add</button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium mb-2">API Tester</div>
        <div className="flex gap-2 mb-2">
          <select value={tester.method} onChange={e => setTester(t => ({ ...t, method: e.target.value }))} className="rounded-md bg-input border border-border px-2 py-2 text-sm w-24">
            {["GET","POST","PUT","DELETE"].map(m => <option key={m}>{m}</option>)}
          </select>
          <input value={tester.url} onChange={e => setTester(t => ({ ...t, url: e.target.value }))} placeholder="https://api.example.com/endpoint" className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" />
          <button onClick={runTester} className="rounded-md bg-primary text-primary-foreground px-4 text-sm font-medium">Send</button>
        </div>
        {tester.method !== "GET" && <textarea value={tester.body} onChange={e => setTester(t => ({ ...t, body: e.target.value }))} rows={3} placeholder="Body" className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono mb-2" />}
        <pre className="text-xs font-mono whitespace-pre-wrap bg-background border border-border rounded p-2 min-h-24">{tester.result || "Response appears here…"}</pre>
      </div>
    </div>
  );
}
