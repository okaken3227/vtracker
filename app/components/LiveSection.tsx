"use client";

import { useState } from "react";
import type { LineConfig } from "./CombinedLiveGraph";
import CombinedLiveGraph from "./CombinedLiveGraph";
import ChannelAvatar from "./ChannelAvatar";
import LiveTimer from "./LiveTimer";

type LiveEntry = {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  iconUrl: string;
  startTime: string | null;
  groupName: string | null;
  groupColor: string | null;
};

type SortKey = "elapsed" | "group";

const SORT_LABELS: Record<SortKey, string> = {
  elapsed: "配信時間",
  group: "グループ",
};

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
    /*
     * モバイル: flex-col（縦並び）
     * PC (lg): flex-row、固定高さ 460px で左右同じ高さ
     */
    <div className="flex flex-col gap-4 lg:h-[460px] lg:flex-row">

      {/* ── 左カラム: ヘッダー + コンパクトバナーリスト ── */}
      <div className="flex flex-col lg:h-full lg:w-64 lg:flex-shrink-0 xl:w-72">

        {/* ヘッダー（固定） */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-gray-900">
            <span className="animate-pulse text-red-500">●</span>
            ライブ中
            <span className="font-normal text-gray-400">
              ({sorted.length}{filterGroup ? `/${entries.length}` : ""})
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-1">
            {groupEntries.length > 1 && (
              <>
                <button
                  onClick={() => applyFilter(null)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    filterGroup === null
                      ? "bg-gray-800 text-white"
                      : "border border-gray-200 bg-white text-gray-500 hover:border-gray-400"
                  }`}
                >
                  すべて
                </button>
                {groupEntries.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => applyFilter(filterGroup === g.name ? null : g.name)}
                    style={filterGroup === g.name ? { backgroundColor: g.color, borderColor: g.color } : {}}
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                      filterGroup === g.name
                        ? "text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
                <span className="text-gray-200">|</span>
              </>
            )}
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => applySort(key)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                  sort === key
                    ? "bg-violet-600 text-white"
                    : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
                }`}
              >
                {SORT_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/*
         * バナーリスト
         * モバイル: max-h で約5件分スクロール
         * PC: flex-1 + min-h-0 で残りスペースをスクロール
         */}
        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[440px] lg:max-h-none lg:flex-1 lg:min-h-0">
          {sorted.map((v, i) => (
            <div
              key={`${v.videoId}-${animRev}`}
              style={{ animation: "sort-in 0.22s ease both", animationDelay: `${i * 40}ms` }}
            >
              {/* コンパクトカード（PC・モバイル共通） */}
              <a
                href={`/live/${v.videoId}`}
                className="row-lift flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5"
              >
                <ChannelAvatar channelId={v.channelId} name={v.channelName} iconUrl={v.iconUrl} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold leading-tight text-gray-900">{v.channelName}</p>
                  <p className="truncate text-[11px] leading-snug text-gray-500">{v.title}</p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
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

      {/* ── 右カラム: グラフ（PC では親高さいっぱい） ── */}
      <div className="flex-1 min-w-0 lg:h-full">
        <CombinedLiveGraph
          data={graphData}
          lines={sortedLines}
          fillParent
        />
      </div>
    </div>
  );
}
