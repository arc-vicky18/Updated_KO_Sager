import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Database,
  RefreshCw,
  Download
} from "lucide-react";

import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      {
        title: "Settings — Splunk KnowBot"
      }
    ]
  }),
  component: Settings,
});

function Settings() {

  const qc = useQueryClient();

  const [splunkForm, setSplunkForm] = useState({
    host: "",
    port: 8089,
    username: "",
    password: "",
    scheme: "https" as "https" | "http"
  });

  const [showPw, setShowPw] = useState(false);

  const [aiForm, setAiForm] = useState({
    provider: "anthropic",
    apiKey: "",
    model: ""
  });

  const [showKey, setShowKey] = useState(false);

  const [ingestForm, setIngestForm] = useState({
    spl: "index=* | head 200",
    earliest: "-1h",
    latest: "now",
    max_count: 100
  });

  const splunkStatus = useQuery({
    queryKey: ["splunk-status"],
    queryFn: api.splunkStatus,
    refetchInterval: 15000
  });

  const aiSettings = useQuery({
    queryKey: ["ai-settings"],
    queryFn: api.getAISettings
  });

  const connect = useMutation({
    mutationFn: () => api.splunkConnect(splunkForm),

    onSuccess: (state) => {

      qc.invalidateQueries({
        queryKey: ["splunk-status"]
      });

      if (state.connected) {

        toast.success(
          `Connected to Splunk ${state.version}`
        );

      } else {

        toast.error(
          state.error || "Connection failed"
        );

      }

    },
  });

  const disconnect = useMutation({

    mutationFn: api.splunkDisconnect,

    onSuccess: () => {

      qc.invalidateQueries({
        queryKey: ["splunk-status"]
      });

      toast.info(
        "Disconnected from Splunk"
      );

    },

  });

  const saveAI = useMutation({

    mutationFn: () => api.saveAISettings(aiForm),

    onSuccess: () => {

      qc.invalidateQueries({
        queryKey: ["ai-settings"]
      });

      toast.success(
        "AI settings saved"
      );

    },

  });

  const ingest = useMutation({

    mutationFn: () => api.splunkIngestEvents(ingestForm),

    onSuccess: (r) => {

      qc.invalidateQueries({
        queryKey: ["logs"]
      });

      toast.success(
        `Ingested ${r.ingested} events`
      );

    },

    onError: (e: any) => {

      toast.error(
        e.message
      );

    },

  });

  const status = splunkStatus.data;

  const isConnected = status?.connected;

  return (

    <div className="p-6 space-y-6 max-w-3xl">

      <header>

        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          System
        </div>

        <h1 className="text-2xl font-semibold flex items-center gap-2">

          <SettingsIcon className="size-5 text-primary" />

          Settings

        </h1>

      </header>

      {/* SPLUNK CONNECTION */}

      <section className="rounded-xl border border-border bg-card overflow-hidden">

        <div className="px-4 py-3 border-b border-border flex items-center justify-between">

          <div className="text-sm font-semibold flex items-center gap-2">

            {

              isConnected

              ?

              <Wifi className="size-4 text-success" />

              :

              <WifiOff className="size-4 text-muted-foreground" />

            }

            Splunk Instance Connection

          </div>

          {

            isConnected && (

              <div className="flex items-center gap-2 text-xs text-success">

                <CheckCircle2 className="size-3.5" />

                Connected · {status.host}:{status.port}

              </div>

            )

          }

        </div>

        <div className="p-4 space-y-4">

          <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground space-y-1">

            <div className="font-medium text-foreground">
              Connection guide
            </div>

            <ol className="list-decimal list-inside space-y-0.5">

              <li>
                Enter Splunk IP or hostname
              </li>

              <li>
                Use port 8089
              </li>

              <li>
                Use Splunk username/password
              </li>

              <li>
                Use HTTPS if TLS enabled
              </li>

            </ol>

          </div>

          <div className="grid grid-cols-2 gap-3">

            <div className="col-span-2 flex gap-2">

              <select
                value={splunkForm.scheme}
                onChange={e =>
                  setSplunkForm(f => ({
                    ...f,
                    scheme: e.target.value as any
                  }))
                }
                className="w-24 rounded-md bg-input border border-border px-2 py-2 text-sm"
              >

                <option value="https">
                  https
                </option>

                <option value="http">
                  http
                </option>

              </select>

              <input
                value={splunkForm.host}
                onChange={e =>
                  setSplunkForm(f => ({
                    ...f,
                    host: e.target.value
                  }))
                }
                placeholder="192.168.1.50"
                className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm font-mono"
              />

              <input
                value={String(splunkForm.port)}
                onChange={e =>
                  setSplunkForm(f => ({
                    ...f,
                    port: Number(e.target.value)
                  }))
                }
                type="number"
                className="w-24 rounded-md bg-input border border-border px-3 py-2 text-sm font-mono"
              />

            </div>

            <input
              value={splunkForm.username}
              onChange={e =>
                setSplunkForm(f => ({
                  ...f,
                  username: e.target.value
                }))
              }
              placeholder="Splunk username"
              className="rounded-md bg-input border border-border px-3 py-2 text-sm"
            />

            <div className="relative">

              <input
                value={splunkForm.password}
                onChange={e =>
                  setSplunkForm(f => ({
                    ...f,
                    password: e.target.value
                  }))
                }
                type={showPw ? "text" : "password"}
                placeholder="Splunk password"
                className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm pr-9"
              />

              <button
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2 top-2 text-muted-foreground"
              >

                {

                  showPw

                  ?

                  <EyeOff className="size-4" />

                  :

                  <Eye className="size-4" />

                }

              </button>

            </div>

          </div>

          {

            status?.error && (

              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">

                <XCircle className="size-3.5 shrink-0 mt-0.5" />

                <span>
                  {status.error}
                </span>

              </div>

            )

          }

          <div className="flex gap-2">

            <button
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
            >

              {

                connect.isPending

                ?

                <RefreshCw className="size-4 animate-spin" />

                :

                <Wifi className="size-4" />

              }

              Connect to Splunk

            </button>

            {

              isConnected && (

                <button
                  onClick={() => disconnect.mutate()}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm"
                >

                  <WifiOff className="size-4" />

                  Disconnect

                </button>

              )

            }

          </div>

        </div>

      </section>

      {/* INGEST EVENTS */}

      {

        isConnected && (

          <section className="rounded-xl border border-border bg-card overflow-hidden">

            <div className="px-4 py-3 border-b border-border text-sm font-semibold flex items-center gap-2">

              <Download className="size-4 text-primary" />

              Pull Events from Splunk

            </div>

            <div className="p-4 space-y-3">

              <textarea
                value={ingestForm.spl}
                onChange={e =>
                  setIngestForm(f => ({
                    ...f,
                    spl: e.target.value
                  }))
                }
                rows={2}
                className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm font-mono"
              />

              <div className="flex gap-2">

                <input
                  value={ingestForm.earliest}
                  onChange={e =>
                    setIngestForm(f => ({
                      ...f,
                      earliest: e.target.value
                    }))
                  }
                  className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm font-mono"
                />

                <input
                  value={ingestForm.latest}
                  onChange={e =>
                    setIngestForm(f => ({
                      ...f,
                      latest: e.target.value
                    }))
                  }
                  className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm font-mono"
                />

                <input
                  value={String(ingestForm.max_count)}
                  onChange={e =>
                    setIngestForm(f => ({
                      ...f,
                      max_count: Number(e.target.value)
                    }))
                  }
                  type="number"
                  className="w-24 rounded-md bg-input border border-border px-3 py-2 text-sm font-mono"
                />

              </div>

              <button
                onClick={() => ingest.mutate()}
                disabled={ingest.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
              >

                {

                  ingest.isPending

                  ?

                  <RefreshCw className="size-4 animate-spin" />

                  :

                  <Database className="size-4" />

                }

                Pull Events

              </button>

            </div>

          </section>

        )

      }

    </div>

  );

}