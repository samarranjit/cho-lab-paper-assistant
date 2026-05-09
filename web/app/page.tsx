"use client";

import { useState } from "react";
import ChatBox from "@/components/ChatBox";
import SourceCard from "@/components/SourceCard";
import LoadingDots from "@/components/LoadingDots";
import type { Source, AskResponse } from "@/lib/types";

const EXAMPLE_QUESTIONS = [
  "What are the five snow seasonality classes?",
  "What problem does the infrastructure design snowmelt paper try to solve?",
  "What is runoff potential, and how is it different from snowmelt?",
  "Why are forested areas challenging for satellite SWE retrievals?",
  "How do snowmelt and rain-on-snow events affect infrastructure design?",
];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setAnswer("");
    setSources([]);
    setError("");
    setUsedFallback(false);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      const data: AskResponse & { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? "An unexpected error occurred.");
        return;
      }

      setAnswer(data.answer ?? "");
      setSources(data.sources ?? []);
      setUsedFallback(data.usedFallback ?? false);
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleExample(q: string) {
    setQuestion(q);
    ask(q);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white px-4 py-7">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold tracking-tight">
            Cho Lab Research Assistant
          </h1>
          <p className="mt-1 text-slate-300 text-sm leading-relaxed">
            Ask questions based on Cho Lab research papers. Answers are generated
            only from retrieved paper excerpts and include sources.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-7">
        {/* Notice */}
        <p className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5">
          This assistant answers only from indexed Cho Lab papers. Questions
          outside the database will be politely declined.
        </p>

        {/* Example chips */}
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2.5">
            Try an example
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleExample(q)}
                disabled={loading}
                className="text-xs bg-white border border-slate-300 text-slate-600 rounded-full px-3 py-1.5 hover:border-slate-400 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <ChatBox
          value={question}
          onChange={setQuestion}
          onSubmit={() => ask(question)}
          loading={loading}
        />

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <LoadingDots />
            <span>Searching papers and generating answer…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Answer */}
        {answer && !loading && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
              Answer
            </p>
            {usedFallback && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-4">
                Note: AI answer service was unavailable. Showing relevant sources below.
              </p>
            )}
            <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
              {answer}
            </p>
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && !loading && (
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
              Sources ({sources.length})
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {sources.map((s) => (
                <SourceCard key={s.id} source={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
