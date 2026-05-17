import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { KnowledgeObject } from "@/lib/types";
import { Wand2, BellRing, BarChart3, FileText, Database, Crosshair, Code2, Save } from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { id: "alert", label: "Alert", icon: BellRing },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "report", label: "Report", icon: FileText },
  { id: "lookup", label: "Lookup", icon: Database },
  { id: "spl", label: "SPL Query", icon: Code2 },
  { id: "regex", label: "Regex", icon: Code2 },
  { id: "correlation", label: "Correlation", icon: Crosshair },
  { id: "threat_hunt", label: "Threat Hunt", icon: Crosshair },
  { id: "field_extraction", label: "Field Extraction", icon: Code2 },
  { id: "saved_search", label: "Saved Search", icon: Code2 },
  { id: "data_model", label: "Data Model", icon: Database },
  { id: "event_type", label: "Event Type", icon: Database },
] as const;

const TEMPLATES = [
  "Brute Force Detection", "Failed Login Detection", "Privilege Escalation",
  "Suspicious PowerShell", "VPN Abuse", "Malware Beaconing",
  "Rare Process Execution", "Data Exfiltration", "Web Attack Detection",
];

export const Route = createFileRoute("/generator")({
  head: () => ({ meta: [{ title: "Knowledge Object Generator — Splunk KnowBot" }] }),
  component: Generator,
});

function Generator() {
  const qc = useQueryClient();
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const [type, setType] = useState<typeof TYPES[number]["id"]>("alert");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tagId, setTagId] = useState("");
  const [preview, setPreview] = useState<string>("");

  const gen = useMutation({
    mutationFn: () => api.aiGenerate({ prompt, mode: (type === "alert" || type === "dashboard" || type === "regex" || type === "spl" ? type : "spl"), tagId: tagId || undefined }),
    onSuccess: (r) => { setPreview(r.output); toast.success("Preview generated"); },
  });

  const save = useMutation({
    mutationFn: () => api.createKnowledgeObject({
      type: type as KnowledgeObject["type"],
      name: name || `Generated ${type}`,
      description: prompt || `Auto-generated ${type}`,
      spl: type === "spl" || type === "alert" || type === "correlation" ? preview : undefined,
      config: tryParse(preview),
      tags: tagId ? [tagId] : [],
      favorite: false,
      draft: false,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kos"] }); toast.success("Saved to repository"); setPreview(""); setName(""); setPrompt(""); },
  });

  return (
    <div className="p-6 space-y-5">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Automation</div>
        <h1 className="text-2xl font-semibold">Knowledge Object Generator</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick a type, choose a template or describe what you want, optionally pin a tag for context — KnowBot drafts the object, you review, edit, save.</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)} className={`rounded-lg border p-3 text-left transition ${type === t.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
            <t.icon className={`size-4 ${type === t.id ? "text-primary" : "text-muted-foreground"}`} />
            <div className="mt-1 text-sm font-medium">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm" />
          <select value={tagId} onChange={e => setTagId(e.target.value)} className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm">
            <option value="">No tag context</option>
            {(tags.data || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5} placeholder="Describe what to detect / build…" className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" />
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map(t => (
              <button key={t} onClick={() => setPrompt(t)} className="text-[11px] rounded-full border border-border px-2 py-0.5 hover:border-primary/50 hover:text-primary">{t}</button>
            ))}
          </div>
          <button onClick={() => gen.mutate()} disabled={gen.isPending || !prompt} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-2">
            <Wand2 className="size-4" /> {gen.isPending ? "Generating…" : "Generate preview"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Live preview</div>
            <button onClick={() => save.mutate()} disabled={!preview || save.isPending} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              <Save className="size-3.5" /> Save to Repository
            </button>
          </div>
          <textarea value={preview} onChange={e => setPreview(e.target.value)} rows={16} placeholder="Generated SPL / JSON appears here. Editable before saving." className="w-full rounded-md bg-background border border-border px-3 py-2 text-xs font-mono text-primary" />
          {preview && <Link to="/repository" className="text-xs text-primary hover:underline">View in Repository →</Link>}
        </div>
      </div>
    </div>
  );
}

function tryParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return { spl: s }; }
}
