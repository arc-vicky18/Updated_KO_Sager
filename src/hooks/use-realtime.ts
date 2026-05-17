import { useEffect, useState } from "react";
import { realtime } from "@/lib/realtime";
import type { LogEvent, RealtimeEvent } from "@/lib/types";

export function useLiveLogs(max = 50) {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  useEffect(() => realtime.subscribe(e => {
    if (e.type === "log") setLogs(prev => [e.data, ...prev].slice(0, max));
  }), [max]);
  return logs;
}

export function useLiveMetrics() {
  const [m, setM] = useState({ eps: 0, errorRate: 0, activeHunts: 0 });
  useEffect(() => realtime.subscribe(e => { if (e.type === "metric") setM(e.data); }), []);
  return m;
}

export function useRealtime(handler: (e: RealtimeEvent) => void) {
  useEffect(() => realtime.subscribe(handler), [handler]);
}
