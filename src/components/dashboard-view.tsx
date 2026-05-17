import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

export default function DashboardView({
  logs,
  tag,
}: any) {

  // =========================
  // METRICS
  // =========================

  const totalEvents = logs.length;

  const criticalEvents = logs.filter(
    (l: any) => l.severity === "critical"
  ).length;

  const highEvents = logs.filter(
    (l: any) => l.severity === "high"
  ).length;

  // =========================
  // TIMELINE
  // =========================

  const timelineData = logs.map(
    (log: any, idx: number) => ({
      time: idx + 1,
      value: 1,
    })
  );

  // =========================
  // SEVERITY DISTRIBUTION
  // =========================

  const severityMap: any = {};

  logs.forEach((log: any) => {

    const sev = log.severity || "info";

    severityMap[sev] =
      (severityMap[sev] || 0) + 1;

  });

  const severityData = Object.keys(
    severityMap
  ).map(key => ({
    name: key,
    value: severityMap[key],
  }));

  // =========================
  // HOST DISTRIBUTION
  // =========================

  const hostMap: any = {};

  logs.forEach((log: any) => {

    const host =
      log.host || "unknown";

    hostMap[host] =
      (hostMap[host] || 0) + 1;

  });

  const hostData = Object.keys(
    hostMap
  ).map(key => ({
    name: key,
    value: hostMap[key],
  }));

  // =========================
  // TOP USERS
  // =========================

  const userMap: any = {};

  logs.forEach((log: any) => {

    const user =
      log.user || "unknown";

    userMap[user] =
      (userMap[user] || 0) + 1;

  });

  const userData = Object.keys(
    userMap
  ).map(key => ({
    name: key,
    count: userMap[key],
  }));

  return (

    <div className="space-y-6">

      {/* ====================== */}
      {/* TITLE */}
      {/* ====================== */}

      <div className="rounded-xl border border-border bg-card p-5">

        <div className="text-2xl font-semibold mb-2">

          {tag} Dashboard

        </div>

        <div className="text-sm text-muted-foreground">

          AI-generated analytics dashboard.

        </div>

      </div>

      {/* ====================== */}
      {/* METRICS */}
      {/* ====================== */}

      <div className="grid grid-cols-4 gap-4">

        <div className="rounded-xl border border-border bg-card p-4">

          <div className="text-xs text-muted-foreground">

            Total Events

          </div>

          <div className="text-3xl font-bold text-cyan-400 mt-2">

            {totalEvents}

          </div>

        </div>

        <div className="rounded-xl border border-border bg-card p-4">

          <div className="text-xs text-muted-foreground">

            Critical Events

          </div>

          <div className="text-3xl font-bold text-red-400 mt-2">

            {criticalEvents}

          </div>

        </div>

        <div className="rounded-xl border border-border bg-card p-4">

          <div className="text-xs text-muted-foreground">

            High Severity

          </div>

          <div className="text-3xl font-bold text-orange-400 mt-2">

            {highEvents}

          </div>

        </div>

        <div className="rounded-xl border border-border bg-card p-4">

          <div className="text-xs text-muted-foreground">

            Threat Score

          </div>

          <div className="text-3xl font-bold text-cyan-400 mt-2">

            {criticalEvents * 10 + highEvents * 5 + totalEvents}

          </div>

        </div>

      </div>

      {/* ====================== */}
      {/* TIMELINE */}
      {/* ====================== */}

      <div className="rounded-xl border border-border bg-card p-5 h-[350px]">

        <div className="font-semibold mb-5">

          Event Timeline

        </div>

        <ResponsiveContainer width="100%" height="100%">

          <LineChart data={timelineData}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="time" />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="value"
              stroke="#22d3ee"
              strokeWidth={2}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

      {/* ====================== */}
      {/* SEVERITY */}
      {/* ====================== */}

      <div className="rounded-xl border border-border bg-card p-5 h-[350px]">

        <div className="font-semibold mb-5">

          Severity Distribution

        </div>

        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={severityData}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="name" />

            <YAxis />

            <Tooltip />

            <Bar
              dataKey="value"
              fill="#22d3ee"
            />

          </BarChart>

        </ResponsiveContainer>

      </div>

      {/* ====================== */}
      {/* HOSTS */}
      {/* ====================== */}

      <div className="rounded-xl border border-border bg-card p-5 h-[350px]">

        <div className="font-semibold mb-5">

          Host Distribution

        </div>

        <ResponsiveContainer width="100%" height="100%">

          <PieChart>

            <Pie
              data={hostData}
              dataKey="value"
              nameKey="name"
              outerRadius={120}
            >

              {hostData.map((_: any, idx: number) => (

                <Cell
                  key={idx}
                  fill={
                    [
                      "#22d3ee",
                      "#06b6d4",
                      "#0891b2",
                      "#155e75",
                    ][idx % 4]
                  }
                />

              ))}

            </Pie>

            <Tooltip />

          </PieChart>

        </ResponsiveContainer>

      </div>

      {/* ====================== */}
      {/* USERS */}
      {/* ====================== */}

      <div className="rounded-xl border border-border bg-card p-5">

        <div className="font-semibold mb-5">

          Top Users

        </div>

        <div className="space-y-3">

          {userData.map((u: any, idx: number) => (

            <div
              key={idx}
              className="flex justify-between border-b border-border pb-2"
            >

              <div>

                {u.name}

              </div>

              <div className="text-cyan-400">

                {u.count} events

              </div>

            </div>

          ))}

        </div>

      </div>

      {/* ====================== */}
      {/* AI INSIGHT */}
      {/* ====================== */}

      <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/5 p-5">

        <div className="text-cyan-400 font-semibold mb-3">

          AI Threat Insight

        </div>

        <div className="text-sm text-muted-foreground leading-7">

          This tag currently contains
          {" "}
          {totalEvents}
          {" "}
          events with
          {" "}
          {criticalEvents}
          {" "}
          critical detections.

          Behavioral indicators suggest elevated operational activity
          across monitored infrastructure.

          Recommended next actions include:
          reviewing spike anomalies,
          validating suspicious users,
          and correlating outbound traffic patterns.

        </div>

      </div>

    </div>

  );

}