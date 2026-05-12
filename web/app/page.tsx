import ChatWidget from "@/components/ChatWidget";

/**
 * Demo page — mounts the ChatWidget.
 * To embed Miinu on any site, drop <ChatWidget /> into that page's layout.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 select-none">
      <p className="text-slate-400 text-sm">
        Click the icon in the bottom-right corner to chat with Miinu.
      </p>
      <ChatWidget />
    </main>
  );
}
