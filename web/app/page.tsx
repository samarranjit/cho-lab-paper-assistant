"use client";

import { useEffect, useRef, useState } from "react";
import ChatBox from "@/components/ChatBox";
import SourceCard from "@/components/SourceCard";
import LoadingDots from "@/components/LoadingDots";
import {
  appendChatMessage,
  clearChatMemory,
  loadChatMemory,
} from "@/lib/chatMemory";
import type { AskResponse, ChatMessage, Source } from "@/lib/types";

const EXAMPLE_QUESTIONS = [
  "What are the five snow seasonality classes?",
  "What problem does the infrastructure design snowmelt paper try to solve?",
  "What is runoff potential, and how is it different from snowmelt?",
  "Why are forested areas challenging for satellite SWE retrievals?",
  "How do snowmelt and rain-on-snow events affect infrastructure design?",
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load persisted messages on first client-side render.
  // Done in useEffect so SSR renders an empty list (no hydration mismatch).
  useEffect(() => {
    setMessages(loadChatMemory());
  }, []);

  // Scroll to bottom after each message update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    // Capture prior context BEFORE appending the current question.
    // This is what gets sent to the API as conversation history.
    const priorHistory = loadChatMemory();

    setLoading(true);
    setError("");
    setUsedFallback(false);
    setQuestion("");
    setSources([]);

    // Optimistically add the user message to state and localStorage
    const withUser = appendChatMessage({ role: "user", content: trimmed });
    setMessages(withUser);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: priorHistory }),
      });

      const data: AskResponse & { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? "An unexpected error occurred.");
        return;
      }

      // Add the assistant reply to state and localStorage
      const withAssistant = appendChatMessage({
        role: "assistant",
        content: data.answer ?? "",
      });
      setMessages(withAssistant);
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

  function handleNewChat() {
    clearChatMemory();
    setMessages([]);
    setSources([]);
    setError("");
    setUsedFallback(false);
    setQuestion("");
  }

  const hasMessages = messages.length > 0;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white px-4 py-6">
        <div className="max-w-3xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Cho Lab Research Assistant
            </h1>
            <p className="mt-1 text-slate-300 text-sm leading-relaxed">
              Ask questions based on Cho Lab research papers. Answers are
              generated only from retrieved paper excerpts and include sources.
            </p>
          </div>
          {hasMessages && (
            <button
              onClick={handleNewChat}
              className="shrink-0 text-xs text-slate-300 border border-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-700 hover:text-white transition"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Notice — shown only when there is no conversation yet */}
        {!hasMessages && (
          <p className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5">
            This assistant answers only from indexed Cho Lab papers. Questions
            outside the database will be politely declined.
          </p>
        )}

        {/* Example chips — shown only when there is no conversation yet */}
        {!hasMessages && (
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
        )}

        {/* Conversation thread */}
        {hasMessages && (
          <div className="space-y-4">
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] bg-slate-800 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 leading-relaxed shadow-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              )
            )}

            {/* Sources for the most recent answer */}
            {sources.length > 0 && !loading && (
              <div className="pl-0">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Sources ({sources.length})
                </p>
                {usedFallback && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-3">
                    Note: AI answer service was unavailable. Showing relevant sources below.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {sources.map((s) => (
                    <SourceCard key={s.id} source={s} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm pl-1">
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

        {/* Input */}
        <ChatBox
          value={question}
          onChange={setQuestion}
          onSubmit={() => ask(question)}
          loading={loading}
        />

        {/* Memory notice */}
        <p className="text-xs text-slate-400 text-center">
          Conversation memory is stored only in this browser for up to 24 hours.
        </p>
      </div>
    </main>
  );
}