import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/activity")({
  head: () => ({ meta: [{ title: "Activity Monitor — Splunk KnowBot" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const list = useQuery({ queryKey: ["activity"], queryFn: api.listActivity, refetchInterval: 5000 });
  return (
    <div className="p-6 space-y-5">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Audit</div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Activity className="size-5 text-primary" /> Activity Monitor</h1>
      </header>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(list.data || []).map(a => (
          <div key={a.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
            <span><span className="text-primary">{a.actor}</span> <span className="text-muted-foreground">{a.action}</span> <span className="font-medium">{a.target}</span></span>
            <span className="text-xs text-muted-foreground tabular-nums">{new Date(a.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
