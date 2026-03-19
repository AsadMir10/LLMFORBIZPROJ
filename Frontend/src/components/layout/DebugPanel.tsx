"use client";

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { X, Terminal, Shield } from "lucide-react";
import { Fragment } from "react";
import { PIILogger } from "../logger/PIILogger";

type DebugPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  logs: Array<{ id: string; raw: string; scrubbed: string; timestamp: Date }>;
};

export function DebugPanel({ isOpen, onClose, logs }: DebugPanelProps) {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
        </TransitionChild>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
              <TransitionChild
                as={Fragment}
                enter="transform transition ease-in-out duration-350"
                enterFrom="translate-x-full" enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0" leaveTo="translate-x-full"
              >
                <DialogPanel
                  className="pointer-events-auto w-[600px] flex flex-col h-full"
                  style={{
                    background: "var(--glass-bg)",
                    backdropFilter: "blur(32px) saturate(200%)",
                    WebkitBackdropFilter: "blur(32px) saturate(200%)",
                    borderLeft: "1px solid var(--glass-border)",
                    boxShadow: "var(--glass-shadow-lg)",
                  }}
                >
                  {/* Header */}
                  <div
                    className="shrink-0 flex items-center justify-between px-5 py-3.5"
                    style={{ borderBottom: "1px solid var(--glass-border)" }}
                  >
                    <DialogTitle className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{
                          background: "var(--accent-glow)",
                          border: "1px solid var(--glass-border-hover)",
                          boxShadow: "0 0 12px var(--accent-glow)",
                        }}
                      >
                        <Terminal size={14} style={{ color: "var(--accent)" }} />
                      </div>
                      <div>
                        <p
                          className="text-[12px] font-semibold tracking-[0.06em]"
                          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                        >
                          PII DEBUG LOG
                        </p>
                        <p
                          className="text-[9px] uppercase tracking-[0.1em]"
                          style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                        >
                          Real-time scrub traces · {logs.length} event{logs.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </DialogTitle>

                    <button
                      onClick={onClose}
                      className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-hover)";
                        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Info banner */}
                  <div
                    className="shrink-0 mx-4 mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl"
                    style={{
                      background: "var(--accent-glow-lg)",
                      border: "1px solid var(--glass-border)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Shield size={13} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                    <p
                      className="text-xs leading-relaxed"
                      style={{ fontFamily: "var(--font-sans)", color: "var(--text-secondary)" }}
                    >
                      Showing raw vs. scrubbed diff traces for all PII detected in active execution flows.
                      No sensitive data leaves this panel.
                    </p>
                  </div>

                  {/* Logs */}
                  <div className="flex-1 overflow-y-auto scrollbar-glass px-4 py-4">
                    <PIILogger logs={logs} />
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}