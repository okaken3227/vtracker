"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ChannelItem = {
  channel_id: string;
  name: string;
  icon_url: string;
  platform?: string;
  keywords?: string | null;
};

function highlight(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-transparent font-bold text-violet-600">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

export default function SearchBar({
  autoFocus = false,
  onClose,
}: {
  autoFocus?: boolean;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/channels", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setChannels(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onGlobalKey);
    return () => document.removeEventListener("keydown", onGlobalKey);
  }, []);

  const suggestions = query.trim().length < 1
    ? []
    : channels.filter((c) => {
        const q = query.toLowerCase().trim();
        if (c.name.toLowerCase().includes(q)) return true;
        if (c.keywords) {
          return c.keywords.split(",").some((kw) => kw.trim().toLowerCase().includes(q));
        }
        return false;
      }).slice(0, 8);

  const navigate = useCallback((channelId: string) => {
    router.push(`/channel/${channelId}`);
    setQuery("");
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    onClose?.();
  }, [router, onClose]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
      if (target) navigate(target.channel_id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
      onClose?.();
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* 入力欄 */}
      <div
        className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 transition-all duration-200 ${
          showDropdown
            ? "border border-gray-200 bg-white shadow-md shadow-black/5"
            : "border border-gray-200/80 bg-white/70 hover:bg-white hover:border-gray-300 hover:shadow-sm"
        }`}
      >
        <svg
          className="h-4 w-4 shrink-0 text-gray-400"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13.5 13.5 3 3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="チャンネルを検索..."
          className="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-sm"
          autoComplete="off"
          spellCheck={false}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
        />
        {query ? (
          <button
            onMouseDown={(e) => { e.preventDefault(); setQuery(""); setActiveIdx(-1); inputRef.current?.focus(); }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200/80 text-gray-500 hover:bg-gray-300 hover:text-gray-700 transition-colors"
            aria-label="クリア"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        ) : (
          <kbd className="hidden shrink-0 select-none items-center gap-0.5 rounded border border-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-300 lg:flex">
            ⌘K
          </kbd>
        )}
      </div>

      {/* サジェストドロップダウン */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg shadow-black/5">
          <div className="py-1">
            {suggestions.map((ch, i) => (
              <button
                key={ch.channel_id}
                onMouseDown={() => navigate(ch.channel_id)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === activeIdx ? "bg-violet-50" : "hover:bg-gray-50"
                }`}
              >
                {ch.icon_url ? (
                  <Image
                    src={ch.icon_url}
                    alt={ch.name}
                    width={30}
                    height={30}
                    className="shrink-0 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600"
                  >
                    {ch.name[0]}
                  </div>
                )}
                <span className="flex-1 text-sm text-gray-800">
                  {highlight(ch.name, query)}
                </span>
                {ch.platform === "twitch" && (
                  <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
                    Twitch
                  </span>
                )}
                <svg
                  className={`h-3.5 w-3.5 shrink-0 transition-colors ${i === activeIdx ? "text-violet-400" : "text-gray-200"}`}
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
