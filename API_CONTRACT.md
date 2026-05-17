# Splunk KnowBot — API Contract for Python Backend

The frontend reads `VITE_API_BASE_URL` at build time. When set, it calls your
Python backend at that origin. When unset, the UI runs against an in-memory
mock so it remains fully demoable.

All endpoints return JSON. Use standard HTTP status codes. CORS must allow the
frontend origin. Auth is **out of scope** — apply your own middleware.

## Types
See `src/lib/types.ts`. Mirror those shapes exactly in your Pydantic models.

## REST Endpoints

### Tags
- `GET    /tags` → `Tag[]`
- `POST   /tags` body `Omit<Tag, "id"|"count"|"createdAt">` → `Tag`
- `PATCH  /tags/:id` body `Partial<Tag>` → `Tag`
- `DELETE /tags/:id` → 204
- `GET    /tags/:id/drilldown` → `TagDrilldown` (events, hosts, users, timeline, SPL, MITRE, IOCs, threatScore, related alerts/dashboards)

### Logs
- `GET  /logs/search?q=&tag=&severity=&limit=` → `LogEvent[]`
- `POST /logs/ingest` body `Partial<LogEvent> & { message: string }` → `LogEvent`
  - Backend should run smart-tagging on ingest and attach matching tag ids.

### Knowledge Objects
- `GET    /knowledge-objects` → `KnowledgeObject[]`
- `POST   /knowledge-objects` body `Omit<KnowledgeObject, "id"|"version"|"createdAt"|"updatedAt"|"history">` → `KnowledgeObject`
- `PATCH  /knowledge-objects/:id` body `Partial<KnowledgeObject> & { note?: string }` → `KnowledgeObject` (auto-bump version, append history entry)
- `DELETE /knowledge-objects/:id` → 204
- `POST   /knowledge-objects/:id/rollback` body `{ version: number }` → `KnowledgeObject`

### AI / Generation
- `POST /ai/generate` body `{ prompt: string; mode: "spl"|"regex"|"alert"|"dashboard"|"explain"|"chat"; tagId?: string }` → `{ output: string; explanation?: string }`

### Integrations
- `GET    /integrations` → `Integration[]`
- `POST   /integrations` body `Omit<Integration, "id"|"status"|"lastSeen">` → `Integration`
- `POST   /integrations/:id/test` → `{ ok, latencyMs, status, body }`
- `DELETE /integrations/:id` → 204

### Activity
- `GET /activity` → `ActivityEntry[]`

## WebSocket (Phase 2)

`wss://<backend>/ws/stream` — server pushes:
```
{ "type": "log",     "data": LogEvent }
{ "type": "tag",     "data": Tag }                 // new tag auto-created
{ "type": "alert",   "data": KnowledgeObject }
{ "type": "metrics", "data": { eps:number, errorRate:number } }
```

## FastAPI starter (suggested layout)
```
backend/
  app/
    main.py            # FastAPI(), CORSMiddleware
    db.py              # async SQLAlchemy engine
    models/            # ORM models
    schemas/           # Pydantic mirrors of src/lib/types.ts
    routers/
      tags.py logs.py knowledge.py ai.py integrations.py activity.py ws.py
    services/
      tagger.py        # rule-based + LLM auto-tagging on ingest
      generator.py     # SPL/regex/alert/dashboard generation
      drilldown.py     # builds TagDrilldown from event store
    workers/
      ingest_worker.py # asyncio queue or Celery
```

Once your backend is up, set `VITE_API_BASE_URL=https://api.your-host.com` in
the Lovable project env and the frontend will switch over automatically.
