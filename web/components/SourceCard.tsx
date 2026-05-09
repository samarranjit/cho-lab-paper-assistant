"use client";

import type { Source } from "@/lib/types";

interface Props {
  source: Source;
}

export default function SourceCard({ source }: Props) {
  const link = source.best_link || source.source_url || source.pdf_url || "";
  const pct = source.similarity ? Math.round(source.similarity * 100) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center justify-center text-xs font-bold bg-slate-800 text-white rounded-full w-6 h-6 shrink-0 mt-0.5">
          {source.sourceNumber}
        </span>
        {pct !== null && (
          <span className="text-xs text-slate-400 shrink-0">{pct}% match</span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-slate-800 leading-snug">
        {source.title}
      </p>

      {/* Authors & year */}
      {(source.authors || source.year) && (
        <p className="text-xs text-slate-500">
          {source.authors}
          {source.year ? ` (${source.year})` : ""}
        </p>
      )}

      {/* Journal & page */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
        {source.journal && <span>{source.journal}</span>}
        {source.page ? <span>p. {source.page}</span> : null}
      </div>

      {/* Link */}
      <div className="mt-auto pt-1">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            Open source
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
        ) : (
          <span className="text-xs text-slate-300">No source link available</span>
        )}
      </div>
    </div>
  );
}
