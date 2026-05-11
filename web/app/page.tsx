"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const AVATAR = "/images/avatar.png";

const INITIAL_GREETING =
  "Hi! I'm Minny, the Cho Lab research assistant at Texas State University. " +
  "I've read all the papers published by the Cho Lab and I'm here to help you explore our research.\n\n" +
  "Ask me anything about snowpack, snowmelt, runoff, satellite retrievals, or other topics covered in our publications. " +
  "I'll answer using only what the papers say and always tell you which paper I'm drawing from.\n\n" +
  "I'm still learning, so I may occasionally make mistakes — please treat my answers as a helpful starting point, not a definitive source.";

const GREETING_RE =
  /^(hi+|hello+|hey+|howdy|sup|what'?s\s*up|how\s+are\s+(you|u)|good\s+(morning|afternoon|evening)|greetings|yo+|hiya|helo|hii+|heyyy*)[.!?,\s]*$/i;

const GREETING_REPLY =
  "Hi there! I'm Minny, the Cho Lab research assistant. " +
  "I can answer questions about research papers published by the Cho Lab at Texas State University — " +
  "things like snowpack changes, satellite SWE retrievals, snowmelt-driven runoff, and more.\n\n" +
  "What would you like to know?";

const EXAMPLE_QUESTIONS = [
  "What is soil moisture and why is it important for understanding how water and energy move between the Earth's surface and the atmosphere?",
  "How might knowing whether soil is wet or dry help us predict when dust storms will occur in desert regions?",
  "What is snow water equivalent (SWE) and why do scientists need accurate measurements of it?",
  "What causes coastal flooding and how is it different from river flooding or storm surge?",
  "What different types of snow exist, and how do meteorological conditions like temperature and wind affect snow properties?",
  "Why would using multiple different computer models together give us better predictions of soil freeze/thaw cycles than using just one model?",
  "How can satellite images from space help detect where subsurface drainage systems are located on farms?",
];

type ThinkingStage = "searching" | "generating";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [thinkingStage, setThinkingStage] =
    useState<ThinkingStage>("searching");
  const [error, setError] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMessages(loadChatMemory());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Advance thinking stage after 2s of loading
  useEffect(() => {
    if (loading) {
      setThinkingStage("searching");
      thinkingTimerRef.current = setTimeout(() => {
        setThinkingStage("generating");
      }, 2000);
    } else {
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
      }
    }
    return () => {
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
    };
  }, [loading]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    // Handle greetings client-side — no token spend
    if (GREETING_RE.test(trimmed)) {
      appendChatMessage({ role: "user", content: trimmed });
      const withAssistant = appendChatMessage({
        role: "assistant",
        content: GREETING_REPLY,
      });
      setMessages(withAssistant);
      setSources([]);
      setError("");
      setUsedFallback(false);
      setQuestion("");
      return;
    }

    const priorHistory = loadChatMemory();

    setLoading(true);
    setError("");
    setUsedFallback(false);
    setQuestion("");
    setSources([]);

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

      const withAssistant = appendChatMessage({
        role: "assistant",
        content: data.answer ?? "",
      });
      setMessages(withAssistant);
      setSources(data.sources ?? []);
      setUsedFallback(data.usedFallback ?? false);
    } catch {
      setError(
        "Could not reach the server. Please check your connection and try again.",
      );
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
      <header className="bg-slate-800 text-white px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src={AVATAR}
              alt="Minny avatar"
              width={40}
              height={40}
              className="rounded-full ring-2 ring-slate-600 shrink-0"
            />
            <div>
              <h1 className="text-xl font-semibold tracking-tight leading-tight">
                Minny — Cho Lab Research Assistant
              </h1>
              <p className="mt-0.5 text-slate-300 text-sm leading-relaxed">
                Answers from Cho Lab papers only · Texas State University
              </p>
            </div>
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
        {/* Minny's greeting — always shown, not stored in memory */}
        <div className="flex items-start gap-3">
          <Image
            src={AVATAR}
            alt="Minny"
            width={32}
            height={32}
            className="rounded-full ring-1 ring-slate-200 shrink-0 mt-0.5"
          />
          <div className="space-y-3 flex-1">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm prose prose-sm prose-slate max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{INITIAL_GREETING}</ReactMarkdown>
            </div>

            {/* Example chips — shown only when no conversation */}
            {!hasMessages && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
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
          </div>
        </div>

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
                <div key={i} className="flex items-start gap-3">
                  <Image
                    src={AVATAR}
                    alt="Minny"
                    width={32}
                    height={32}
                    className="rounded-full ring-1 ring-slate-200 shrink-0 mt-0.5"
                  />
                  <div className="max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ),
            )}

            {/* Source chips — inline in the thread, right after the last assistant reply */}
            {sources.length > 0 && !loading && (
              <div className="pl-11 flex flex-col gap-2">
                {usedFallback && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    AI answer service was unavailable — browse the sources below directly.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <SourceCard key={s.id} source={s} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Thinking indicator */}
        {loading && (
          <div className="flex items-center gap-3">
            <Image
              src={AVATAR}
              alt="Minny"
              width={32}
              height={32}
              className="rounded-full ring-1 ring-slate-200 shrink-0"
            />
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <LoadingDots />
              <span className="text-sm text-slate-400">
                {thinkingStage === "searching"
                  ? "Searching papers…"
                  : "Generating answer…"}
              </span>
            </div>
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
