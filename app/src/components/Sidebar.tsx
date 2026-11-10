"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/lib/project-context";
import {
  LayoutDashboard,
  Layers,
  MessageSquare,
  Lightbulb,
  History,
  Play,
  Loader2,
  ChevronDown,
  Plus,
  Briefcase,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/clusters", label: "Clusters", icon: Layers },
  { href: "/prompts", label: "Prompts", icon: MessageSquare },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { href: "/runs", label: "Run History", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, activeProject, setActiveProjectId, loading } = useProject();
  const [triggering, setTriggering] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const triggerRun = async () => {
    if (!activeProject) return;
    setTriggering(true);
    try {
      const res = await fetch(`/api/runs?projectId=${activeProject.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "manual" }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to trigger run:", data.error);
      }
    } catch (err) {
      console.error("Failed to trigger run:", err);
    } finally {
      setTriggering(false);
    }
    router.push("/runs");
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Project Switcher */}
      <div className="p-4 border-b border-slate-800">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : projects.length === 0 ? (
          <Link
            href="/projects/new"
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first project
          </Link>
        ) : (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-medium text-slate-200 truncate flex-1 text-left">
                {activeProject?.brandName ?? "Select project"}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProjectId(p.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700/50 transition-colors ${
                      p.id === activeProject?.id
                        ? "text-blue-400 bg-slate-700/30"
                        : "text-slate-300"
                    }`}
                  >
                    <div className="font-medium">{p.brandName}</div>
                    <div className="text-xs text-slate-500">{p.domain}</div>
                  </button>
                ))}
                <Link
                  href="/projects/new"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-blue-400 hover:bg-slate-700/50 transition-colors border-t border-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New project
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "nav-link-active" : "nav-link"}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Trigger Run Button */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={triggerRun}
          disabled={triggering || !activeProject}
          className="button-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {triggering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span>{triggering ? "Starting..." : "Trigger Run"}</span>
        </button>
      </div>
    </aside>
  );
}
