"use client";

import { motion, AnimatePresence } from "framer-motion";
import { User, Send, Loader2, Brain, ChevronDown, Shield, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
};

type ChatWindowProps = {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  promptSuggestions?: string[];
};

// ---------------------------------------------------------------------------
// ThinkingBlock
// ---------------------------------------------------------------------------

function ThinkingBlock({ content, isLive }: { content: string; isLive: boolean }) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(isLive); }, [isLive]);
  useEffect(() => {
    if (open && isLive && scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [content, open, isLive]);

  return (
    <div
      className="mb-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--accent-glow-lg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ transition: "background 0.15s" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--glass-bg-hover)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
      >
        <Brain
          size={12}
          className={isLive ? "animate-glow-pulse" : ""}
          style={{ color: isLive ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.1em] flex-1"
          style={{ fontFamily: "var(--font-mono)", color: isLive ? "var(--accent)" : "var(--text-muted)" }}
        >
          {isLive ? "Reasoning..." : "View reasoning chain"}
        </span>
        <ChevronDown
          size={11}
          style={{
            color: "var(--text-muted)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div ref={scrollRef} className="px-3 pb-3 max-h-52 overflow-y-auto scrollbar-glass">
              <p
                className="text-[11px] leading-relaxed whitespace-pre-wrap"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
              >
                {content}
                {isLive && (
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="inline-block ml-0.5 w-1 h-3 align-middle"
                    style={{ background: "var(--accent)", opacity: 0.5 }}
                  />
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatWindow
// ---------------------------------------------------------------------------

export function ChatWindow({ messages, onSendMessage, isLoading, promptSuggestions = [] }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden rounded-2xl"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow-lg)",
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--accent-glow)",
              border: "1px solid var(--glass-border-hover)",
              boxShadow: "0 0 16px var(--accent-glow)",
            }}
          >
            <Shield size={14} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <p
              className="text-[12px] font-semibold tracking-[0.06em]"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              TIER-1 SUPPORT
            </p>
            <p
              className="text-[9px] uppercase tracking-[0.1em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              Cognitive Engine · RAG Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isLoading ? "var(--status-warn)" : "var(--status-live)",
              boxShadow: isLoading
                ? "0 0 6px var(--status-warn)"
                : "0 0 6px var(--status-live)",
              animation: "glow-pulse 2s ease-in-out infinite",
            }}
          />
          <span
            className="text-[9px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
          >
            {isLoading ? "Processing" : "Online"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-glass px-5 py-5 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <Zap size={24} style={{ color: "var(--accent)", opacity: 0.6 }} />
            </div>
            <div className="text-center space-y-1">
              <p
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
              >
                Secure node established
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Query your knowledge base
              </p>
            </div>

            {promptSuggestions.length > 0 && (
              <div className="flex flex-col gap-2 w-full max-w-lg">
                {promptSuggestions.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => onSendMessage(prompt)}
                    className="px-4 py-2.5 text-left text-xs rounded-xl transition-all"
                    style={{
                      background: "var(--glass-bg)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                      backdropFilter: "blur(8px)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-hover)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border-hover)";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--glass-bg)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border)";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex max-w-[78%] gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div className="shrink-0 mt-0.5">
                    {message.role === "user" ? (
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{
                          background: "var(--accent)",
                          boxShadow: "0 0 14px var(--accent-glow)",
                        }}
                      >
                        <User size={13} style={{ color: "var(--bg-base)" }} />
                      </div>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{
                          background: "var(--glass-bg)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        <Shield size={13} style={{ color: "var(--accent)" }} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    {/* Thinking block */}
                    {message.role === "assistant" && message.thinking && (
                      <ThinkingBlock content={message.thinking} isLive={!!message.isThinking} />
                    )}

                    {/* Bubble */}
                    <div
                      className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                      style={
                        message.role === "user"
                          ? {
                              background: "var(--accent-glow)",
                              border: "1px solid var(--glass-border-hover)",
                              backdropFilter: "blur(12px)",
                              color: "var(--text-primary)",
                              borderTopRightRadius: "6px",
                              boxShadow: "0 4px 16px var(--accent-glow-lg)",
                            }
                          : {
                              background: "var(--glass-bg)",
                              border: "1px solid var(--glass-border)",
                              backdropFilter: "blur(16px)",
                              color: "var(--text-secondary)",
                              borderTopLeftRadius: "6px",
                              boxShadow: "var(--glass-shadow)",
                            }
                      }
                    >
                      {message.role === "assistant" && message.isThinking && !message.content && (
                        <span
                          className="text-xs italic flex items-center gap-1.5"
                          style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                        >
                          <Brain size={11} className="animate-glow-pulse" style={{ color: "var(--accent)" }} />
                          Reasoning...
                        </span>
                      )}

                      {message.content && (
                        <div className="prose-glass">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      )}

                      {message.isStreaming && !message.isThinking && message.content && (
                        <span
                          className="inline-block ml-0.5 w-1.5 h-[14px] align-middle animate-blink"
                          style={{ background: "var(--accent)" }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(12px)",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border-hover)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px var(--accent-glow), 0 0 20px var(--accent-glow-lg)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border)";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Query the knowledge base..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm py-1.5 min-h-[36px] max-h-[120px]"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: !input.trim() || isLoading ? "var(--glass-bg-hover)" : "var(--accent)",
              color: !input.trim() || isLoading ? "var(--text-muted)" : "var(--bg-base)",
              boxShadow: !input.trim() || isLoading ? "none" : "0 0 16px var(--accent-glow)",
            }}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>

        <p
          className="mt-1.5 text-center text-[9px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
        >
          ENTER · send &nbsp;·&nbsp; SHIFT+ENTER · newline
        </p>
      </div>
    </div>
  );
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);
    setIsLoading(true);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", thinking: "", isStreaming: true, isThinking: false },
    ]);
    try {
      const res = await fetch("/api/chat/stream/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, session_id: sessionIdRef.current }),
      });
      const sid = res.headers.get("X-Session-ID");
      if (sid) sessionIdRef.current = sid;
      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
          setMessages((prev) => prev.map((msg) => {
            if (msg.id !== assistantId) return msg;
            switch (parsed.type) {
              case "think": return { ...msg, thinking: (msg.thinking ?? "") + parsed.content, isThinking: true };
              case "text":  return { ...msg, content: msg.content + parsed.content, isThinking: false };
              case "error": return { ...msg, content: msg.content + `\n\n> ⚠️ ${parsed.content}`, isThinking: false };
              default: return msg;
            }
          }));
        }
      }
    } catch {
      setMessages((prev) => prev.map((msg) =>
        msg.id === assistantId ? { ...msg, content: "ERR: Connection failed.", isThinking: false } : msg
      ));
    } finally {
      setMessages((prev) => prev.map((msg) =>
        msg.id === assistantId ? { ...msg, isStreaming: false, isThinking: false } : msg
      ));
      setIsLoading(false);
    }
  };
  return { messages, sendMessage, isLoading };
}

