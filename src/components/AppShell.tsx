import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ScanSearch,
  Sparkles,
  Database,
  Plug,
  Settings as SettingsIcon,
  Activity,
  Tags,
} from "lucide-react";

import { motion } from "framer-motion";

const nav = [
  {
    group: "Operate",
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        to: "/log-explorer",
        label: "Log Explorer",
        icon: ScanSearch,
      },
      {
        to: "/activity",
        label: "Activity Monitor",
        icon: Activity,
      },
    ],
  },

  {
    group: "Intelligence",
    items: [
      {
        to: "/tags",
        label: "Tag Studio",
        icon: Tags,
      },
    ],
  },

  {
    group: "Knowledge",
    items: [
      {
        to: "/repository",
        label: "Repository",
        icon: Database,
      },
    ],
  },

  {
    group: "Lab",
    items: [
      {
        to: "/ai-assistant",
        label: "AI Assistant",
        icon: Sparkles,
      },

      {
        to: "/integrations",
        label: "Integrations",
        icon: Plug,
      },

      {
        to: "/settings",
        label: "Settings",
        icon: SettingsIcon,
      },
    ],
  },
] as const;

export function AppShell() {

  const { location } = useRouterState();

  return (

    <div className="min-h-screen flex bg-background text-foreground">

      <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">

        <div className="px-4 h-14 flex items-center gap-2 border-b border-sidebar-border">

          <div className="size-7 rounded-md bg-primary/20 grid place-items-center">

            <span className="text-primary font-bold text-sm">
              K
            </span>

          </div>

          <div className="leading-tight">

            <div className="text-sm font-semibold">
              Splunk KnowBot
            </div>

            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Intelligence Layer
            </div>

          </div>

        </div>

        <nav className="flex-1 overflow-y-auto py-2">

          {nav.map((group) => (

            <div key={group.group} className="mb-2">

              <div className="px-4 py-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">

                {group.group}

              </div>

              {group.items.map(({ to, label, icon: Icon }) => {

                const active =
                  location.pathname === to ||
                  (to !== "/" &&
                    location.pathname.startsWith(to));

                return (

                  <Link
                    key={to}
                    to={to}
                    className={`relative flex items-center gap-2.5 px-4 py-1.5 text-sm transition-colors ${
                      active
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >

                    {active && (

                      <motion.span
                        layoutId="nav-active"
                        className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r"
                      />

                    )}

                    <Icon className="size-4" />

                    <span>
                      {label}
                    </span>

                  </Link>

                );

              })}

            </div>

          ))}

        </nav>

        <div className="px-4 py-3 border-t border-sidebar-border text-[11px] text-muted-foreground">

          <div className="flex items-center gap-2">

            <span className="size-2 rounded-full bg-success animate-pulse" />

            <span>
              Backend Connected
            </span>

          </div>

        </div>

      </aside>

      <main className="flex-1 min-w-0 flex flex-col">

        <Outlet />

      </main>

    </div>

  );

}