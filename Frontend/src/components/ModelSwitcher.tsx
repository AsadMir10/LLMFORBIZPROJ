"use client";

import { Cpu, Cloud } from "lucide-react";

interface ModelSwitcherProps {
  selectedModel: string;
  availableModels: string[];
  onModelChange: (id: string) => void;
}

export function ModelSwitcher({ selectedModel, availableModels, onModelChange }: ModelSwitcherProps) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="px-3 py-2"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <span
          className="text-[9px] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
        >
          Engine
        </span>
      </div>

      <div className="max-h-44 overflow-y-auto scrollbar-glass">
        {availableModels.map((modelId) => {
          const isActive = selectedModel === modelId;
          const isCloud = modelId.includes("cloud") || modelId.includes("gpt") || modelId.includes("kimi");
          const displayName = modelId.split(":")[0].toUpperCase();
          const tag = modelId.includes(":") ? modelId.split(":")[1] : null;

          return (
            <button
              key={modelId}
              onClick={() => onModelChange(modelId)}
              className="w-full flex items-center gap-2 px-3 py-2.5 transition-all text-left"
              style={{
                background: isActive ? "var(--accent-glow)" : "transparent",
                borderBottom: "1px solid var(--glass-border)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: isActive ? "var(--accent-glow)" : "rgba(255,255,255,0.04)",
                  border: "1px solid var(--glass-border)",
                  color: isActive ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {isCloud ? <Cloud size={11} /> : <Cpu size={11} />}
              </div>
              <div className="flex-1 overflow-hidden">
                <p
                  className="text-[10px] font-semibold tracking-wide truncate"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {displayName}
                </p>
                {tag && (
                  <p
                    className="text-[8px] uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                  >
                    {tag}
                  </p>
                )}
              </div>
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 animate-glow-pulse"
                  style={{ background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}