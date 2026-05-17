"""
Splunk KnowBot — Python/FastAPI Backend
Splunk connectivity via IP + username/password (no auth token required on this app).
Persistent SQLite storage. AI assistant passthrough (Anthropic / OpenAI).
"""
from __future__ import annotations
from knowledge_engine import (
    generate_dashboard,
    generate_alert,
    generate_lookup,
)

import asyncio
import json
import re
import time
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

import aiosqlite
import httpx
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from tag_engine import categorize_log

from tag_repository import (
    ensure_tag_exists,
    get_all_tags,
    get_all_tag_rules
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DB_PATH = "knowbot.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id(prefix: str = "obj") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


Severity = Literal["info", "low", "medium", "high", "critical"]

# ---------------------------------------------------------------------------
# Pydantic models (mirror src/lib/types.ts)
# ---------------------------------------------------------------------------


class LogEvent(BaseModel):
    id: str = Field(default_factory=lambda: _id("log"))
    timestamp: str = Field(default_factory=_now)
    source: str = "unknown"
    sourcetype: str = "unknown"
    host: str = "unknown"
    user: Optional[str] = None
    message: str
    raw: str = ""
    severity: Severity = "info"
    tags: list[str] = []
    fields: dict[str, Any] = {}


class Tag(BaseModel):
    id: str = Field(default_factory=lambda: _id("tag"))
    name: str
    category: str = "Custom"
    color: str = "#7c3aed"
    description: str = ""
    rule: Optional[str] = None
    custom: bool = True
    severity: Severity = "info"
    count: int = 0
    mitre: list[str] = []
    createdAt: str = Field(default_factory=_now)


class KoHistoryEntry(BaseModel):
    version: int
    at: str
    note: str
    config: dict[str, Any]


class KnowledgeObject(BaseModel):
    id: str = Field(default_factory=lambda: _id("ko"))
    type: str
    name: str
    description: str = ""
    spl: Optional[str] = None
    config: dict[str, Any] = {}
    tags: list[str] = []
    version: int = 1
    createdAt: str = Field(default_factory=_now)
    updatedAt: str = Field(default_factory=_now)
    favorite: bool = False
    draft: bool = False
    history: list[KoHistoryEntry] = []


class Integration(BaseModel):
    id: str = Field(default_factory=lambda: _id("int"))
    name: str
    type: str
    url: str
    status: Literal["healthy", "degraded", "down", "unknown"] = "unknown"
    lastSeen: Optional[str] = None
    authHeader: Optional[str] = None


class ActivityEntry(BaseModel):
    id: str = Field(default_factory=lambda: _id("act"))
    at: str = Field(default_factory=_now)
    actor: str = "system"
    action: str
    target: Optional[str] = None


class AIRequest(BaseModel):
    prompt: str
    mode: Literal["spl", "regex", "alert", "dashboard", "explain", "chat"]
    tagId: Optional[str] = None
    provider: Optional[str] = None   # "anthropic" | "openai"
    apiKey: Optional[str] = None
    model: Optional[str] = None


# Splunk connection models
class SplunkConnectRequest(BaseModel):
    host: str          # IP or hostname
    port: int = 8089   # management port (default 8089)
    username: str
    password: str
    scheme: str = "https"


class SplunkSearchRequest(BaseModel):
    spl: str
    earliest: str = "-24h"
    latest: str = "now"
    max_count: int = 100


class SplunkConnectionState(BaseModel):
    connected: bool = False
    host: str = ""
    port: int = 8089
    username: str = ""
    scheme: str = "https"
    version: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# SQLite DB
# ---------------------------------------------------------------------------

async def init_db() -> None:

    async with aiosqlite.connect(DB_PATH) as db:

        await db.executescript("""

        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT,
            category TEXT,
            severity TEXT,
            count INTEGER DEFAULT 0,
            data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS knowledge_objects (
            id TEXT PRIMARY KEY,
            type TEXT,
            name TEXT,
            tag TEXT,
            content TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT,
            data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS integrations (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity (
            id TEXT PRIMARY KEY,
            at TEXT,
            data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        """)

        await db.commit()


async def db_get_all(table: str) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(f"SELECT data FROM {table} ORDER BY rowid DESC") as cur:
            rows = await cur.fetchall()
    return [json.loads(r[0]) for r in rows]


async def db_upsert(table: str, id_: str, data: dict) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"INSERT OR REPLACE INTO {table} (id, data) VALUES (?, ?)",
            (id_, json.dumps(data))
        )
        await db.commit()


async def db_upsert_log(log: dict) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO logs (id, timestamp, data) VALUES (?, ?, ?)",
            (log["id"], log["timestamp"], json.dumps(log))
        )
        await db.commit()


async def db_delete(table: str, id_: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"DELETE FROM {table} WHERE id = ?", (id_,))
        await db.commit()


async def db_search_logs(q: str | None, tag: str | None, severity: str | None, limit: int) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT data FROM logs ORDER BY timestamp DESC LIMIT 2000") as cur:
            rows = await cur.fetchall()
    items = [json.loads(r[0]) for r in rows]
    if q:
        ql = q.lower()
        items = [e for e in items if ql in e.get("message", "").lower() or ql in e.get("raw", "").lower()]
    if tag:
        items = [e for e in items if tag in e.get("tags", [])]
    if severity:
        items = [e for e in items if e.get("severity") == severity]
    return items[:limit]

async def save_knowledge_object(
    obj_type: str,
    obj: dict
):

    async with aiosqlite.connect(
        DB_PATH
    ) as db:

        await db.execute(

            """

            INSERT OR REPLACE INTO knowledge_objects (

                id,
                type,
                name,
                data

            )

            VALUES (?, ?, ?, ?)

            """,

            (

                obj["id"],
                obj_type,
                obj["name"],
                json.dumps(obj)

            )

        )

        await db.commit()


async def get_knowledge_objects():

    async with aiosqlite.connect(
        DB_PATH
    ) as db:

        cursor = await db.execute(

            """

            SELECT
                id,
                type,
                name,
                tag,
                content,
                created_at

            FROM knowledge_objects

            ORDER BY rowid DESC

            """

        )

        rows = await cursor.fetchall()

        objects = []

        for row in rows:

            objects.append({

                "id": row[0],

                "type": row[1],

                "name": row[2],

                "tag": row[3],

                "content": row[4],

                "created_at": row[5],

            })

        return objects


async def db_get_setting(key: str) -> str | None:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT value FROM settings WHERE key = ?", (key,)) as cur:
            row = await cur.fetchone()
    return row[0] if row else None


async def db_set_setting(key: str, value: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
        await db.commit()


# ---------------------------------------------------------------------------
# Splunk connection state (in-process, not persisted — reconnect on restart)
# ---------------------------------------------------------------------------

splunk_state = SplunkConnectionState()
splunk_session: httpx.AsyncClient | None = None  # authenticated session


async def splunk_request(method: str, path: str, **kwargs) -> httpx.Response:
    """Make an authenticated request to the connected Splunk instance."""
    if not splunk_state.connected or splunk_session is None:
        raise HTTPException(503, "Not connected to Splunk. Please connect first via /splunk/connect")
    base = f"{splunk_state.scheme}://{splunk_state.host}:{splunk_state.port}"
    url = f"{base}{path}"
    resp = await splunk_session.request(method, url, **kwargs)
    return resp


# ---------------------------------------------------------------------------
# Auto-tagger
# ---------------------------------------------------------------------------

async def auto_tag(message: str, raw: str) -> list[str]:
    text = f"{message}\n{raw}".lower()
    tags_data = await db_get_all("tags")
    matched = []
    for t in tags_data:
        rule = t.get("rule")
        if not rule:
            continue
        try:
            if re.search(rule, text, re.IGNORECASE):
                matched.append(t["id"])
                # bump count
                t["count"] = t.get("count", 0) + 1
                await db_upsert("tags", t["id"], t)
        except re.error:
            continue
    return matched


# ---------------------------------------------------------------------------
# WebSocket hub
# ---------------------------------------------------------------------------

ws_clients: set[WebSocket] = set()


async def broadcast(msg: dict) -> None:
    dead = []
    payload = json.dumps(msg, default=str)
    for ws in ws_clients:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        ws_clients.discard(ws)


# ---------------------------------------------------------------------------
# Activity helper
# ---------------------------------------------------------------------------

async def log_activity(action: str, target: str | None = None, actor: str = "user") -> None:
    entry = ActivityEntry(actor=actor, action=action, target=target)
    d = entry.model_dump()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO activity (id, at, data) VALUES (?, ?, ?)",
            (entry.id, entry.at, json.dumps(d))
        )
        # keep last 500
        await db.execute("DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY at DESC LIMIT 500)")
        await db.commit()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Splunk KnowBot", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:

    await init_db()

    # -----------------------------------
    # RESTORE SAVED SPLUNK CONNECTION
    # -----------------------------------

    conn_json = await db_get_setting(
        "splunk_connection"
    )

    if conn_json:

        try:

            saved = json.loads(
                conn_json
            )

            splunk_state.host = saved.get(
                "host",
                ""
            )

            splunk_state.port = saved.get(
                "port",
                8089
            )

            splunk_state.username = saved.get(
                "username",
                ""
            )

            splunk_state.scheme = saved.get(
                "scheme",
                "https"
            )

        except Exception:

            pass

    # -----------------------------------
    # SYSTEM STARTUP ACTIVITY
    # -----------------------------------

    await log_activity(
        "startup completed",
        actor="system"
    )

    # -----------------------------------
    # START LIVE METRICS LOOP
    # -----------------------------------

    asyncio.create_task(
        _metrics_loop()
    )


async def _metrics_loop() -> None:

    while True:

        await asyncio.sleep(5)

        total_logs = len(

            await db_search_logs(
                None,
                None,
                None,
                100000
            )

        )

        await broadcast({

            "type": "metrics",

            "data": {

                "eps": total_logs,

                "errorRate": 0,

            }

        })



# ============================================================================
# SPLUNK CONNECTIVITY
# ============================================================================

@app.post("/splunk/connect")
async def splunk_connect(req: SplunkConnectRequest) -> SplunkConnectionState:
    """
    Connect to a Splunk instance at the given IP/hostname.
    Uses Splunk REST API (port 8089 by default) with username + password.
    No token needed — this mimics Splunk's own login flow.
    """
    global splunk_session

    # Build base URL
    base = f"{req.scheme}://{req.host}:{req.port}"

    # Create a new client that ignores self-signed certs (common in enterprise Splunk)
    client = httpx.AsyncClient(verify=False, timeout=15)

    try:
        # Authenticate against Splunk REST API
        resp = await client.post(
            f"{base}/services/auth/login",
            data={"username": req.username, "password": req.password, "output_mode": "json"},
        )

        if resp.status_code != 200:
            try:
                detail = resp.json().get("messages", [{}])[0].get("text", resp.text[:200])
            except Exception:
                detail = resp.text[:200]
            splunk_state.connected = False
            splunk_state.error = f"Splunk auth failed ({resp.status_code}): {detail}"
            return splunk_state

        data = resp.json()
        token = data.get("sessionKey") or data.get("data", {}).get("token", "")
        if not token:
            splunk_state.connected = False
            splunk_state.error = "No session token in response. Check credentials."
            return splunk_state

        # Store authenticated client
        splunk_session = httpx.AsyncClient(
            verify=False,
            timeout=30,
            headers={"Authorization": f"Splunk {token}"},
        )

        # Fetch server info to confirm connectivity
        info_resp = await splunk_session.get(
            f"{base}/services/server/info?output_mode=json"
        )
        version = "unknown"
        if info_resp.status_code == 200:
            info = info_resp.json()
            version = info.get("entry", [{}])[0].get("content", {}).get("version", "unknown")

        splunk_state.connected = True
        splunk_state.host = req.host
        splunk_state.port = req.port
        splunk_state.username = req.username
        splunk_state.scheme = req.scheme
        splunk_state.version = version
        splunk_state.error = None

        # Persist connection info (without password)
        await db_set_setting("splunk_connection", json.dumps({
            "host": req.host, "port": req.port,
            "username": req.username, "scheme": req.scheme,
        }))
        await log_activity("connected to Splunk", f"{req.host}:{req.port}", req.username)
        return splunk_state

    except httpx.ConnectError as e:
        splunk_state.connected = False
        splunk_state.error = f"Cannot reach {req.host}:{req.port} — {e}. Check IP, port, and that Splunk is running."
        return splunk_state
    except httpx.TimeoutException:
        splunk_state.connected = False
        splunk_state.error = f"Connection to {req.host}:{req.port} timed out. Verify firewall allows port {req.port}."
        return splunk_state
    except Exception as e:
        splunk_state.connected = False
        splunk_state.error = str(e)
        return splunk_state


@app.post("/splunk/disconnect")
async def splunk_disconnect() -> SplunkConnectionState:
    global splunk_session
    splunk_state.connected = False
    splunk_state.error = None
    splunk_session = None
    await log_activity("disconnected from Splunk")
    return splunk_state


@app.get("/splunk/status")
async def splunk_status() -> SplunkConnectionState:
    return splunk_state


@app.post("/splunk/search")
async def splunk_search(req: SplunkSearchRequest) -> dict:
    """
    Run an SPL search on the connected Splunk instance.
    Returns results + field list.
    """
    if not splunk_state.connected or splunk_session is None:
        raise HTTPException(503, "Not connected to Splunk")

    base = f"{splunk_state.scheme}://{splunk_state.host}:{splunk_state.port}"

    # Submit search job
    job_resp = await splunk_session.post(
        f"{base}/services/search/jobs",
        data={
            "search": f"search {req.spl}" if not req.spl.strip().startswith("search") else req.spl,
            "earliest_time": req.earliest,
            "latest_time": req.latest,
            "output_mode": "json",
            "count": req.max_count,
        }
    )
    if job_resp.status_code not in (200, 201):
        raise HTTPException(400, f"Search job creation failed: {job_resp.text[:300]}")

    sid = job_resp.json().get("sid")
    if not sid:
        raise HTTPException(500, "No SID returned from Splunk")

    # Poll until done
    for _ in range(30):
        await asyncio.sleep(1)
        status_resp = await splunk_session.get(
            f"{base}/services/search/jobs/{sid}?output_mode=json"
        )
        if status_resp.status_code == 200:
            st = status_resp.json()["entry"][0]["content"]
            if st.get("isDone"):
                break

    # Fetch results
    results_resp = await splunk_session.get(
        f"{base}/services/search/jobs/{sid}/results?output_mode=json&count={req.max_count}"
    )
    if results_resp.status_code != 200:
        raise HTTPException(500, f"Failed to fetch results: {results_resp.text[:200]}")

    data = results_resp.json()
    results = data.get("results", [])
    fields = data.get("fields", [])

    await log_activity("ran SPL search", req.spl[:60])
    return {"results": results, "fields": fields, "count": len(results), "sid": sid}


@app.get("/splunk/indexes")
async def splunk_indexes() -> list[str]:
    """List available indexes from Splunk."""
    if not splunk_state.connected or splunk_session is None:
        raise HTTPException(503, "Not connected to Splunk")
    base = f"{splunk_state.scheme}://{splunk_state.host}:{splunk_state.port}"
    resp = await splunk_session.get(f"{base}/services/data/indexes?output_mode=json&count=100")
    if resp.status_code != 200:
        return []
    entries = resp.json().get("entry", [])
    return [e["name"] for e in entries if not e["name"].startswith("_")]


@app.get("/splunk/sourcetypes")
async def splunk_sourcetypes() -> list[str]:
    """List available sourcetypes."""
    if not splunk_state.connected or splunk_session is None:
        raise HTTPException(503, "Not connected to Splunk")
    base = f"{splunk_state.scheme}://{splunk_state.host}:{splunk_state.port}"
    resp = await splunk_session.get(
        f"{base}/services/search/jobs/export?search=search index=* | stats count by sourcetype | head 50&output_mode=json&earliest_time=-7d"
    )
    # Simple fallback
    return ["syslog", "windows:security", "linux:auth", "web:nginx", "edr:crowdstrike"]


@app.post("/splunk/ingest-events")
async def splunk_ingest_events(body: dict) -> dict:
    """
    Pull recent events from Splunk,
    categorize them,
    apply custom tag rules,
    and store them locally.
    """

    result = await splunk_search(
        SplunkSearchRequest(**body)
    )

    ingested = 0

    for row in result["results"]:

        raw_message = row.get(
            "_raw",
            str(row)
        )

        # ---------------------------------
        # BUILT-IN AUTO CATEGORIZATION
        # ---------------------------------

        detected_tags = categorize_log(
            raw_message
        )
        # ---------------------------------
        # MATCH CUSTOM TAG RULES
        # ---------------------------------

        all_tag_rules = await get_all_tag_rules()

        for tag_rule in all_tag_rules:

            keywords = tag_rule.get(
                "rule",
                []
            )

            for keyword in keywords:

                if (
                    keyword.lower()
                    in
                    raw_message.lower()
                ):

                    already_exists = False

                    for t in detected_tags:

                        if (
                            t["tag"]
                            ==
                            tag_rule["tag"]
                        ):

                            already_exists = True

                    if not already_exists:

                        detected_tags.append({

                            "tag":
                                tag_rule["tag"],

                            "category":
                                "Custom",

                            "severity":
                                "medium",

                            "mitre":
                                [],

                            "rule":
                                keywords

                        })

                    break
                
        # ---------------------------------
        # EXTRACT TAG NAMES
        # ---------------------------------

        tags = [
            t["tag"]
            for t in detected_tags
        ]

        # ---------------------------------
        # CREATE LOG EVENT
        # ---------------------------------

        log = LogEvent(

            timestamp=row.get(
                "_time",
                _now()
            ),

            source=row.get(
                "source",
                "splunk"
            ),

            sourcetype=row.get(
                "sourcetype",
                "splunk"
            ),

            host=row.get(
                "host",
                "splunk-host"
            ),

            user=row.get(
                "user"
            ) or row.get(
                "User"
            ),

            message=raw_message[:500],

            raw=raw_message[:2000],

            severity=_infer_severity(
                row
            ),

            tags=tags,

            fields={
                k: v
                for k, v in row.items()
                if not k.startswith("_")
            },

        )

        await db_upsert_log(
            log.model_dump()
        )

        ingested += 1

    await log_activity(
        "ingested events from Splunk",
        f"{ingested} events"
    )

    return {
        "ingested": ingested
    }


def _infer_severity(row: dict) -> str:

    sev_fields = [
        "severity",
        "level",
        "priority",
        "urgency"
    ]

    for f in sev_fields:

        val = str(
            row.get(f, "")
        ).lower()

        if val in (
            "critical",
            "high",
            "medium",
            "low",
            "info"
        ):
            return val

    raw = row.get(
        "_raw",
        ""
    ).lower()

    if (
        "critical" in raw
        or
        "emergency" in raw
    ):
        return "critical"

    if (
        "error" in raw
        or
        "fail" in raw
    ):
        return "high"

    if "warn" in raw:
        return "medium"

    return "info"

@app.patch("/logs/{log_id}/tags")
async def update_log_tags(
    log_id: str,
    body: dict
):

    new_tags = body.get(
        "tags",
        []
    )

    async with aiosqlite.connect(DB_PATH) as db:

        cursor = await db.execute(
            """
            SELECT data
            FROM logs
            WHERE id = ?
            """,
            (log_id,)
        )

        row = await cursor.fetchone()

        if not row:

            raise HTTPException(
                status_code=404,
                detail="Log not found"
            )

        log_data = json.loads(
            row[0]
        )

        old_tags = log_data.get(
            "tags",
            []
        )

        # UPDATE LOG TAGS
        log_data["tags"] = new_tags

        await db.execute(
            """
            UPDATE logs
            SET data = ?
            WHERE id = ?
            """,
            (
                json.dumps(log_data),
                log_id
            )
        )

        # -----------------------------------
        # UPDATE TAG COUNTS
        # -----------------------------------

        for tag in old_tags:

            await db.execute(
                """
                UPDATE tags
                SET count = CASE
                    WHEN count > 0
                    THEN count - 1
                    ELSE 0
                END
                WHERE name = ?
                """,
                (tag,)
            )

        for tag in new_tags:

            cursor = await db.execute(
                """
                SELECT id
                FROM tags
                WHERE name = ?
                """,
                (tag,)
            )

            existing = await cursor.fetchone()

            if existing:

                await db.execute(
                    """
                    UPDATE tags
                    SET count = count + 1
                    WHERE name = ?
                    """,
                    (tag,)
                )

        await db.commit()

    return {

        "updated": log_id,

        "tags": new_tags

    }


# ============================================================================
# TAGS
# ============================================================================
@app.get("/tags/{tag_name}/knowledge-objects")
async def get_tag_knowledge_objects(
    tag_name: str
):

    return {

        "tag": tag_name,

        "objects": [

            {

                "type":
                    "dashboard_studio",

                "name":
                    f"{tag_name} Dashboard Studio",

                "description":
                    "Interactive dashboard visualizations"

            },

            {

                "type":
                    "classic_dashboard",

                "name":
                    f"{tag_name} Classic Dashboard",

                "description":
                    "Traditional Splunk dashboard"

            },

            {

                "type":
                    "visualization",

                "name":
                    f"{tag_name} Visualization Builder",

                "description":
                    "Create charts and analytics"

            }

        ]

    }

@app.get("/tags/{tag_name}/logs")
async def get_logs_by_tag(
    tag_name: str
):

    logs = await db_search_logs(
        None,
        None,
        None,
        1000
    )

    matched_logs = []

    for log in logs:

        log_tags = log.get(
            "tags",
            []
        )

        if tag_name in log_tags:

            matched_logs.append(
                log
            )

    return matched_logs

@app.get("/tags")
async def list_tags():

    return await get_all_tags()


@app.post("/tags")
async def create_tag(body: dict):

    tag_data = {

        "tag":
            body.get("name"),

        "category":
            body.get(
                "category",
                "Custom"
            ),

        "severity":
            body.get(
                "severity",
                "medium"
            ),

        "mitre":
            body.get(
                "mitre",
                []
            ),

        "rule":
            body.get(
                "rule",
                ""
            )

    }

    await ensure_tag_exists(
        tag_data
    )

    await log_activity(
        "created tag",
        tag_data["tag"]
    )

    return {
        "success": True
    }


@app.patch("/tags/{tag_id}")
async def patch_tag(tag_id: str, body: dict) -> Tag:
    all_tags = await db_get_all("tags")
    t = next((x for x in all_tags if x["id"] == tag_id), None)
    if not t:
        raise HTTPException(404, "Tag not found")
    for k, v in body.items():
        if k not in ("id", "createdAt"):
            t[k] = v
    tag = Tag(**t)
    await db_upsert("tags", tag_id, tag.model_dump())
    await log_activity("updated tag", tag.name)
    return tag


@app.delete("/tags/{tag_id}", status_code=200)
async def delete_tag(tag_id: str):
    all_tags = await db_get_all("tags")
    t = next((x for x in all_tags if x["id"] == tag_id), None)

    if t:
        await db_delete("tags", tag_id)
        await log_activity("deleted tag", t.get("name"))

        return {
            "success": True,
            "message": "Tag deleted successfully"
        }

    return {
        "success": False,
        "message": "Tag not found"
    }


@app.get("/tags/{tag_id}/drilldown")
async def tag_drilldown(tag_id: str) -> dict:
    all_tags = await db_get_all("tags")
    tag_data = next((x for x in all_tags if x["id"] == tag_id), None)
    if not tag_data:
        raise HTTPException(404, "Tag not found")
    tag = Tag(**tag_data)

    all_logs = await db_search_logs(None, tag_id, None, 500)
    events = sorted(all_logs, key=lambda e: e.get("timestamp", ""), reverse=True)[:200]

    hosts = Counter(e.get("host", "") for e in events).most_common(10)
    users = Counter(e.get("user") for e in events if e.get("user")).most_common(10)
    bins: dict[str, int] = defaultdict(int)
    for e in events:
        bucket = (e.get("timestamp") or "")[:13]
        bins[bucket] += 1

    all_kos = await db_get_all("knowledge_objects")
    related_alerts = [
        {"id": k["id"], "name": k["name"], "severity": k.get("config", {}).get("severity", "medium")}
        for k in all_kos if k.get("type") == "alert" and tag_id in k.get("tags", [])
    ]
    rec_dashboards = [
        {"id": k["id"], "name": k["name"]}
        for k in all_kos if k.get("type") == "dashboard" and tag_id in k.get("tags", [])
    ]
    iocs = []
    for e in events[:20]:
        ip = (e.get("fields") or {}).get("src_ip")
        if ip:
            iocs.append({"type": "ip", "value": str(ip), "score": 70})

    return {
        "tag": tag.model_dump(),
        "events": events,
        "hosts": [{"host": h, "count": c} for h, c in hosts],
        "users": [{"user": u, "count": c} for u, c in users],
        "timeline": [{"t": k, "count": v} for k, v in sorted(bins.items())],
        "spl": tag.rule or f'index=* | search "{tag.name}"',
        "relatedAlerts": related_alerts,
        "recommendedDashboards": rec_dashboards,
        "mitre": [{"id": m, "name": m, "tactic": "unknown"} for m in tag.mitre],
        "iocs": iocs,
        "threatScore": min(99, len(events) * 2 + (40 if tag.severity in ("high", "critical") else 10)),
    }

@app.get("/generate/dashboard/{tag_name}")
async def api_generate_dashboard(
    tag_name: str
):

    dashboard = generate_dashboard(
        tag_name
    )

    await save_knowledge_object(
        "dashboard",
        dashboard
    )

    return dashboard


@app.get("/generate/alert/{tag_name}")
async def api_generate_alert(
    tag_name: str
):

    alert = generate_alert(
        tag_name
    )

    await save_knowledge_object(
        "alert",
        alert
    )

    return alert


@app.get("/generate/lookup/{tag_name}")
async def api_generate_lookup(
    tag_name: str
):

    lookup = generate_lookup(
        tag_name
    )

    await save_knowledge_object(
        "lookup",
        lookup
    )

    return lookup

@app.get("/knowledge-objects")
async def api_get_knowledge_objects():

    return await get_knowledge_objects()

# ============================================================================
# LOGS
# ============================================================================

@app.get("/logs/search")
async def search_logs(
    q: str | None = None,
    tag: str | None = None,
    severity: str | None = None,
    limit: int = Query(200, le=1000),
) -> list[LogEvent]:
    items = await db_search_logs(q, tag, severity, limit)
    return [LogEvent(**i) for i in items]

@app.delete("/logs/{log_id}")
async def delete_log(log_id: str):

    async with aiosqlite.connect(DB_PATH) as db:

        await db.execute(
            "DELETE FROM logs WHERE id = ?",
            (log_id,)
        )

        await db.commit()

    return {
        "deleted": log_id
    }


@app.post("/logs/ingest")
async def ingest_log(body: dict) -> LogEvent:
    if "message" not in body:
        raise HTTPException(400, "message required")
    body.setdefault("raw", body["message"])
    log = LogEvent(**body)
    log.tags = []
    await db_upsert_log(log.model_dump())
    await broadcast({"type": "log", "data": log.model_dump()})
    return log


# ============================================================================
# KNOWLEDGE OBJECTS
# ============================================================================

@app.get("/knowledge-objects")
async def list_kos() -> list[KnowledgeObject]:
    data = await db_get_all("knowledge_objects")
    return [KnowledgeObject(**d) for d in data]


@app.post("/knowledge-objects")
async def create_ko(body: dict) -> KnowledgeObject:
    for k in ("id", "version", "createdAt", "updatedAt", "history"):
        body.pop(k, None)
    ko = KnowledgeObject(**body)
    ko.history = [KoHistoryEntry(version=1, at=ko.createdAt, note="created", config=ko.config)]
    await db_upsert("knowledge_objects", ko.id, ko.model_dump())
    await log_activity(f"created {ko.type}", ko.name)
    return ko


@app.patch("/knowledge-objects/{ko_id}")
async def patch_ko(ko_id: str, body: dict) -> KnowledgeObject:
    all_kos = await db_get_all("knowledge_objects")
    existing = next((x for x in all_kos if x["id"] == ko_id), None)
    if not existing:
        raise HTTPException(404, "Not found")
    note = body.pop("note", "updated")
    for k, v in body.items():
        if k not in ("id", "createdAt", "version", "history"):
            existing[k] = v
    ko = KnowledgeObject(**existing)
    ko.version += 1
    ko.updatedAt = _now()
    ko.history.append(KoHistoryEntry(version=ko.version, at=ko.updatedAt, note=note, config=ko.config))
    await db_upsert("knowledge_objects", ko_id, ko.model_dump())
    await log_activity(f"updated {ko.type}", ko.name)
    return ko


@app.delete("/knowledge-objects/{ko_id}", status_code=200)
async def delete_ko(ko_id: str):
    all_kos = await db_get_all("knowledge_objects")
    ko = next((x for x in all_kos if x["id"] == ko_id), None)

    if ko:
        await db_delete("knowledge_objects", ko_id)
        await log_activity("deleted knowledge object", ko.get("name"))

        return {
            "success": True,
            "message": "Knowledge object deleted successfully"
        }

    return {
        "success": False,
        "message": "Knowledge object not found"
    }


@app.post("/knowledge-objects/{ko_id}/rollback")
async def rollback_ko(ko_id: str, body: dict) -> KnowledgeObject:
    all_kos = await db_get_all("knowledge_objects")
    existing = next((x for x in all_kos if x["id"] == ko_id), None)
    if not existing:
        raise HTTPException(404, "Not found")
    ko = KnowledgeObject(**existing)
    target = next((h for h in ko.history if h.version == body.get("version")), None)
    if not target:
        raise HTTPException(400, "Version not found")
    ko.config = target.config
    ko.version += 1
    ko.updatedAt = _now()
    ko.history.append(KoHistoryEntry(version=ko.version, at=ko.updatedAt, note=f"rollback to v{target.version}", config=target.config))
    await db_upsert("knowledge_objects", ko_id, ko.model_dump())
    return ko


# ============================================================================
# AI ASSISTANT
# ============================================================================

@app.post("/ai/generate")
async def ai_generate(body: AIRequest) -> dict:
    """
    AI generation endpoint. If provider+apiKey provided, calls real AI.
    Otherwise uses smart templates.
    """
    all_tags = await db_get_all("tags")
    tag = next((Tag(**t) for t in all_tags if t["id"] == body.tagId), None) if body.tagId else None
    tag_name = tag.name if tag else "event"

    # --- Real AI call if provider configured ---
    if body.provider and body.apiKey:
        system_prompt = f"""You are a Splunk security analyst assistant helping with {body.mode} generation.
Context: {'Tag: ' + tag.name + ' (' + (tag.rule or '') + ')' if tag else 'No specific tag context.'}
For SPL mode: generate valid Splunk SPL queries.
For regex mode: generate Python/Splunk-compatible regex with named groups.
For alert mode: generate JSON alert config with name, search SPL, trigger conditions.
For dashboard mode: generate JSON dashboard config with panel definitions.
For explain mode: explain the SPL query in plain English.
For chat mode: answer Splunk questions helpfully.
Be concise and technical."""

        try:
            if body.provider == "anthropic":
                import anthropic
                client = anthropic.Anthropic(api_key=body.apiKey)
                msg = client.messages.create(
                    model=body.model or "claude-3-5-haiku-20241022",
                    max_tokens=1024,
                    system=system_prompt,
                    messages=[{"role": "user", "content": body.prompt}],
                )
                output = msg.content[0].text

            elif body.provider == "openai":
                import openai
                client = openai.OpenAI(api_key=body.apiKey)
                resp = client.chat.completions.create(
                    model=body.model or "gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": body.prompt},
                    ],
                    max_tokens=1024,
                )
                output = resp.choices[0].message.content

            else:
                output = f"Unknown provider: {body.provider}"

            await log_activity(f"AI {body.mode}", body.prompt[:40])
            return {"output": output, "explanation": None}

        except Exception as e:
            return {"output": f"AI call failed: {str(e)}\n\nFalling back to template.", "explanation": None}

    # --- Template fallback ---
    if body.mode == "spl":
        tag_filter = f'tag="{tag_name}"' if tag else f'"{body.prompt[:40]}"'
        out = (
            f"index=* sourcetype=* {tag_filter}\n"
            f"| stats count by host, user, src_ip\n| sort -count\n| head 20"
        )
    elif body.mode == "regex":
        out = r"(?P<timestamp>\d{4}-\d{2}-\d{2}T[\d:]+)\s+(?P<level>\w+)\s+(?P<host>[\w.-]+)\s+(?P<message>.+)"
    elif body.mode == "alert":
        out = json.dumps({
            "name": f"Alert: {tag_name}",
            "search": f'index=* tag="{tag_name}" | stats count by host | where count > 5',
            "schedule": {"cron": "*/5 * * * *"},
            "trigger": {"type": "number_of_results", "operator": ">", "value": 0},
            "severity": tag.severity if tag else "medium",
            "actions": ["email", "webhook"],
        }, indent=2)
    elif body.mode == "dashboard":
        out = json.dumps({
            "title": f"{tag_name} Overview",
            "panels": [
                {"id": "p1", "type": "timechart", "title": "Events over time",
                 "spl": f'index=* tag="{tag_name}" | timechart count span=1h'},
                {"id": "p2", "type": "table", "title": "Top Hosts",
                 "spl": f'index=* tag="{tag_name}" | top host limit=10'},
                {"id": "p3", "type": "single", "title": "Total Events",
                 "spl": f'index=* tag="{tag_name}" | stats count'},
            ],
        }, indent=2)
    elif body.mode == "explain":
        out = (
            f"This query searches all indexed data{' filtered by tag ' + tag_name if tag else ''}. "
            "It aggregates results by host and user to surface the most active sources. "
            "Useful for identifying compromised hosts or suspicious accounts."
        )
    else:
        out = (
            f"I can help you with Splunk knowledge objects, tag management, SPL queries, alerts, and dashboards.\n\n"
            f"Your question: '{body.prompt}'\n\n"
            f"Tip: Select a mode (SPL, Regex, Alert, Dashboard) for targeted generation, or connect an AI provider (Anthropic/OpenAI) in Settings for real AI responses."
        )

    await log_activity(f"generated {body.mode} (template)", tag_name)
    return {"output": out, "explanation": "Template generation. Add AI API key in Settings for real AI."}


# ============================================================================
# INTEGRATIONS
# ============================================================================

@app.get("/integrations")
async def list_integrations() -> list[Integration]:
    data = await db_get_all("integrations")
    return [Integration(**d) for d in data]


@app.post("/integrations")
async def create_integration(body: dict) -> Integration:
    for k in ("id", "status", "lastSeen"):
        body.pop(k, None)
    i = Integration(**body)
    await db_upsert("integrations", i.id, i.model_dump())
    await log_activity("added integration", i.name)
    return i


@app.post("/integrations/{int_id}/test")
async def test_integration(int_id: str) -> dict:
    data = await db_get_all("integrations")
    i_data = next((x for x in data if x["id"] == int_id), None)
    if not i_data:
        raise HTTPException(404)
    i = Integration(**i_data)
    t0 = time.time()
    try:
        async with httpx.AsyncClient(verify=False, timeout=8) as client:
            headers = {"Authorization": i.authHeader} if i.authHeader else {}
            r = await client.get(i.url, headers=headers)
        latency = int((time.time() - t0) * 1000)
        i.status = "healthy" if r.status_code < 400 else "degraded"
        i.lastSeen = _now()
        await db_upsert("integrations", int_id, i.model_dump())
        return {"ok": r.status_code < 400, "latencyMs": latency, "status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        i.status = "down"
        i.lastSeen = _now()
        await db_upsert("integrations", int_id, i.model_dump())
        return {"ok": False, "latencyMs": int((time.time() - t0) * 1000), "status": 0, "body": str(e)}


@app.delete("/integrations/{int_id}", status_code=200)
async def delete_integration(int_id: str):
    data = await db_get_all("integrations")
    i = next((x for x in data if x["id"] == int_id), None)

    if i:
        await db_delete("integrations", int_id)
        await log_activity("removed integration", i.get("name"))

        return {"success": True, "message": "Integration deleted successfully"}

    return {"success": False, "message": "Integration not found"}


# ============================================================================
# ACTIVITY
# ============================================================================

@app.get("/activity")
async def list_activity() -> list[ActivityEntry]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT data FROM activity ORDER BY at DESC LIMIT 200") as cur:
            rows = await cur.fetchall()
    return [ActivityEntry(**json.loads(r[0])) for r in rows]


# ============================================================================
# SETTINGS (AI provider config)
# ============================================================================

@app.get("/settings/ai")
async def get_ai_settings() -> dict:
    val = await db_get_setting("ai_config")
    if val:
        cfg = json.loads(val)
        # Mask the key
        if cfg.get("apiKey"):
            cfg["apiKey"] = cfg["apiKey"][:8] + "..." + cfg["apiKey"][-4:]
        return cfg
    return {"provider": None, "model": None, "hasKey": False}


@app.post("/settings/ai")
async def save_ai_settings(body: dict) -> dict:
    await db_set_setting("ai_config", json.dumps(body))
    return {"ok": True}


# ============================================================================
# WEBSOCKET
# ============================================================================

@app.websocket("/ws/stream")
async def ws_stream(ws: WebSocket) -> None:
    await ws.accept()
    ws_clients.add(ws)
    try:
        while True:
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        ws_clients.discard(ws)


# ============================================================================
# HEALTH
# ============================================================================

@app.get("/health")
async def health() -> dict:
    tag_count = len(await db_get_all("tags"))
    ko_count = len(await db_get_all("knowledge_objects"))
    return {
        "ok": True,
        "splunk_connected": splunk_state.connected,
        "splunk_host": splunk_state.host if splunk_state.connected else None,
        "tags": tag_count,
        "knowledge_objects": ko_count,
    }
