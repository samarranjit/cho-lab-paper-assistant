// Browser-only conversation memory using localStorage.
//
// No data ever leaves the browser. Nothing is stored in Supabase.
// Memory expires after 24 hours and is capped at 6 messages.
// All browser API access is guarded so this file is safe to import in
// Next.js server components or during SSR (reads simply return []).

import type { ChatMessage } from "./types";

export const CHAT_MEMORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_CHAT_MEMORY_MESSAGES = 6;

const STORAGE_KEY = "cho_lab_chat_memory";

type StoredChatMemory = {
  messages: ChatMessage[];
  updatedAt: number; // epoch ms
};

export function isChatMemoryExpired(updatedAt: number): boolean {
  return Date.now() - updatedAt > CHAT_MEMORY_TTL_MS;
}

// Returns stored messages, or [] if unavailable, expired, or malformed.
export function loadChatMemory(): ChatMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const stored: StoredChatMemory = JSON.parse(raw);
    if (!Array.isArray(stored.messages) || typeof stored.updatedAt !== "number") {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    if (isChatMemoryExpired(stored.updatedAt)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return stored.messages;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

// Saves messages to localStorage, keeping only the most recent MAX_CHAT_MEMORY_MESSAGES.
export function saveChatMemory(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;

  const trimmed = messages.slice(-MAX_CHAT_MEMORY_MESSAGES);
  const stored: StoredChatMemory = { messages: trimmed, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

// Appends a single message, saves, and returns the updated list.
export function appendChatMessage(message: ChatMessage): ChatMessage[] {
  const current = loadChatMemory();
  const updated = [...current, message].slice(-MAX_CHAT_MEMORY_MESSAGES);
  saveChatMemory(updated);
  return updated;
}

export function clearChatMemory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
