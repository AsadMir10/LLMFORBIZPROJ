"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { DebugPanel } from "@/components/layout/DebugPanel";
import { ChatWindow, Message } from "@/components/chat/ChatWindow";
import { DocumentVault } from "@/components/vault/DocumentVault";
import { ThemeSwitcher } from "@/components/Themeswitcher";
import { useState, useCallback, useEffect } from "react";
import { Shield, Cpu, Database, Activity, Layers } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

const K_MIN     = 1;
const K_MAX     = 20;
const K_DEFAULT = 5;

// Labels that describe what each depth level means to the user
function kLabel(k: number): string {
  if (k <= 2)  return "Precise";
  if (k <= 5)  return "Balanced";
  if (k <= 10) return "Broad";
  return "Deep";
}

export default function Home() {
  const [isDebugOpen, setIsDebugOpen]   = useState(false);
  const [isPiiEnabled, setIsPiiEnabled] = useState(true);
  const [isVaultOpen, setIsVaultOpen]   = useState(true);

  const [selectedModel, setSelectedModel]         = useState("kimi-k2.5:cloud");
  const [availableModels, setAvailableModels]     = useState<string[]>([]);
  const [messages, setMessages]                   = useState<Message[]>([]);
  const [isLoading, setIsLoading]                 = useState(false);
  const [piiLogs, setPiiLogs]                     = useState<any[]>([]);
  const [sessionId, setSessionId]                 = useState<string | null>(null);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [piiCount, setPiiCount]                   = useState(0);

  // Context depth — number of chunks Pinecone returns
  const [contextK, setContextK] = useState(K_DEFAULT);

  // ── Loaders ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_BASE}/api/kb-prompts/`)
      .then((r) => r.json())
      .then((d) => { if (d.suggestions) setPromptSuggestions(d.suggestions); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/models/`)
      .then((r) => r.json())
      .then((d) => {
        if (d.models?.length > 0) {
          setAvailableModels(d.models);
          setSelectedModel(
            d.models.includes("kimi-k2.5:cloud") ? "kimi-k2.5:cloud" : d.models[0]
          );
        }
      })
      .catch(() => {});
  }, []);

  // Optionally fetch valid k range from backend
  useEffect(() => {
    fetch(`${API_BASE}/api/context-k-config/`)
      .then((r) => r.json())
      .then((d) => { if (d.default) setContextK(d.default); })
      .catch(() => {}); // silently fall back to frontend default
  }, []);

  // ── Send message ──────────────────────────────────────────────────

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content },
    ]);
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        thinking: "",
        isStreaming: true,
        isThinking: false,
      },
    ]);

    try {
      const response = await fetch(`${API_BASE}/chat/stream/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken":
            (typeof document !== "undefined" &&
              (document.getElementsByName("csrfmiddlewaretoken")[0] as HTMLInputElement)
                ?.value) || "",
        },
        body: JSON.stringify({
          message:    content,
          model:      selectedModel,
          session_id: sessionId,
          context_k:  contextK,   // ← sent to backend
        }),
      });

      if (!response.ok || !response.body) throw new Error("Stream unavailable.");

      const sid = response.headers.get("X-Session-ID");
      if (sid) setSessionId(sid);

      const piiHeader = response.headers.get("X-PII-Data");
      if (piiHeader) {
        try {
          const pii = JSON.parse(piiHeader);
          if (pii.count > 0) {
            setPiiCount((c) => c + pii.count);
            setPiiLogs((prev) => [
              {
                id:       `log-${Date.now()}`,
                raw:      pii.original,
                scrubbed: pii.scrubbed,
                timestamp: new Date(),
              },
              ...prev,
            ]);
            setIsDebugOpen(true);
          }
        } catch {}
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed: { type: string; content: string };
          try { parsed = JSON.parse(line); } catch { continue; }

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantId) return msg;
              switch (parsed.type) {
                case "think":
                  return { ...msg, thinking: (msg.thinking ?? "") + parsed.content, isThinking: true };
                case "text":
                  return { ...msg, content: msg.content + parsed.content, isThinking: false };
                case "error":
                  return { ...msg, content: msg.content + `\n\n> ⚠️ ${parsed.content}`, isThinking: false };
                default:
                  return msg;
              }
            })
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "ERR: Cognitive engine unreachable.", isStreaming: false, isThinking: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, isStreaming: false, isThinking: false }
            : msg
        )
      );
    }
  }, [isLoading, selectedModel, sessionId, contextK]);

  const messageCount = messages.filter((m) => m.role === "user").length;
  const shortModel   = selectedModel.split(":")[0].toUpperCase();
  const sessionShort = sessionId ? sessionId.slice(0, 8).toUpperCase() : "—";

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>

      {/* ── TOP BAR ───────────────────────────────────── */}
      <header
        className="shrink-0 h-12 flex items-center justify-between px-5 z-40"
        style={{
          background:           "var(--glass-bg)",
          backdropFilter:       "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom:         "1px solid var(--glass-border)",
          boxShadow:            "var(--glass-shadow)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 ml-16">
          <Shield size={13} style={{ color: "var(--accent)" }} />
          <span
            className="text-[11px] font-bold tracking-[0.16em] uppercase"
            style={{ fontFamily: "var(--font-display)", color: "var(--accent)" }}
          >
            TIER-1
          </span>
          <span style={{ color: "var(--glass-border)" }}>/</span>
          <span
            className="text-[9px] uppercase tracking-widest"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
          >
            Cognitive Support Engine
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <Stat icon={<Cpu size={10} />}      label="MODEL"   value={shortModel} />
          <Sep />
          <Stat icon={<Activity size={10} />} label="QUERIES" value={String(messageCount)} />
          <Sep />
          <Stat icon={<Shield size={10} />}   label="PII"     value={String(piiCount)} highlight={piiCount > 0} />
          <Sep />
          <Stat icon={<Database size={10} />} label="SESSION" value={sessionShort} />
          <Sep />
          {/* Context depth indicator in top bar */}
          <Stat
            icon={<Layers size={10} />}
            label="CONTEXT"
            value={`${contextK} chunks`}
            highlight
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <ThemeSwitcher />

          <button
            onClick={() => setIsPiiEnabled((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9px] uppercase tracking-[0.1em] transition-all"
            style={{
              fontFamily:  "var(--font-mono)",
              color:       isPiiEnabled ? "var(--status-ok)" : "var(--status-danger)",
              border:      `1px solid ${isPiiEnabled ? "rgba(104,211,145,0.25)" : "rgba(252,129,129,0.25)"}`,
              background:  isPiiEnabled ? "rgba(104,211,145,0.06)" : "rgba(252,129,129,0.06)",
            }}
          >
            <Shield size={9} />
            PII {isPiiEnabled ? "ON" : "OFF"}
          </button>

          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-glow-pulse"
              style={{
                background: isLoading ? "var(--status-warn)" : "var(--status-live)",
                boxShadow:  `0 0 6px ${isLoading ? "var(--status-warn)" : "var(--status-live)"}`,
              }}
            />
            <span
              className="text-[9px] uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              {isLoading ? "Processing" : "Standby"}
            </span>
          </div>
        </div>
      </header>

      {/* ── BODY ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onDebugToggle={() => setIsDebugOpen(true)}
          isPiiEnabled={isPiiEnabled}
          onPiiToggle={() => setIsPiiEnabled((v) => !v)}
          selectedModel={selectedModel}
          availableModels={availableModels}
          onModelChange={setSelectedModel}
        />

        <main className="flex-1 flex flex-col overflow-hidden ml-[60px]">

          {/* ── Secondary strip: model + context depth ── */}
          <div
            className="shrink-0 h-10 flex items-center gap-4 px-5"
            style={{
              borderBottom: "1px solid var(--glass-border)",
              background:   "var(--glass-bg)",
              backdropFilter: "blur(16px)",
            }}
          >
            {/* Model selector */}
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
              >
                Engine
              </span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent outline-none cursor-pointer transition-colors"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize:   "11px",
                  color:      "var(--text-secondary)",
                  border:     "none",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")}
              >
                {availableModels.length === 0 ? (
                  <option value={selectedModel}>{selectedModel}</option>
                ) : (
                  availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))
                )}
              </select>
            </div>

            {/* Divider */}
            <span style={{ color: "var(--glass-border)", fontSize: 12 }}>|</span>

            {/* Context depth slider */}
            <div className="flex items-center gap-3">
              <Layers size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span
                className="text-[9px] uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
              >
                Context depth
              </span>

              {/* Minus */}
              <button
                onClick={() => setContextK((k) => Math.max(K_MIN, k - 1))}
                disabled={contextK <= K_MIN}
                className="w-5 h-5 rounded flex items-center justify-center transition-all text-xs leading-none"
                style={{
                  background:  contextK <= K_MIN ? "transparent" : "var(--glass-bg-hover)",
                  border:      "1px solid var(--glass-border)",
                  color:       contextK <= K_MIN ? "var(--text-muted)" : "var(--text-secondary)",
                  cursor:      contextK <= K_MIN ? "not-allowed" : "pointer",
                  fontFamily:  "var(--font-mono)",
                }}
              >
                −
              </button>

              {/* Slider */}
              <div className="relative flex items-center" style={{ width: 120 }}>
                <input
                  type="range"
                  min={K_MIN}
                  max={K_MAX}
                  step={1}
                  value={contextK}
                  onChange={(e) => setContextK(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "var(--accent)", cursor: "pointer", height: 3 }}
                />
              </div>

              {/* Plus */}
              <button
                onClick={() => setContextK((k) => Math.min(K_MAX, k + 1))}
                disabled={contextK >= K_MAX}
                className="w-5 h-5 rounded flex items-center justify-center transition-all text-xs leading-none"
                style={{
                  background:  contextK >= K_MAX ? "transparent" : "var(--glass-bg-hover)",
                  border:      "1px solid var(--glass-border)",
                  color:       contextK >= K_MAX ? "var(--text-muted)" : "var(--text-secondary)",
                  cursor:      contextK >= K_MAX ? "not-allowed" : "pointer",
                  fontFamily:  "var(--font-mono)",
                }}
              >
                +
              </button>

              {/* Value badge */}
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-glow-lg)",
                  border:     "1px solid var(--glass-border-hover)",
                  minWidth:   68,
                  justifyContent: "center",
                }}
              >
                <span
                  className="text-[10px] font-semibold tabular-nums"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}
                >
                  {contextK}
                </span>
                <span
                  className="text-[9px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                >
                  · {kLabel(contextK)}
                </span>
              </div>
            </div>

            {/* Right — message count */}
            <span
              className="ml-auto text-[9px] uppercase tracking-[0.1em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              {messages.length === 0 ? "No active thread" : `${messages.length} messages`}
            </span>
          </div>

          {/* ── Chat + vault ── */}
          <div className="flex flex-1 overflow-hidden">
            <section className="flex-1 min-w-0 p-4 overflow-hidden">
              <ChatWindow
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                promptSuggestions={promptSuggestions}
              />
            </section>

            <aside
              className="shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
              style={{
                width:          isVaultOpen ? "340px" : "0px",
                borderLeft:     "1px solid var(--glass-border)",
                background:     "var(--glass-bg)",
                backdropFilter: "blur(20px)",
              }}
            >
              {isVaultOpen && (
                <div className="w-[340px] h-full overflow-hidden">
                  <DocumentVault />
                </div>
              )}
            </aside>

            <button
              onClick={() => setIsVaultOpen((v) => !v)}
              className="shrink-0 w-5 flex items-center justify-center transition-all"
              style={{
                borderLeft:     "1px solid var(--glass-border)",
                background:     "var(--glass-bg)",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--glass-bg-hover)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--glass-bg)")}
            >
              <span
                style={{
                  writingMode:   "vertical-rl",
                  fontFamily:    "var(--font-mono)",
                  fontSize:      "8px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color:         "var(--text-muted)",
                }}
              >
                {isVaultOpen ? "◀ VAULT" : "VAULT ▶"}
              </span>
            </button>
          </div>
        </main>
      </div>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer
        className="shrink-0 h-6 flex items-center gap-3 px-5"
        style={{
          borderTop:      "1px solid var(--glass-border)",
          background:     "var(--glass-bg)",
          backdropFilter: "blur(16px)",
        }}
      >
        {["TIER-1 CSE", "NDJSON STREAM", "PINECONE RAG"].map((s, i) => (
          <span key={i} className="flex items-center gap-3">
            {i > 0 && <span style={{ color: "var(--glass-border)" }}>·</span>}
            <span
              className="text-[9px] uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              {s}
            </span>
          </span>
        ))}
        <Clock />
      </footer>

      <DebugPanel
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        logs={piiLogs}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <span
      className="ml-auto text-[9px] tabular-nums"
      style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
    >
      {time}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      <span
        className="text-[9px] uppercase tracking-[0.1em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-[10px] font-medium tabular-nums"
        style={{
          fontFamily: "var(--font-mono)",
          color: highlight ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Sep() {
  return <span style={{ color: "var(--glass-border)" }}>·</span>;
}