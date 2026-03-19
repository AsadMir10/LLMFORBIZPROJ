"use client";

import {
  LayoutDashboard, MessageSquare, Database,
  Terminal, ShieldAlert, Settings, Shield, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { ModelSwitcher } from "@/components/ModelSwitcher";

interface SidebarProps {
  onDebugToggle: () => void;
  isPiiEnabled: boolean;
  onPiiToggle: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  availableModels: string[];
}

export function Sidebar({
  onDebugToggle, isPiiEnabled, onPiiToggle,
  selectedModel, onModelChange, availableModels,
}: SidebarProps) {
  const [activeId, setActiveId] = useState("chat");
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="fixed left-0 top-0 h-full z-50 flex flex-col"
      style={{
        width: expanded ? "220px" : "60px",
        transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        background: "var(--glass-bg)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderRight: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {/* Brand */}
      <div
        className="h-12 shrink-0 flex items-center px-3.5 overflow-hidden"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "var(--accent-glow)",
            border: "1px solid var(--glass-border-hover)",
            boxShadow: "0 0 12px var(--accent-glow)",
          }}
        >
          <Shield size={13} style={{ color: "var(--accent)" }} />
        </div>
        {expanded && (
          <div className="ml-2.5 flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
            <span
              className="text-[11px] font-bold tracking-[0.15em] uppercase"
              style={{ fontFamily: "var(--font-display)", color: "var(--accent)" }}
            >
              TIER-1
            </span>
            <ChevronRight size={9} style={{ color: "var(--text-muted)" }} />
            <span
              className="text-[9px] tracking-widest uppercase"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              CSE
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-hidden">
        {[
          { id: "home", icon: <LayoutDashboard size={15} />, label: "Dashboard" },
          { id: "chat", icon: <MessageSquare size={15} />, label: "Chat" },
          { id: "vault", icon: <Database size={15} />, label: "Vault" },
        ].map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeId === item.id}
            expanded={expanded}
            onClick={() => setActiveId(item.id)}
          />
        ))}

        <div className="h-px my-2 mx-1" style={{ background: "var(--glass-border)" }} />

        <NavItem
          icon={<Terminal size={15} />}
          label="PII Logs"
          active={false}
          expanded={expanded}
          onClick={onDebugToggle}
          accent
        />
      </nav>

      {/* Bottom */}
      <div
        className="shrink-0 px-2 py-3 space-y-1 overflow-hidden"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        {/* PII toggle */}
        <button
          onClick={onPiiToggle}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all"
          style={{ background: "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glass-bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: isPiiEnabled
                ? "rgba(104, 211, 145, 0.1)"
                : "rgba(252, 129, 129, 0.1)",
              border: `1px solid ${isPiiEnabled ? "rgba(104,211,145,0.25)" : "rgba(252,129,129,0.25)"}`,
              color: isPiiEnabled ? "var(--status-ok)" : "var(--status-danger)",
            }}
          >
            <ShieldAlert size={13} />
          </div>
          {expanded && (
            <div className="text-left overflow-hidden whitespace-nowrap">
              <p
                className="text-[9px] uppercase tracking-[0.14em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
              >
                Safety Layer
              </p>
              <p
                className="text-[10px] font-semibold"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: isPiiEnabled ? "var(--status-ok)" : "var(--status-danger)",
                }}
              >
                {isPiiEnabled ? "ACTIVE" : "DISABLED"}
              </p>
            </div>
          )}
        </button>

        {/* Model switcher */}
        {expanded && (
          <div className="pt-1">
            <ModelSwitcher
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              availableModels={availableModels}
            />
          </div>
        )}

        {/* Version */}
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Settings size={13} style={{ color: "var(--text-muted)" }} className="shrink-0 cursor-pointer" />
          {expanded && (
            <span
              className="text-[9px] whitespace-nowrap"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              v2.5.0-STABLE
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  icon, label, active, expanded, onClick, accent = false,
}: {
  icon: React.ReactNode; label: string; active: boolean;
  expanded: boolean; onClick: () => void; accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="relative w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all"
      style={{
        background: active ? "var(--accent-glow)" : "transparent",
        border: active ? "1px solid var(--glass-border-hover)" : "1px solid transparent",
        color: active ? "var(--accent)" : accent ? "var(--text-secondary)" : "var(--text-muted)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-hover)";
          (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = active
            ? "var(--accent)"
            : accent ? "var(--text-secondary)" : "var(--text-muted)";
        }
      }}
    >
      {active && (
        <span
          className="absolute left-0 w-0.5 h-4 rounded-r-full"
          style={{ background: "var(--accent)" }}
        />
      )}
      <span className="w-7 h-7 flex items-center justify-center shrink-0">{icon}</span>
      {expanded && (
        <span
          className="text-[11px] font-medium uppercase tracking-[0.1em] whitespace-nowrap"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {label}
        </span>
      )}
    </button>
  );
}