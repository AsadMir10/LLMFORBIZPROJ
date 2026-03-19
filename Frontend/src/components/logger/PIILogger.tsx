"use client";

import { motion } from "framer-motion";
import { Copy, Check, Info } from "lucide-react";
import { useState } from "react";

type LogEntry = {
  id: string;
  raw: string;
  scrubbed: string;
  timestamp: Date;
};

export function PIILogger({ logs }: { logs: LogEntry[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (logs.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-neutral-500 font-mono text-sm border border-dashed border-white/10 rounded-xl">
        <Info className="mb-2 opacity-50" size={24} />
        <span>No PII diffs intercepted yet.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {logs.map((log) => (
        <motion.div 
          key={log.id} 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg overflow-hidden border border-white/10 bg-[#111] font-mono text-sm shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/10 text-xs text-neutral-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Intercepted PII
            </span>
            <span>{log.timestamp.toLocaleTimeString()}</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Raw View */}
            <div>
              <div className="text-[10px] tracking-wider text-red-400/70 uppercase mb-1 flex items-center justify-between">
                <span>Raw Input (Contains PII)</span>
                <button 
                  onClick={() => copyToClipboard(log.raw, `raw-${log.id}`)}
                  className="hover:text-white transition-colors"
                >
                  {copiedId === `raw-${log.id}` ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <div className="p-3 bg-red-950/20 text-red-200 border border-red-900/30 rounded-md break-words whitespace-pre-wrap">
                {log.raw}
              </div>
            </div>

            {/* Scrubbed View */}
            <div>
              <div className="text-[10px] tracking-wider text-green-400/70 uppercase mb-1 flex items-center justify-between">
                <span>Scrubbed Output (Safe)</span>
                 <button 
                  onClick={() => copyToClipboard(log.scrubbed, `scrub-${log.id}`)}
                  className="hover:text-white transition-colors"
                >
                  {copiedId === `scrub-${log.id}` ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <div className="p-3 bg-green-950/20 text-green-200 border border-green-900/30 rounded-md break-words whitespace-pre-wrap">
                {log.scrubbed}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
