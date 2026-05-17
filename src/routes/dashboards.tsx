import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart3, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboards")({
  head: () => ({ meta: [{ title: "Dashboard Builder — Splunk KnowBot" }] }),
  component: Dashboards,
});

function Dashboards() {
  const kos = useQuery({ queryKey: ["kos"], queryFn: api.listKnowledgeObjects });
  const dashboards = (kos.data || []).filter(k => k.type === "dashboard");
  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Visualization</div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><BarChart3 className="size-5 text-primary" /> Dashboard Builder</h1>
        </div>
        <Link to="/generator" className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium"><Plus className="size-4" /> New from Generator</Link>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {dashboards.map(d => (
          <Link key={d.id} to="/repository" className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="text-sm font-medium">{d.name}</div>
            <div className="text-xs text-muted-foreground mt-1">{d.description || "No description"}</div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {Array.from({ length: (d.config as any).panels || 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-gradient-to-br from-primary/20 to-accent/20 border border-border" />
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">v{d.version} · {new Date(d.updatedAt).toLocaleDateString()}</div>
          </Link>
        ))}
        {dashboards.length === 0 && <div className="text-sm text-muted-foreground">No dashboards yet — generate one from a tag in <Link to="/log-explorer" className="text-primary hover:underline">Log Explorer</Link>.</div>}
      </div>
    </div>
  );
}
