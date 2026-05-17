// API client for REAL backend-only operation.
// All mock/demo/seed data removed.

import type {
  LogEvent,
  Tag,
  TagDrilldown,
  KnowledgeObject,
  Integration,
  ActivityEntry,
  Severity,
  CorrelationRule,
  Playbook,
  IncidentCase,
  ScheduledReport,
  Hunt,
} from "./types";

const BASE = "http://127.0.0.1:8001";

const store = {
  tags: [] as Tag[],
  logs: [] as LogEvent[],
  kos: [] as KnowledgeObject[],
  integrations: [] as Integration[],
  activity: [] as ActivityEntry[],
  rules: [] as CorrelationRule[],
  playbooks: [] as Playbook[],
  cases: [] as IncidentCase[],
  reports: [] as ScheduledReport[],
  hunts: [] as Hunt[],
};

async function http<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  usingMock: false,

  // ---------------- TAGS ----------------

  async listTags(): Promise<Tag[]> {
    return http("/tags");
  },

  async createTag(
    input: Omit<Tag, "id" | "count" | "createdAt"> & {
      count?: number;
    }
  ): Promise<Tag> {
    return http("/tags", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateTag(
    id: string,
    patch: Partial<Tag>
  ): Promise<Tag> {
    return http(`/tags/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteTag(id: string): Promise<void> {
    await http(`/tags/${id}`, {
      method: "DELETE",
    });
  },

  async tagDrilldown(id: string): Promise<TagDrilldown> {
    return http(`/tags/${id}/drilldown`);
  },

  // ---------------- LOGS ----------------

  async searchLogs(opts: {
    q?: string;
    tag?: string;
    severity?: Severity;
    limit?: number;
  } = {}): Promise<LogEvent[]> {
    const p = new URLSearchParams();

    if (opts.q) p.set("q", opts.q);
    if (opts.tag) p.set("tag", opts.tag);
    if (opts.severity) p.set("severity", opts.severity);
    if (opts.limit) p.set("limit", String(opts.limit));

    return http(`/logs/search?${p}`);
  },

  async ingestLog(
    input: Partial<LogEvent> & {
      message: string;
    }
  ): Promise<LogEvent> {
    return http("/logs/ingest", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  // ---------------- KNOWLEDGE OBJECTS ----------------

  async listKnowledgeObjects(): Promise<KnowledgeObject[]> {
    return http("/knowledge-objects");
  },

  async createKnowledgeObject(
    ko: Omit<
      KnowledgeObject,
      "id" | "version" | "createdAt" | "updatedAt" | "history"
    >
  ): Promise<KnowledgeObject> {
    return http("/knowledge-objects", {
      method: "POST",
      body: JSON.stringify(ko),
    });
  },

  async updateKnowledgeObject(
    id: string,
    patch: Partial<KnowledgeObject>,
    note = "edited"
  ): Promise<KnowledgeObject> {
    return http(`/knowledge-objects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...patch,
        note,
      }),
    });
  },

  async deleteKnowledgeObject(id: string) {
    await http(`/knowledge-objects/${id}`, {
      method: "DELETE",
    });
  },

  // ---------------- ACTIVITY ----------------

  async listActivity(): Promise<ActivityEntry[]> {
    return http("/activity");
  },

  // ---------------- INTEGRATIONS ----------------

  async listIntegrations(): Promise<Integration[]> {
    return http("/integrations");
  },

  async createIntegration(
    i: Omit<Integration, "id" | "status" | "lastSeen">
  ): Promise<Integration> {
    return http("/integrations", {
      method: "POST",
      body: JSON.stringify(i),
    });
  },

  async deleteIntegration(id: string) {
    await http(`/integrations/${id}`, {
      method: "DELETE",
    });
  },

  // ---------------- SPLUNK ----------------

  async splunkConnect(req: {
    host: string;
    port: number;
    username: string;
    password: string;
    scheme?: string;
  }): Promise<SplunkConnectionState> {
    return http("/splunk/connect", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  async splunkDisconnect(): Promise<SplunkConnectionState> {
    return http("/splunk/disconnect", {
      method: "POST",
    });
  },

  async splunkStatus(): Promise<SplunkConnectionState> {
    return http("/splunk/status");
  },

  async splunkSearch(req: {
    spl: string;
    earliest?: string;
    latest?: string;
    max_count?: number;
  }): Promise<{
    results: Record<string, string>[];
    fields: string[];
    count: number;
  }> {
    return http("/splunk/search", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  async splunkIndexes(): Promise<string[]> {
    return http("/splunk/indexes");
  },

  async splunkIngestEvents(req: {
    spl: string;
    earliest?: string;
    latest?: string;
    max_count?: number;
  }): Promise<{ ingested: number }> {
    return http("/splunk/ingest-events", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  // ---------------- AI ----------------

  async getAISettings(): Promise<{
    provider?: string;
    model?: string;
    hasKey?: boolean;
    apiKey?: string;
  }> {
    return http("/settings/ai");
  },

  async saveAISettings(cfg: {
    provider: string;
    apiKey: string;
    model?: string;
  }): Promise<{ ok: boolean }> {
    return http("/settings/ai", {
      method: "POST",
      body: JSON.stringify(cfg),
    });
  },
};

export interface SplunkConnectionState {
  connected: boolean;
  host: string;
  port: number;
  username: string;
  scheme: string;
  version?: string;
  error?: string;
}