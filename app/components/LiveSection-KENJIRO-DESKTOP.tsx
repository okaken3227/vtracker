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
  viewers: number | null;
};

type SortKey = "viewers" | "elapsed";

const SORT_LABELS: Record<SortKey, string> = {
  viewers: "同接数",
  elapsed: "配信時間",
};

function sortEntries(entries: LiveEntry[], key: SortKey): LiveEntry[] {
  return [...entries].sort((a, b) => {
    if (key === "viewers") {
      return (b.viewers ?? -1) - (a.viewers ?? -1);
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
  const [sort, setSort] = useState<SortKey>("viewers");
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
        <div className="mb-2 space-y-1.5">
          {/* 1行目: タイトル + ソートボタン */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-gray-900 shrink-0">
              <span className="animate-pulse text-red-500">●</span>
              ライブ中
              <span className="font-normal text-gray-400 text-sm">
                {sorted.length}{filterGroup ? `/${entries.length}` : ""}
              </span>
            </h2>
            <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 p-0.5">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => applySort(key)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    sort === key
                      ? "bg-white text-violet-600 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* 2行目: グループフィルタ（横スクロール） */}
          {groupEntries.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => applyFilter(null)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  filterGroup === null
                    ? "bg-gray-800 text-white"
                    : "border border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700"
                }`}
              >
                すべて
              </button>
              {groupEntries.map((g) => (
                <button
                  key={g.name}
                  onClick={() => applyFilter(filterGroup === g.name ? null : g.name)}
                  style={filterGroup === g.name ? { backgroundColor: g.color, borderColor: g.color } : {}}
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    filterGroup === g.name
                      ? "text-white"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/*
         * バナーリスト
         * モバイル: max-h で約5件分スクロール
         * PC: flex-1 + min-h-0 で残りスペースをスクロール
         */}
        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[440px] lg:max-h-none lg:flex-1 lg:min-h-0 pr-1 scrollbar-thin">
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
                  {v.viewers != null && (
                    <span className="font-mono text-[10px] font-bold tabular-nums text-gray-700">
                      {v.viewers.toLocaleString()}人
                    </span>
                  )}
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

      {/* ── 右カラム: グラフ or 動画カード ── */}
      {/*
       * モバイル/タブレット: flex-1 を外す（flex-basis:0 が h-[320px] を上書きするため）
       * デスクトップ(lg+): flex-row の親で横方向に伸びる lg:flex-1
       */}
      <div className={`min-w-0 lg:flex-1 lg:h-full ${graphData.length >= 2 ? "h-[320px] sm:h-[400px]" : ""}`}>
        {graphData.length >= 2 ? (
          <CombinedLiveGraph
            data={graphData}
            lines={sortedLines}
            fillParent
          />
        ) : (
          <div className={`grid gap-3 lg:h-full lg:content-start lg:overflow-y-auto ${
            sorted.length === 1
              ? "grid-cols-1"
              : sorted.length <= 4
              ? "grid-cols-1 sm:grid-cols-2"
              : sorted.length <= 9
              ? "grid-cols-2 sm:grid-cols-3"
              : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
          }`}>
            {sorted.map((v) => (
              <a
                key={v.videoId}
                href={`/live/${v.videoId}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity hover:opacity-90"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`}
                    alt={v.title}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-xs font-medium text-white">
                    ● LIVE
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <ChannelAvatar channelId={v.channelId} name={v.channelName} iconUrl={v.iconUrl} size={20} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-gray-900 group-hover:text-violet-600">{v.channelName}</p>
                    <p className="truncate text-[11px] text-gray-500">{v.title}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
