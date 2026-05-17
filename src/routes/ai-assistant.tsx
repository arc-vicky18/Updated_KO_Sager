import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Sparkles, Send, Settings, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/ai-assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — Splunk KnowBot" }] }),
  component: AIAssistant,
});

type Msg = { role: "user" | "assistant"; content: string };

function AIAssistant() {
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const aiSettings = useQuery({ queryKey: ["ai-settings"], queryFn: api.getAISettings });
  const [mode, setMode] = useState<"chat" | "spl" | "regex" | "alert" | "dashboard" | "explain">("chat");
  const [tagId, setTagId] = useState<string>("");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: "assistant",
    content: "Hi — I'm KnowBot. I can generate SPL queries, regex patterns, alerts, and dashboards from your tags.\n\nFor real AI responses, add your API key in Settings → AI Assistant.",
  }]);
  const scroller = useRef<HTMLDivElement>(null);
  const hasAI = aiSettings.data?.hasKey;

  const generate = useMutation({
    mutationFn: async () => {
      const aiCfg = aiSettings.data;
      return api.aiGenerate({
        prompt: input,
        mode,
        tagId: tagId || undefined,
        provider: aiCfg?.provider,
        apiKey: aiCfg?.apiKey,
        model: aiCfg?.model,
      } as any);
    },
    onSuccess: (r) => {
      setMsgs(m => [...m, { role: "assistant", content: r.output + (r.explanation ? `\n\n— ${r.explanation}` : "") }]);
    },
    onError: (e: any) => {
      setMsgs(m => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    },
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, generate.isPending]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs(m => [...m, { role: "user", content: input }]);
    generate.mutate();
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Copilot</div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles className="size-5 text-primary" /> AI Assistant</h1>
          <div className="flex items-center gap-2">
            {hasAI ? (
              <span className="text-xs text-success flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-success animate-pulse" /> {aiSettings.data?.provider}
              </span>
            ) : (
              <Link to="/settings" className="text-xs text-warning flex items-center gap-1 hover:text-foreground">
                <AlertCircle className="size-3.5" /> Add API key in Settings
              </Link>
            )}
            <select value={mode} onChange={e => setMode(e.target.value as any)}
              className="rounded-md bg-input border border-border px-2 py-1.5 text-sm">
              <option value="chat">Chat</option>
              <option value="spl">SPL</option>
              <option value="regex">Regex</option>
              <option value="alert">Alert</option>
              <option value="dashboard">Dashboard</option>
              <option value="explain">Explain</option>
            </select>
            <select value={tagId} onChange={e => setTagId(e.target.value)}
              className="rounded-md bg-input border border-border px-2 py-1.5 text-sm">
              <option value="">No tag context</option>
              {(tags.data || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Link to="/settings" className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground">
              <Settings className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto p-6 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-3xl ${m.role === "user" ? "ml-auto" : ""}`}>
            <div className={`text-[10px] uppercase mb-1 ${m.role === "user" ? "text-right text-muted-foreground" : "text-primary"}`}>{m.role}</div>
            <div className={`rounded-lg p-3 text-sm ${m.role === "user" ? "bg-primary/10 border border-primary/30" : "bg-card border border-border"}`}>
              {m.role === "assistant" && (mode === "spl" || mode === "regex" || mode === "alert" || mode === "dashboard")
                ? <pre className="font-mono text-xs whitespace-pre-wrap text-primary">{m.content}</pre>
                : <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>}
            </div>
          </div>
        ))}
        {generate.isPending && (
          <div className="text-sm text-muted-foreground animate-pulse flex items-center gap-2">
            <Sparkles className="size-3.5" /> {hasAI ? `${aiSettings.data?.provider} is thinking…` : "Generating…"}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder={
              mode === "spl" ? "e.g. detect lateral movement on Windows hosts" :
              mode === "regex" ? "e.g. extract username and source IP from auth logs" :
              mode === "alert" ? "e.g. alert on >10 failed logins per 5 minutes" :
              "Ask anything about Splunk, SPL, or security…"
            }
            className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm resize-none"
          />
          <button onClick={send} disabled={!input.trim() || generate.isPending}
            className="rounded-md bg-primary text-primary-foreground p-2.5 disabled:opacity-50 hover:opacity-90">
            <Send className="size-4" />
          </button>
        </div>
        <div className="max-w-3xl mx-auto mt-1 text-[11px] text-muted-foreground">
          Mode: <span className="text-primary">{mode}</span> · Enter to send · Shift+Enter for newline
          {!hasAI && " · Using template generation — add AI key in Settings for real AI"}
        </div>
      </div>
    </div>
  );
}
