"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Lock, UploadCloud, Trash2, AlertCircle, RefreshCw } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

type VaultItem = {
  id: string; title: string; type: string; excerpt: string; status: "indexed" | "processing";
};

const getCsrfToken = () =>
  (typeof document !== "undefined" &&
    (document.getElementsByName("csrfmiddlewaretoken")[0] as HTMLInputElement)?.value) || "";

export function DocumentVault() {
  const [isDragging, setIsDragging] = useState(false);
  const [documents, setDocuments]   = useState<VaultItem[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true); setError(null);
      const res = await fetch(`${API_BASE}/api/documents/`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents.map((d: any) => ({
          id: d.id.toString(), title: d.title || d.source,
          type: d.source?.toLowerCase().includes(".pdf") ? "PDF" : "DOC",
          excerpt: d.source, status: "indexed" as const,
        })));
      } else throw new Error("API error");
    } catch { setError("Cannot reach backend on port 8000."); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const processUpload = async (file: File) => {
    if (!file || file.type !== "application/pdf") { alert("PDF only."); return; }
    const tempId = `temp-${Date.now()}`;
    setDocuments((prev) => [
      { id: tempId, title: file.name, type: "PDF", excerpt: "Vectorizing...", status: "processing" }, ...prev,
    ]);
    try {
      const fd = new FormData(); fd.append("pdf_file", file);
      const res = await fetch(`${API_BASE}/upload/`, { method: "POST", headers: { "X-CSRFToken": getCsrfToken() }, body: fd });
      if (res.ok) { await fetchDocuments(); window.dispatchEvent(new Event("vaultUpdated")); }
      else { const e = await res.json(); throw new Error(e.error || "Upload failed"); }
    } catch (err: any) {
      setDocuments((prev) => prev.filter((d) => d.id !== tempId));
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id.startsWith("temp-") || !confirm("Remove from vector store?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/documents/${id}/`, { method: "DELETE", headers: { "X-CSRFToken": getCsrfToken() } });
      if (res.ok) { setDocuments((prev) => prev.filter((d) => d.id !== id)); window.dispatchEvent(new Event("vaultUpdated")); }
    } catch { console.error("Delete failed"); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "transparent" }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.1em]"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            DOCUMENT VAULT
          </p>
          <p
            className="text-[9px] uppercase tracking-[0.1em] mt-0.5"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
          >
            {documents.length} indexed · Pinecone
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDocuments}
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
          >
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
          </button>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{
              background: "rgba(104,211,145,0.08)",
              border: "1px solid rgba(104,211,145,0.2)",
            }}
          >
            <Lock size={9} style={{ color: "var(--status-ok)" }} />
            <span
              className="text-[9px] uppercase tracking-[0.1em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--status-ok)" }}
            >
              Secured
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="shrink-0 mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
          style={{
            background: "rgba(252,129,129,0.06)",
            border: "1px solid rgba(252,129,129,0.2)",
            color: "var(--status-danger)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <AlertCircle size={11} /> {error}
        </div>
      )}

      {/* Upload zone */}
      <div className="shrink-0 px-3 pt-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processUpload(f); }}
          className="relative border border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer overflow-hidden"
          style={{
            borderColor: isDragging ? "var(--accent)" : "var(--glass-border)",
            background: isDragging ? "var(--accent-glow-lg)" : "var(--glass-bg)",
            backdropFilter: "blur(8px)",
          }}
          onMouseEnter={(e) => {
            if (!isDragging) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border-hover)";
              (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border)";
              (e.currentTarget as HTMLElement).style.background = "var(--glass-bg)";
            }
          }}
        >
          <input
            type="file" accept=".pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processUpload(f); }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <UploadCloud size={20} style={{ color: isDragging ? "var(--accent)" : "var(--text-muted)" }} />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Drop{" "}
              <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>.pdf</span>
              {" "}or click to upload
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-glass px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "var(--glass-border)", borderTopColor: "var(--accent)" }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.1em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              Syncing...
            </span>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span
              className="text-[10px] uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
            >
              Vault empty
            </span>
          </div>
        ) : (
          <AnimatePresence>
            {documents.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="group flex items-start gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  backdropFilter: "blur(8px)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-hover)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--glass-bg)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border)";
                }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "var(--accent-glow-lg)", border: "1px solid var(--glass-border)" }}
                >
                  <FileText size={13} style={{ color: "var(--accent)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {doc.title}
                  </p>
                  <p
                    className="text-[9px] truncate mt-0.5"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                  >
                    {doc.excerpt}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{
                        background: doc.status === "indexed" ? "var(--status-ok)" : "var(--status-warn)",
                        boxShadow: `0 0 4px ${doc.status === "indexed" ? "var(--status-ok)" : "var(--status-warn)"}`,
                        animation: doc.status === "processing" ? "glow-pulse 1s ease-in-out infinite" : undefined,
                      }}
                    />
                    <span
                      className="text-[8px] uppercase tracking-[0.14em]"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                    >
                      {doc.status}
                    </span>
                    <span style={{ color: "var(--glass-border)" }}>·</span>
                    <span
                      className="text-[8px] uppercase tracking-[0.1em]"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                    >
                      {doc.type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(252,129,129,0.1)";
                    (e.currentTarget as HTMLElement).style.color = "var(--status-danger)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}