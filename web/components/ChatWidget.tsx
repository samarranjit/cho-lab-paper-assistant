"use client";

/**
 * ChatWidget — Miinu, the Cho Lab Research Assistant
 *
 * Self-contained floating chat widget.
 * Drop <ChatWidget /> into any page to embed the assistant.
 * Dependencies: Next.js, React, Tailwind CSS, react-markdown, tailwind-merge, clsx.
 * No UI library required.
 */

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import SourceCard from "./SourceCard";
import LoadingDots from "./LoadingDots";
import {
  appendChatMessage,
  clearChatMemory,
  loadChatMemory,
} from "@/lib/chatMemory";
import type { AskResponse, ChatMessage, Source } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR = "/images/avatar.png";
const BRAND = "#007C92";

const INITIAL_GREETING =
  "Hi! I'm Miinu, the Cho Lab research assistant at Texas State University. " +
  "I've read all the papers published by the Cho Lab and I'm here to help you explore our research.\n\n" +
  "Ask me anything about snowpack, snowmelt, runoff, satellite retrievals, or other topics covered in our publications. " +
  "I'll answer using only what the papers say.\n\n" +
  "I'm still learning and may occasionally make mistakes — treat my answers as a helpful starting point.";

const GREETING_RE =
  /^(hi+|hello+|hey+|howdy|sup|what'?s\s*up|how\s+are\s+(you|u)|good\s+(morning|afternoon|evening)|greetings|yo+|hiya|helo|hii+|heyyy*)[.!?,\s]*$/i;

const GREETING_REPLY =
  "Hi there! I'm Miinu, the Cho Lab research assistant. " +
  "I can answer questions about research papers published by the Cho Lab at Texas State University — " +
  "topics like snowpack, satellite soil moisture, freeze/thaw cycles, and more.\n\nWhat would you like to know?";

const EXAMPLE_QUESTIONS = [
  "What is soil moisture and why is it important for water and energy exchange?",
  "How does soil moisture help predict dust storms in desert regions?",
  "What is snow water equivalent (SWE) and why is it important?",
  "What causes coastal flooding vs. river flooding?",
  "What types of snow exist and how do temperature and wind affect them?",
  "Why use multiple models for soil freeze/thaw predictions?",
  "How can satellites detect subsurface drainage on farms?",
];

// ─── Inline SVG icons (no icon library needed) ────────────────────────────────

function IconX() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconShrink() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="10" y1="14" x2="3" y2="21" />
      <line x1="21" y1="3" x2="14" y2="10" />
    </svg>
  );
}

function IconRotate() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ThinkingStage = "searching" | "generating";

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiinuBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Image
        src={AVATAR}
        alt="Miinu"
        width={28}
        height={28}
        className="rounded-full shrink-0 mt-0.5 ring-1 ring-slate-200 shadow-sm"
      />
      <div className="max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm prose prose-sm prose-slate max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white leading-relaxed"
        style={{ backgroundColor: BRAND }}
      >
        {content}
      </div>
    </div>
  );
}

function ThinkingBubble({ stage }: { stage: ThinkingStage }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src={AVATAR}
        alt="Miinu"
        width={28}
        height={28}
        className="rounded-full shrink-0 ring-1 ring-slate-200 shadow-sm"
      />
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm flex items-center gap-2">
        <LoadingDots />
        <span className="text-xs text-slate-400">
          {stage === "searching" ? "Searching papers…" : "Generating answer…"}
        </span>
      </div>
    </div>
  );
}

// ─── ChatWidget ───────────────────────────────────────────────────────────────

export default function ChatWidget() {
  // Panel state
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [thinkingStage, setThinkingStage] =
    useState<ThinkingStage>("searching");
  const [error, setError] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setMessages(loadChatMemory());
  }, []);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  useEffect(() => {
    if (loading) {
      setThinkingStage("searching");
      thinkingTimerRef.current = setTimeout(
        () => setThinkingStage("generating"),
        2000,
      );
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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function resetInputHeight() {
    if (inputRef.current) inputRef.current.style.height = "auto";
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    // Client-side greeting — zero API cost
    if (GREETING_RE.test(trimmed)) {
      appendChatMessage({ role: "user", content: trimmed });
      const updated = appendChatMessage({
        role: "assistant",
        content: GREETING_REPLY,
      });
      setMessages(updated);
      setSources([]);
      setError("");
      setUsedFallback(false);
      setQuestion("");
      resetInputHeight();
      return;
    }

    const priorHistory = loadChatMemory();
    setLoading(true);
    setError("");
    setUsedFallback(false);
    setQuestion("");
    setSources([]);
    resetInputHeight();

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
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(question);
    }
  }

  function handleNewChat() {
    clearChatMemory();
    setMessages([]);
    setSources([]);
    setError("");
    setUsedFallback(false);
    setQuestion("");
  }

  function toggleOpen() {
    setIsOpen((prev) => {
      if (prev && isExpanded) setIsExpanded(false);
      return !prev;
    });
  }

  const hasMessages = messages.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          onClick={toggleOpen}
        />
      )}

      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-label="Miinu — Cho Lab Research Assistant"
        aria-hidden={!isOpen}
        className={cn(
          "fixed z-50 flex flex-col bg-white border border-slate-200 shadow-2xl",
          "transition-all duration-200 ease-out",
          isExpanded
            ? "inset-3 rounded-2xl"
            : [
                "bottom-[88px] right-4 sm:right-6",
                "w-[calc(100vw-2rem)] sm:w-[390px]",
                "h-[78vh] sm:h-[600px]",
                "rounded-2xl",
              ],
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-3 pointer-events-none",
        )}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0 rounded-t-2xl"
          style={{ backgroundColor: BRAND }}
        >
          <Image
            src={AVATAR}
            alt="Miinu"
            width={34}
            height={34}
            className="rounded-full ring-2 ring-white/25 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">
              Miinu
            </p>
            <p className="text-white/65 text-[11px] leading-tight truncate">
              Cho Lab · Texas State University
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {hasMessages && (
              <button
                onClick={handleNewChat}
                title="New chat"
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/15 transition"
              >
                <IconRotate />
              </button>
            )}
            <button
              onClick={() => setIsExpanded((e) => !e)}
              title={isExpanded ? "Restore" : "Expand"}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/15 transition"
            >
              {isExpanded ? <IconShrink /> : <IconExpand />}
            </button>
            <button
              onClick={toggleOpen}
              title="Minimise"
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/15 transition"
            >
              <IconChevronDown />
            </button>
          </div>
        </div>

        {/* Message area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scroll"
        >
          <MiinuBubble content={INITIAL_GREETING} />

          {!hasMessages && (
            <div className="pl-9 flex flex-wrap gap-1.5 pt-0.5">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={loading}
                  className="text-[11px] bg-slate-50 border border-slate-200 text-slate-600 rounded-full px-2.5 py-1 hover:bg-white hover:border-slate-400 transition disabled:opacity-40 text-left leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <UserBubble key={i} content={msg.content} />
            ) : (
              <MiinuBubble key={i} content={msg.content} />
            ),
          )}

          {loading && <ThinkingBubble stage={thinkingStage} />}

          {error && !loading && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Sources */}
        {sources.length > 0 && !loading && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0">
            {usedFallback && (
              <p className="text-[11px] text-amber-600 mb-1.5">
                AI service unavailable — browse sources directly.
              </p>
            )}
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <SourceCard key={s.id} source={s} />
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-3 pb-3 pt-2.5 border-t border-slate-100 shrink-0">
          <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:border-[#007C92] focus-within:ring-1 focus-within:ring-[#007C92] transition">
            <textarea
              ref={inputRef}
              rows={1}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                autoResize(e.target);
              }}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask about Cho Lab research…"
              className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50 leading-relaxed"
              style={{
                minHeight: "24px",
                maxHeight: "120px",
                overflow: "hidden",
              }}
            />
            <button
              onClick={() => ask(question)}
              disabled={loading || !question.trim()}
              title="Send"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: BRAND }}
            >
              <IconSend />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-1.5">
            Enter to send · Shift+Enter for new line · memory lasts 24 h
          </p>
        </div>
      </div>

      {/* ── Floating trigger button ──────────────────────────────────────────── */}
      <button
        onClick={toggleOpen}
        aria-label={
          isOpen ? "Close chat" : "Chat with Miinu — Cho Lab Research Assistant"
        }
        className="fixed bottom-5 right-5 z-50 w-[58px] h-[58px] rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
        style={{ backgroundColor: BRAND }}
      >
        {isOpen ? (
          <span className="text-white">
            <IconX />
          </span>
        ) : (
          <Image
            src={AVATAR}
            alt="Chat with Miinu"
            width={46}
            height={46}
            className="rounded-full"
          />
        )}
      </button>
    </>
  );
}
