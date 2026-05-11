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
        <span className="inline-flex items-center justify-center text-[10px] font-bold bg-slate-800 text-white rounded-full w-4 h-4 shrink-0">
          {source.sourceNumber}
        </span>
        <span className="text-xs text-slate-600">{citation}</span>
      </button>

      {/* Paper preview modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden"
            style={{ height: "87vh" }}
          >
            {/* Modal header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0 bg-slate-50">
              <span className="inline-flex items-center justify-center text-xs font-bold bg-slate-800 text-white rounded-full w-6 h-6 shrink-0 mt-0.5">
                {source.sourceNumber}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                  {source.title}
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {source.authors}
                  {source.year ? ` (${source.year})` : ""}
                  {source.journal ? ` · ${source.journal}` : ""}
                  {source.page ? ` · p. ${source.page}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-800 text-white rounded-lg px-3 py-1.5 hover:bg-slate-700 transition"
                  title="Open in new tab"
                >
                  Open in tab
                  <svg
                    className="w-3 h-3"
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

            {/* iframe area */}
            <div className="flex-1 relative overflow-hidden">
              <iframe
                src={link}
                className="w-full h-full border-0"
                title={source.title}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              />
              {/* Subtle fallback hint at the bottom */}
              <div className="absolute bottom-0 inset-x-0 flex justify-center pb-3 pointer-events-none">
                <p className="text-[11px] text-slate-400 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                  Not loading?{" "}
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline pointer-events-auto"
                  >
                    Open in a new tab instead
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
