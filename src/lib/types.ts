// Shared API types between frontend and Python backend.
// See API_CONTRACT.md for the full endpoint specification.

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface LogEvent {
  id: string;
  timestamp: string; // ISO
  source: string;
  sourcetype: string;
  host: string;
  user?: string | null;
  message: string;
  raw: string;
  severity: Severity;
  tags: string[]; // tag ids
  fields?: Record<string, string | number>;
}

export interface Tag {
  id: string;
  name: string;
  category: string;
  color: string; // hex/oklch ok
  description: string;
  rule?: string; // SPL or regex rule for auto-application
  custom: boolean;
  severity: Severity;
  count: number;
  mitre?: string[]; // technique ids e.g. "T1110"
  createdAt: string;
}

export interface TagDrilldown {
  tag: Tag;
  events: LogEvent[];
  hosts: { host: string; count: number }[];
  users: { user: string; count: number }[];
  timeline: { t: string; count: number }[];
  spl: string;
  relatedAlerts: { id: string; name: string; severity: Severity }[];
  recommendedDashboards: { id: string; name: string }[];
  mitre: { id: string; name: string; tactic: string }[];
  iocs: { type: string; value: string; score: number }[];
  threatScore: number;
}

export interface KnowledgeObject {
  id: string;
  type: "alert" | "dashboard" | "report" | "lookup" | "spl" | "regex" | "correlation" | "threat_hunt" | "field_extraction" | "saved_search" | "data_model" | "event_type";
  name: string;
  description: string;
  spl?: string;
  config: Record<string, unknown>;
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  draft: boolean;
  history: { version: number; at: string; note: string; config: Record<string, unknown> }[];
}

export interface Integration {
  id: string;
  name: string;
  type: "rest" | "webhook" | "splunk" | "websocket" | "json_feed" | "batch";
  url: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  lastSeen?: string;
  authHeader?: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
}

// ---- Phase 2/3 ----

export interface CorrelationRule {
  id: string;
  name: string;
  description: string;
  windowMinutes: number;
  threshold: number;
  tagIds: string[]; // ALL of these tags must appear within the window
  groupBy: "host" | "user" | "src_ip";
  severity: Severity;
  enabled: boolean;
  createdAt: string;
  hits: number;
}

export type PlaybookActionType =
  | "create_case" | "notify_slack" | "email" | "isolate_host"
  | "disable_user" | "block_ip" | "run_spl" | "tag_event";

export interface PlaybookStep {
  id: string;
  type: PlaybookActionType;
  label: string;
  config: Record<string, string>;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  triggerTagIds: string[]; // any-of
  triggerSeverity?: Severity;
  steps: PlaybookStep[];
  enabled: boolean;
  runs: number;
  lastRunAt?: string;
  createdAt: string;
}

export interface IncidentCase {
  id: string;
  title: string;
  severity: Severity;
  status: "open" | "investigating" | "contained" | "resolved" | "false_positive";
  assignee?: string;
  tagIds: string[];
  eventIds: string[];
  notes: { at: string; author: string; text: string }[];
  playbookRuns: { at: string; playbookId: string; result: "ok" | "failed"; details: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  cron: string;
  format: "pdf" | "csv" | "json";
  recipients: string[];
  spl: string;
  lastRunAt?: string;
  enabled: boolean;
  createdAt: string;
}

export interface Hunt {
  id: string;
  name: string;
  hypothesis: string;
  spl: string;
  tagIds: string[];
  mitre: string[];
  status: "draft" | "active" | "complete";
  findings: { at: string; text: string; eventId?: string }[];
  createdAt: string;
}

export type RealtimeEvent =
  | { type: "log"; data: LogEvent }
  | { type: "metric"; data: { eps: number; errorRate: number; activeHunts: number } }
  | { type: "alert"; data: { id: string; name: string; severity: Severity; at: string } }
  | { type: "case"; data: IncidentCase };

