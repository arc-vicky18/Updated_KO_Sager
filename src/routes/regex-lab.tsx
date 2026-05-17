import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Regex as RegexIcon, Wand2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/regex-lab")({
  head: () => ({ meta: [{ title: "Regex Lab — Splunk KnowBot" }] }),
  component: RegexLab,
});

function RegexLab() {
  const [pattern, setPattern] = useState(String.raw`Failed password for (?<user>\w+) from (?<src_ip>\d+\.\d+\.\d+\.\d+)`);
  const [flags, setFlags] = useState("gm");
  const [text, setText] = useState("Failed password for alice from 10.0.0.5 port 22\nAccepted password for bob from 10.0.0.7 port 22\nFailed password for carol from 10.0.1.9 port 22");
  const [prompt, setPrompt] = useState("");

  const result = useMemo(() => {
    try {
      const re = new RegExp(pattern, flags);
      const matches: { match: string; groups: Record<string, string> }[] = [];
      const it = text.matchAll(new RegExp(pattern, flags.includes("g") ? flags : flags + "g"));
      for (const m of it) matches.push({ match: m[0], groups: { ...(m.groups || {}) } });
      return { ok: true as const, matches, error: "" };
    } catch (e) { return { ok: false as const, matches: [], error: (e as Error).message }; }
  }, [pattern, flags, text]);

  const ai = useMutation({
    mutationFn: () => api.aiGenerate({ prompt, mode: "regex" }),
    onSuccess: (r) => { setPattern(r.output); toast.success("Regex suggested"); },
  });

  return (
    <div className="p-6 space-y-5">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Field Extraction</div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><RegexIcon className="size-5 text-primary" /> Regex Lab</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={pattern} onChange={e => setPattern(e.target.value)} className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" />
            <input value={flags} onChange={e => setFlags(e.target.value)} className="w-20 rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" placeholder="gm" />
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={10} className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono" />
          <div className="flex gap-2">
            <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe a regex (e.g. 'extract email and timestamp')" className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm" />
            <button onClick={() => ai.mutate()} disabled={!prompt || ai.isPending} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"><Wand2 className="size-4" /> {ai.isPending ? "…" : "AI suggest"}</button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          {!result.ok && <div className="text-sm text-destructive">Invalid regex: {result.error}</div>}
          {result.ok && (
            <>
              <div className="text-sm font-medium mb-2">{result.matches.length} match{result.matches.length === 1 ? "" : "es"}</div>
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                {result.matches.map((m, i) => (
                  <li key={i} className="rounded border border-border bg-background p-2 text-xs">
                    <div className="font-mono text-primary truncate">{m.match}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(m.groups).map(([k, v]) => (
                        <span key={k} className="rounded bg-accent/15 text-accent px-1.5 py-0.5 font-mono">{k}=<span className="text-foreground">{v}</span></span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
