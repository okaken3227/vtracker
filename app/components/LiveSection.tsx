"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LineConfig } from "./CombinedLiveGraph";
import CombinedLiveGraph from "./CombinedLiveGraph";
import ChannelAvatar from "./ChannelAvatar";
import LiveTimer from "./LiveTimer";
import PlatformIcon from "./PlatformIcon";

type LiveEntry = {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  iconUrl: string;
  startTime: string | null;
  groupName: string | null;
  groupColor: string | null;
  platform?: string | null;
};

type SortKey = "elapsed" | "group";

function sortEntries(entries: LiveEntry[], key: SortKey): LiveEntry[] {
  return [...entries].sort((a, b) => {
    if (key === "group") {
      const ga = a.groupName ?? "￿";
      const gb = b.groupName ?? "￿";
      return ga.localeCompare(gb, "ja") || a.channelName.localeCompare(b.channelName, "ja");
    }
    const ae = a.startTime ? Date.now() - new Date(a.startTime).getTime() : 0;
    const be = b.startTime ? Date.now() - new Date(b.startTime).getTime() : 0;
    return be - ae;
  });
}

export default function LiveSection({
  entries,
  graphData,
  graphLines,
}: {
  entries: LiveEntry[];
  graphData: Record<string, number | string | null>[];
  graphLines: LineConfig[];
}) {
  const [sort, setSort] = useState<SortKey>("elapsed");
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [animRev, setAnimRev] = useState(0);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done">("idle");
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();

  async function handleRefresh() {
    if (refreshState === "loading") return;
    setRefreshState("loading");
    await fetch("/api/poll/live", { method: "POST" }).catch(() => {});
    router.refresh();
    setRefreshState("done");
    setTimeout(() => setRefreshState("idle"), 2500);
  }

  const groupEntries = Array.from(
    new Map(
      entries
        .filter((e) => e.groupName)
        .map((e) => [e.groupName!, { name: e.groupName!, color: e.groupColor ?? "#6b7280" }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, "ja"));

  function applySort(key: SortKey) {
    if (key === sort) return;
    setSort(key);
    setAnimRev((r) => r + 1);
  }

  function applyFilter(group: string | null) {
    setFilterGroup(group);
    setAnimRev((r) => r + 1);
  }

  const filtered = filterGroup ? entries.filter((e) => e.groupName === filterGroup) : entries;
  const sorted = sortEntries(filtered, sort);

  const sortedLines = [...graphLines]
    .filter((l) => sorted.some((e) => e.videoId === l.key))
    .sort((a, b) => {
      const ia = sorted.findIndex((e) => e.videoId === a.key);
      const ib = sorted.findIndex((e) => e.videoId === b.key);
      return ia - ib;
    });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

      {/* ── 左カラム ── */}
      <div className="flex flex-col lg:w-64 lg:flex-shrink-0 xl:w-72">

        {/* 1行目: タイトル + 折りたたみ */}
        <div className="flex items-center gap-1.5">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-gray-900">
            <span className="animate-pulse text-red-500">●</span>
            ライブ中
            <span className="font-normal text-gray-400 text-sm">
              {filterGroup ? `${sorted.length}/${entries.length}` : entries.length}
            </span>
          </h2>
          <button
            onClick={() => setIsOpen((v) => !v)}
            title={isOpen ? "バナーを閉じる" : "バナーを開く"}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
        </div>

        {/* 2行目: ソート + 更新（開いているときのみ） */}
        {isOpen && (
          <div className="mb-2 mt-1.5 flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5 text-xs font-medium">
              <button
                onClick={() => applySort("elapsed")}
                className={`rounded-full px-2.5 py-1 transition-all ${
                  sort === "elapsed"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                時間順
              </button>
              <button
                onClick={() => applySort("group")}
                className={`rounded-full px-2.5 py-1 transition-all ${
                  sort === "group"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                グループ
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshState === "loading"}
              title={refreshState === "done" ? "更新完了" : "グラフを更新"}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-50 ${
                refreshState === "done"
                  ? "text-green-500"
                  : "text-gray-400 hover:bg-violet-50 hover:text-violet-600"
              }`}
            >
              <svg
                className={`h-3.5 w-3.5 ${refreshState === "loading" ? "animate-spin" : ""}`}
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              >
                {refreshState === "done" ? (
                  <path d="M3 8l3.5 3.5L13 5" />
                ) : (
                  <>
                    <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" />
                    <path d="M13.5 2.5v3h-3" />
                  </>
                )}
              </svg>
            </button>
          </div>
        )}

        {/* グループフィルター・バナーリスト（折りたたみ対象） */}
        {isOpen && groupEntries.length > 1 && (
          <div
            className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
          >
            <button
              onClick={() => applyFilter(null)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filterGroup === null
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700"
              }`}
            >
              すべて
            </button>
            {groupEntries.map((g) => (
              <button
                key={g.name}
                onClick={() => applyFilter(filterGroup === g.name ? null : g.name)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  filterGroup === g.name
                    ? "text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
                style={
                  filterGroup === g.name
                    ? { backgroundColor: g.color, borderColor: g.color }
                    : {}
                }
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: filterGroup === g.name ? "rgba(255,255,255,0.7)" : g.color }}
                />
                {g.name}
              </button>
            ))}
          </div>
        )}

        {/* バナーリスト */}
        {isOpen && (
        <div>
          <div className="flex flex-col gap-1.5">
            {sorted.map((v, i) => (
              <div
                key={`${v.videoId}-${animRev}`}
                style={{ animation: "sort-in 0.22s ease both", animationDelay: `${i * 40}ms` }}
              >
                <a
                  href={`/live/${v.videoId}`}
                  className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/60 px-2.5 py-2 transition-all hover:border-red-200 hover:bg-red-50 hover:shadow-sm"
                >
                  {v.groupColor && (
                    <div
                      className="h-8 w-0.5 shrink-0 rounded-full opacity-60"
                      style={{ backgroundColor: v.groupColor }}
                    />
                  )}
                  <ChannelAvatar channelId={v.channelId} name={v.channelName} iconUrl={v.iconUrl} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold leading-tight text-gray-900">{v.channelName}</p>
                    <p className="truncate text-xs leading-snug text-gray-500">{v.title}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <div className="rounded-full bg-white/80 p-0.5 shadow-sm">
                      <PlatformIcon platform={v.platform} size={10} />
                    </div>
                    <span className="animate-pulse text-[10px] text-red-400">●</span>
                    {v.startTime && (
                      <LiveTimer
                        startTime={v.startTime}
                        className="font-mono text-[10px] tabular-nums text-red-400"
                      />
                    )}
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* ── 右カラム: グラフ ── */}
      <div className="min-w-0 flex-1">
        <CombinedLiveGraph
          data={graphData}
          lines={sortedLines}
        />
      </div>
    </div>
  );
}
