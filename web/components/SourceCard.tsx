"use client";

import { useState } from "react";
import type { Source } from "@/lib/types";

interface Props {
  source: Source;
}

function apaShort(authors: string, year: number | null): string {
  if (!authors) return year ? `(${year})` : "";
  // Split on " & ", "; ", " and " to get individual author entries
  const parts = authors
    .split(/\s*[;&]\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  // Each part is typically "LastName, F." — grab everything before the first comma
  const lastName = (parts[0] ?? "").split(",")[0].trim();
  const suffix = parts.length > 1 ? " et al." : "";
  return `${lastName}${suffix}${year ? ` (${year})` : ""}`;
}

export default function SourceCard({ source }: Props) {
  const [open, setOpen] = useState(false);
  const link = source.best_link || source.source_url || source.pdf_url || "";
  const citation = apaShort(source.authors, source.year);

  return (
    <>
      {/* Compact APA chip */}
      <button
        onClick={() => link && setOpen(true)}
        disabled={!link}
        title={source.title}
        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-2.5 py-1 shadow-sm hover:border-slate-400 hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span
          className="inline-flex items-center justify-center text-[10px] font-bold text-white rounded-full w-4 h-4 shrink-0"
          style={{ backgroundColor: "#007C92" }}
        >
          {source.sourceNumber}
        </span>
        <span className="text-xs text-slate-600">{citation}</span>
      </button>

      {/* Paper preview modal — z-[60] sits above the chat panel (z-50) */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* Panel: full-width sheet on mobile, floating card on desktop */}
          <div className="flex flex-col bg-white w-full sm:max-w-6xl sm:mx-4 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden h-[80vh] sm:h-[70vh] max-h-[850px]">
            {/* Header */}
            <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 shrink-0 bg-slate-50">
              <span
                className="inline-flex items-center justify-center text-xs font-bold text-white rounded-full w-6 h-6 shrink-0 mt-0.5"
                style={{ backgroundColor: "#007C92" }}
              >
                {source.sourceNumber}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                  {source.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-1">
                  {source.authors}
                  {source.year ? ` (${source.year})` : ""}
                  {source.journal ? ` · ${source.journal}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                {/* "Open in tab" — label visible on sm+, icon-only on mobile */}
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-white rounded-lg px-2.5 py-1.5 transition hover:opacity-90"
                  style={{ backgroundColor: "#007C92" }}
                >
                  <span className="hidden sm:inline">Open in tab</span>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>

                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* iframe */}
            <div className="flex-1 relative overflow-hidden">
              <iframe
                src={link}
                className="w-full h-full border-0"
                title={source.title}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              />
              <div className="absolute bottom-0 inset-x-0 flex justify-center pb-3 pointer-events-none">
                <p className="text-[11px] text-slate-500 bg-white/85 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                  Not loading?{" "}
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline pointer-events-auto"
                    style={{ color: "#007C92" }}
                  >
                    Open in a new tab
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
