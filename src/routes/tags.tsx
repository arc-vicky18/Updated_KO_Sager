import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import DashboardView from "@/components/dashboard-view";

export const Route = createFileRoute("/tags")({
  component: TagStudio,
});

function TagStudio() {

  const [tags, setTags] = useState<any[]>([]);

  const [selectedLogs, setSelectedLogs] = useState<any[]>([]);

  const [knowledgeObjects, setKnowledgeObjects] = useState<any[]>([]);

  const [selectedTag, setSelectedTag] = useState("");

  const [showDashboard, setShowDashboard] = useState(false);

  const [generatedSpl, setGeneratedSpl] = useState("");

  useEffect(() => {

    fetch("http://127.0.0.1:8001/tags")

      .then(res => res.json())

      .then(data => {

        setTags(data);

      });

  }, []);

  async function openTagLogs(
    tagName: string
  ) {

    setSelectedTag(
      tagName
    );

    setShowDashboard(
      false
    );

    const logsRes = await fetch(

      `http://127.0.0.1:8001/tags/${encodeURIComponent(tagName)}/logs`

    );

    const logsData = await logsRes.json();

    setSelectedLogs(
      logsData
    );

    const koRes = await fetch(

      `http://127.0.0.1:8001/tags/${encodeURIComponent(tagName)}/knowledge-objects`

    );

    const koData = await koRes.json();

    setKnowledgeObjects(
      koData.objects
    );

  }

  async function generateDashboard() {

    const res = await fetch(

      `http://127.0.0.1:8001/generate/dashboard/${selectedTag}`

    );

    const data = await res.json();

    console.log(data);

    setShowDashboard(
      true
    );

  }

  async function generateAlert() {

    const res = await fetch(

      `http://127.0.0.1:8001/generate/alert/${selectedTag}`

    );

    const data = await res.json();

    console.log(data);

    alert(
      "Alert Generated Successfully"
    );

  }

  async function generateLookup() {

    const res = await fetch(

      `http://127.0.0.1:8001/generate/lookup/${selectedTag}`

    );

    const data = await res.json();

    console.log(data);

    alert(
      "Lookup Generated Successfully"
    );

  }

  async function generateSpl() {

    const res = await fetch(

      `http://127.0.0.1:8001/generate/dashboard/${selectedTag}`

    );

    const data = await res.json();

    setGeneratedSpl(
      data.spl
    );

  }

  return (

    <div className="p-6">

      {/* ================================= */}
      {/* HEADER */}
      {/* ================================= */}

      <div className="mb-8">

        <div className="text-xs uppercase tracking-widest text-muted-foreground">

          Intelligence Repository

        </div>

        <h1 className="text-3xl font-semibold mt-2">

          Tag Studio

        </h1>

        <p className="text-sm text-muted-foreground mt-2">

          Real-time backend-driven intelligence tags.

        </p>

      </div>

      {/* ================================= */}
      {/* TAG CARDS */}
      {/* ================================= */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">

        {tags.map((tag, idx) => (

          <div
            key={idx}
            onClick={() => openTagLogs(tag.name)}
            className={`

              rounded-2xl
              border
              p-5
              cursor-pointer
              transition-all
              bg-card

              ${selectedTag === tag.name
                ? "border-cyan-400 shadow-lg shadow-cyan-500/10"
                : "border-border hover:border-cyan-400"}

            `}
          >

            <div className="flex items-center gap-3 mb-3">

              <span
                className="size-3 rounded-full bg-cyan-400"
              />

              <h3 className="text-lg font-semibold">

                {tag.name}

              </h3>

            </div>

            <div className="text-sm text-muted-foreground mb-4">

              {tag.category}

            </div>

            <div className="space-y-1 text-sm">

              <div>

                Events:
                {" "}
                <span className="text-cyan-400">

                  {tag.count || 0}

                </span>

              </div>

              <div>

                Severity:
                {" "}
                <span className="capitalize">

                  {tag.severity}

                </span>

              </div>

            </div>

          </div>

        ))}

      </div>

      {/* ================================= */}
      {/* TAG DRILLDOWN */}
      {/* ================================= */}

      {selectedTag && (

        <div className="grid grid-cols-12 gap-6">

          {/* ================================= */}
          {/* LEFT */}
          {/* ================================= */}

          <div className="col-span-9">

            <div className="mb-6">

              <h2 className="text-3xl font-semibold">

                {selectedTag}

              </h2>

              <div className="text-sm text-muted-foreground mt-2">

                Intelligence objects and associated logs.

              </div>

            </div>

            {/* ============================= */}
            {/* KNOWLEDGE OBJECTS */}
            {/* ============================= */}

            <div className="flex flex-wrap gap-3 mb-8">

              {knowledgeObjects.map((obj, idx) => (

                <button
                  key={idx}
                  onClick={() => {

                    if (
                      obj.type === "dashboard_studio"
                    ) {

                      setShowDashboard(
                        true
                      );

                    }

                  }}
                  className="

                    px-4
                    py-2
                    rounded-lg
                    border
                    border-cyan-500
                    text-cyan-400
                    hover:bg-cyan-500/10
                    transition-all

                  "
                >

                  {obj.name}

                </button>

              ))}

            </div>

            {/* ============================= */}
            {/* GENERATED SPL */}
            {/* ============================= */}

            {generatedSpl && (

              <div className="mb-8 rounded-xl border border-border bg-card p-5">

                <div className="text-lg font-semibold mb-4">

                  Generated SPL

                </div>

                <pre className="text-sm text-cyan-400 whitespace-pre-wrap">

                  {generatedSpl}

                </pre>

              </div>

            )}

            {/* ============================= */}
            {/* DASHBOARD */}
            {/* ============================= */}

            {showDashboard && (

              <div className="mb-8">

                <DashboardView
                  logs={selectedLogs}
                  tag={selectedTag}
                />

              </div>

            )}

            {/* ============================= */}
            {/* LOGS */}
            {/* ============================= */}

            <div className="space-y-4">

              {selectedLogs.map((log, idx) => (

                <div
                  key={idx}
                  className="

                    border
                    border-border
                    rounded-xl
                    p-5
                    bg-card

                  "
                >

                  <div className="text-sm text-cyan-400 mb-2">

                    {log.timestamp}

                  </div>

                  <div className="text-sm mb-2">

                    Host:
                    {" "}
                    <span className="text-white">

                      {log.host}

                    </span>

                  </div>

                  <div className="text-sm mb-2">

                    User:
                    {" "}
                    <span className="text-white">

                      {log.user || "-"}

                    </span>

                  </div>

                  <div className="text-sm mb-3">

                    Severity:
                    {" "}
                    <span className="capitalize">

                      {log.severity}

                    </span>

                  </div>

                  <div className="text-sm break-all text-muted-foreground">

                    {log.message}

                  </div>

                </div>

              ))}

            </div>

          </div>

          {/* ================================= */}
          {/* RIGHT PANEL */}
          {/* ================================= */}

          <div className="col-span-3">

            <div className="sticky top-4 space-y-4">

              {/* ========================== */}
              {/* OVERVIEW */}
              {/* ========================== */}

              <div className="rounded-xl border border-border bg-card p-4">

                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">

                  Tag Drilldown

                </div>

                <div className="text-xl font-semibold mb-2">

                  {selectedTag}

                </div>

                <div className="text-sm text-muted-foreground mb-4">

                  AI-generated intelligence panel.

                </div>

                <div className="grid grid-cols-2 gap-3">

                  <div className="rounded-lg bg-background p-3">

                    <div className="text-xs text-muted-foreground">

                      Events

                    </div>

                    <div className="text-2xl font-bold mt-1 text-cyan-400">

                      {selectedLogs.length}

                    </div>

                  </div>

                  <div className="rounded-lg bg-background p-3">

                    <div className="text-xs text-muted-foreground">

                      Severity

                    </div>

                    <div className="text-2xl font-bold mt-1 text-red-400">

                      high

                    </div>

                  </div>

                </div>

              </div>

              {/* ========================== */}
              {/* ACTIONS */}
              {/* ========================== */}

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">

                <button
                  onClick={generateAlert}
                  className="w-full rounded-lg border border-cyan-500 py-2 text-cyan-400 hover:bg-cyan-500/10"
                >

                  Generate Alert

                </button>

                <button
                  onClick={generateDashboard}
                  className="w-full rounded-lg border border-cyan-500 py-2 text-cyan-400 hover:bg-cyan-500/10"
                >

                  Generate Dashboard

                </button>

                <button
                  onClick={generateSpl}
                  className="w-full rounded-lg border border-cyan-500 py-2 text-cyan-400 hover:bg-cyan-500/10"
                >

                  Generate SPL

                </button>

                <button
                  onClick={generateLookup}
                  className="w-full rounded-lg border border-cyan-500 py-2 text-cyan-400 hover:bg-cyan-500/10"
                >

                  Generate Lookup

                </button>

              </div>

              {/* ========================== */}
              {/* MITRE */}
              {/* ========================== */}

              <div className="rounded-xl border border-border bg-card p-4">

                <div className="text-sm font-semibold mb-3">

                  MITRE ATT&CK

                </div>

                <div className="inline-flex px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs">

                  T1110 - Credential Access

                </div>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}