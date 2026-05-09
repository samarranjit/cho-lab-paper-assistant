"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function ChatBox({ value, onChange, onSubmit, loading }: Props) {
  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) onSubmit();
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <label
        htmlFor="question"
        className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
      >
        Your question
      </label>
      <textarea
        id="question"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        disabled={loading}
        placeholder="e.g. What is runoff potential and how is it measured?"
        className="w-full resize-none text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">Enter to submit · Shift+Enter for new line</span>
        <button
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          className="bg-slate-800 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Searching…" : "Ask"}
        </button>
      </div>
    </div>
  );
}
