"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Channel, Group } from "@/lib/types";
import { GRAPH_COLORS } from "@/lib/chartConfig";

type Metric = "viewers" | "sc" | "subs";
type ViewersMode = "live" | "past";
type PresetDays = 1 | 3 | 7;
type ChartDataPoint = Record<string, string | number | null>;
type RecentMeta = { channelId: string; videoId: string; title: string; startTime: string };

const MAX_CHANNELS = 10;
const AUTO_LIVE_LIMIT = 8;
const AUTO_DEFAULT_LIMIT = 5;

function getDateRange(days: PresetDays | null): { fromIso: string; toIso: string } {
  const toIso = new Date().toISOString();
  if (!days) return { fromIso: "", toIso };
  return { fromIso: new Date(Date.now() - days * 86400000).toISOString(), toIso };
}

function formatK(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}万`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}
function formatSC(v: number): string {
  return `¥${v.toLocaleString()}`;
}
function formatRelMin(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}分`;
  return m === 0 ? `${sign}${h}時間` : `${sign}${h}時間${m}分`;
}

// 過去配信モード用: 各チャンネルの開始時刻を0分に正規化
function normalizeToRelativeTime(
  data: ChartDataPoint[],
  meta: RecentMeta[],
  channelIds: string[]
): ChartDataPoint[] {
  const startMs = new Map(meta.map((m) => [m.channelId, new Date(m.startTime).getTime()]));
  const BUCKET_MS = 5 * 60 * 1000;

  const byChannel = new Map<string, Map<number, number>>();
  for (const row of data) {
    const tMs = new Date(String(row.t)).getTime();
    for (const channelId of channelIds) {
      const val = row[channelId];
      if (val === null || val === undefined) continue;
      const chStart = startMs.get(channelId);
      if (chStart === undefined) continue;
      const relMin = Math.round((tMs - chStart) / BUCKET_MS) * 5;
      if (!byChannel.has(channelId)) byChannel.set(channelId, new Map());
      byChannel.get(channelId)!.set(relMin, Number(val));
    }
  }

  const allMins = new Set<number>();
  for (const minMap of byChannel.values()) {
    for (const min of minMap.keys()) allMins.add(min);
  }

  return Array.from(allMins)
    .sort((a, b) => a - b)
    .map((relMin) => {
      const row: ChartDataPoint = { t: relMin };
      for (const channelId of channelIds) {
        row[channelId] = byChannel.get(channelId)?.get(relMin) ?? null;
      }
      return row;
    });
}

export default function CompareClient({
  channels,
  groups,
  liveChannelIds,
  defaultScChannelIds,
}: {
  channels: Channel[];
  groups: Group[];
  liveChannelIds: string[];
  defaultScChannelIds: string[];
}) {
  const liveSet = new Set(liveChannelIds);
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  function getGroup(ch: Channel): Group | undefined {
    if (!ch.group_id) return undefined;
    const g = groupMap.get(ch.group_id);
    if (!g) return undefined;
    return g.parent_group_id ? groupMap.get(g.parent_group_id) ?? g : g;
  }

  const top5BySubs = channels
    .filter((c) => c.subscriber_count > 0)
    .sort((a, b) => b.subscriber_count - a.subscriber_count)
    .slice(0, AUTO_DEFAULT_LIMIT)
    .map((c) => c.channel_id);

  const [metric, setMetric] = useState<Metric>("viewers");
  const [viewersMode, setViewersMode] = useState<ViewersMode>("live");
  const [presetDays, setPresetDays] = useState<PresetDays | null>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingPct, setLoadingPct] = useState(0);
  const pctTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [viewerData, setViewerData] = useState<ChartDataPoint[]>([]);
  const [scData, setScData] = useState<{ channelId: string; value: number }[]>([]);
  const [subsData, setSubsData] = useState<ChartDataPoint[]>([]);

  const [videoOffsets, setVideoOffsets] = useState<Record<string, number>>({});
  const [recentMeta, setRecentMeta] = useState<RecentMeta[]>([]);
  const [selectedMeta, setSelectedMeta] = useState<RecentMeta | null>(null);

  function handleSelectMeta(m: RecentMeta) {
    setSelectedMeta(m);
  }

  // Auto-select on metric / viewersMode change
  useEffect(() => {
    let defaults: string[];
    if (metric === "viewers") {
      if (viewersMode === "live") {
        defaults = liveChannelIds.slice(0, AUTO_LIVE_LIMIT);
      } else {
        defaults = liveChannelIds.length > 0 ? liveChannelIds.slice(0, AUTO_LIVE_LIMIT) : top5BySubs;
      }
    } else if (metric === "sc") {
      defaults = defaultScChannelIds.length > 0 ? defaultScChannelIds : top5BySubs;
    } else {
      defaults = top5BySubs;
    }
    setSelectedIds(defaults);
    setHiddenIds(new Set());
    setVideoOffsets({});
    setRecentMeta([]);
    setViewerData([]);
    setScData([]);
    setSubsData([]);
  }, [metric, viewersMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setLoadingPct(0);
    if (pctTimerRef.current) clearInterval(pctTimerRef.current);
    pctTimerRef.current = setInterval(() => {
      setLoadingPct((p) => (p < 85 ? p + 4 : p));
    }, 100);

    let url: string;
    if (metric === "viewers" && viewersMode === "past") {
      const offsets = selectedIds.map((id) => videoOffsets[id] ?? 0);
      const params = new URLSearchParams({
        type: "recent-viewers",
        channelIds: selectedIds.join(","),
        offsets: offsets.join(","),
      });
      url = `/api/compare-data?${params}`;
    } else {
      const effectiveDays = metric === "viewers" ? 1 : presetDays;
      const { fromIso, toIso } = getDateRange(effectiveDays);
      const params = new URLSearchParams({
        type: metric,
        channelIds: selectedIds.join(","),
        from: fromIso,
        to: toIso,
      });
      url = `/api/compare-data?${params}`;
    }

    try {
      const res = await fetch(url);
      const json = await res.json() as { data: unknown[]; meta?: RecentMeta[] };
      if (metric === "viewers") {
        const raw = json.data as ChartDataPoint[];
        const meta = json.meta ?? [];
        if (viewersMode === "past" && meta.length > 0) {
          setViewerData(normalizeToRelativeTime(raw, meta, selectedIds));
          setRecentMeta(meta);
        } else {
          setViewerData(raw);
        }
      } else if (metric === "sc") {
        setScData(json.data as { channelId: string; value: number }[]);
      } else {
        setSubsData(json.data as ChartDataPoint[]);
      }
    } catch { /* silent */ } finally {
      if (pctTimerRef.current) clearInterval(pctTimerRef.current);
      setLoadingPct(100);
      setTimeout(() => { setLoading(false); setLoadingPct(0); }, 700);
    }
  }, [selectedIds, metric, viewersMode, videoOffsets, presetDays]);

  useEffect(() => {
    if (selectedIds.length > 0) fetchData();
  }, [fetchData]);

  // Auto-refresh only in live mode
  useEffect(() => {
    if (metric !== "viewers" || viewersMode !== "live") return;
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [metric, viewersMode, fetchData]);

  function toggleHide(channelId: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }

  function addChannel(channelId: string) {
    if (selectedIds.includes(channelId) || selectedIds.length >= MAX_CHANNELS) return;
    setSelectedIds((prev) => [...prev, channelId]);
    setShowSearch(false);
    setSearchQuery("");
  }

  function removeChannel(channelId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== channelId));
    setHiddenIds((prev) => { const next = new Set(prev); next.delete(channelId); return next; });
    setVideoOffsets((prev) => { const next = { ...prev }; delete next[channelId]; return next; });
  }

  function prevStream(channelId: string) {
    setVideoOffsets((prev) => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }));
  }

  function nextStream(channelId: string) {
    setVideoOffsets((prev) => {
      const cur = prev[channelId] ?? 0;
      if (cur <= 0) return prev;
      const next = { ...prev };
      if (cur === 1) delete next[channelId];
      else next[channelId] = cur - 1;
      return next;
    });
  }

  const visibleIds = selectedIds.filter((id) => !hiddenIds.has(id));

  const searchResults = searchQuery.trim()
    ? channels
        .filter(
          (c) =>
            !selectedIds.includes(c.channel_id) &&
            (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (c.custom_url ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .slice(0, 20)
    : [];

  const METRIC_LABELS: Record<Metric, string> = {
    viewers: "同接",
    sc: "スパチャ",
    subs: "登録者推移",
  };

  function defaultLabel(): string {
    if (metric === "viewers" && viewersMode === "live") {
      return `ライブ中の${liveChannelIds.length}チャンネルから上位${Math.min(AUTO_LIVE_LIMIT, liveChannelIds.length)}を自動選択`;
    }
    if (metric === "sc" && defaultScChannelIds.length > 0) return "スパチャ上位5チャンネルを自動選択（変更可能）";
    return "登録者上位5チャンネルを自動選択（変更可能）";
  }

  const isPastMode = metric === "viewers" && viewersMode === "past";

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
          <span>›</span>
          <span>比較</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">VTuberチャンネル比較</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          複数のVTuberチャンネルを並べて比較できます。同時接続数の推移・スーパーチャット金額・登録者数を
          グラフで重ねて表示し、コラボ配信の同接比較や、推しチャンネルの成長を他チャンネルと比べる用途にお使いください。
        </p>
      </div>

      {/* Metric tabs */}
      <div className="mb-3 flex gap-1.5">
        {(["viewers", "sc", "subs"] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              metric === m
                ? "bg-violet-600 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Viewers sub-tabs */}
      {metric === "viewers" && (
        <div className="mb-4 flex gap-1">
          {(["live", "past"] as ViewersMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewersMode(mode)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                viewersMode === mode
                  ? "bg-gray-800 text-white"
                  : "border border-gray-200 bg-white text-gray-400 hover:border-gray-400 hover:text-gray-600"
              }`}
            >
              {mode === "live" ? (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  ライブ中
                </span>
              ) : "過去の配信"}
            </button>
          ))}
        </div>
      )}

      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {metric === "viewers" && viewersMode === "live" ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>{liveChannelIds.length}配信中 · 60秒ごとに自動更新</span>
          </div>
        ) : metric === "viewers" && viewersMode === "past" ? (
          <div className="text-xs text-gray-400">各チャンネルの最新の配信を表示。◀ で一つ前へ</div>
        ) : (
          <>
            <span className="text-xs text-gray-400">期間</span>
            {([1, 3, 7] as PresetDays[]).map((days) => (
              <button
                key={days}
                onClick={() => setPresetDays(days)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  presetDays === days
                    ? "bg-violet-600 text-white"
                    : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
                }`}
              >
                {days}日
              </button>
            ))}
            <button
              onClick={() => setPresetDays(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                presetDays === null
                  ? "bg-violet-600 text-white"
                  : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
              }`}
            >
              全期間
            </button>
          </>
        )}
      </div>

      {/* Channel chips + add button */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {selectedIds.map((channelId, idx) => {
          const ch = channelMap.get(channelId);
          const color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
          const hidden = hiddenIds.has(channelId);
          const meta = recentMeta.find((m) => m.channelId === channelId);
          const offset = videoOffsets[channelId] ?? 0;

          return (
            <div
              key={channelId}
              className="flex items-center gap-1 rounded-full border py-1 pl-1.5 pr-2 transition-all"
              style={{
                borderColor: hidden ? "#e5e7eb" : color,
                backgroundColor: hidden ? "transparent" : `${color}18`,
              }}
            >
              {ch?.icon_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ch.icon_url} alt="" className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ backgroundColor: hidden ? "#d1d5db" : color }} />
              )}
              <button
                onClick={() => toggleHide(channelId)}
                className={`max-w-[90px] truncate text-xs font-medium transition-colors ${
                  hidden ? "text-gray-300 line-through" : ""
                }`}
                style={hidden ? {} : { color }}
                title={hidden ? "クリックで表示" : "クリックで非表示"}
              >
                {ch?.name ?? channelId}
              </button>

              {/* Past mode: date + nav */}
              {isPastMode && (
                <>
                  {meta?.startTime && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      · {formatDate(meta.startTime)}
                    </span>
                  )}
                  <button
                    onClick={() => prevStream(channelId)}
                    className="flex-shrink-0 text-[10px] text-gray-400 hover:text-violet-500 transition-colors px-0.5"
                    title="前回の配信へ"
                  >
                    ◀
                  </button>
                  {offset > 0 && (
                    <button
                      onClick={() => nextStream(channelId)}
                      className="flex-shrink-0 text-[10px] text-gray-400 hover:text-violet-500 transition-colors px-0.5"
                      title="新しい配信へ"
                    >
                      ▶
                    </button>
                  )}
                </>
              )}

              <button
                onClick={() => removeChannel(channelId)}
                className="ml-0.5 flex-shrink-0 text-[11px] text-gray-300 hover:text-gray-500 transition-colors"
                aria-label="削除"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* 追加ボタン */}
        {selectedIds.length < MAX_CHANNELS && (
          <div className="relative">
            <button
              onClick={() => setShowSearch((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-violet-400 hover:text-violet-500 transition-colors"
            >
              + 追加
            </button>
            {showSearch && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setShowSearch(false); setSearchQuery(""); }} />
                <div className="absolute left-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-gray-200 bg-white shadow-xl">
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="チャンネル名で検索..."
                    className="w-full rounded-t-xl border-b border-gray-100 px-3 py-2.5 text-sm outline-none"
                  />
                  <div className="max-h-52 overflow-y-auto rounded-b-xl">
                    {searchResults.length === 0 ? (
                      <p className="p-4 text-center text-xs text-gray-400">
                        {searchQuery ? "見つかりません" : "チャンネル名を入力"}
                      </p>
                    ) : (
                      searchResults.map((ch) => {
                        const group = getGroup(ch);
                        const isLive = liveSet.has(ch.channel_id);
                        return (
                          <button
                            key={ch.channel_id}
                            onClick={() => addChannel(ch.channel_id)}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                          >
                            {ch.icon_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ch.icon_url} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                            ) : (
                              <span
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: group?.color ?? "#6b7280" }}
                              >
                                {ch.name[0]}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-800">{ch.name}</p>
                              {group && <p className="truncate text-[10px] text-gray-400">{group.name}</p>}
                            </div>
                            {isLive && (
                              <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Default label */}
      <p className="mb-4 text-[10px] text-gray-400">{defaultLabel()}</p>

      {/* Chart area */}
      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
          <p className="mb-4 text-center text-sm font-medium text-gray-500">データを読み込み中...</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${loadingPct}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">{loadingPct}%</p>
        </div>
      ) : selectedIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
          {metric === "viewers" && viewersMode === "live" && liveChannelIds.length === 0
            ? "現在ライブ中の配信はありません"
            : "チャンネルを追加してください"}
        </div>
      ) : metric === "viewers" ? (
        <ViewersChart
          data={viewerData}
          visibleIds={visibleIds}
          selectedIds={selectedIds}
          channelMap={channelMap}
          isPastMode={isPastMode}
          recentMeta={recentMeta}
          onSelectMeta={handleSelectMeta}
        />
      ) : metric === "sc" ? (
        <SCView data={scData} visibleIds={visibleIds} selectedIds={selectedIds} channelMap={channelMap} />
      ) : (
        <SubsChart data={subsData} visibleIds={visibleIds} selectedIds={selectedIds} channelMap={channelMap} />
      )}
      {selectedMeta && (
        <MetaDialog
          meta={selectedMeta}
          channel={channelMap.get(selectedMeta.channelId)}
          onClose={() => setSelectedMeta(null)}
        />
      )}
    </div>
  );
}

function MetaDialog({
  meta,
  channel,
  onClose,
}: {
  meta: RecentMeta;
  channel: Channel | undefined;
  onClose: () => void;
}) {
  const isTwitch = channel?.platform === "twitch";
  const videoUrl = isTwitch
    ? `https://www.twitch.tv/videos/${meta.videoId}`
    : `https://www.youtube.com/watch?v=${meta.videoId}`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[501] flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors text-sm"
            aria-label="閉じる"
          >
            ×
          </button>

          {channel?.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.icon_url} alt={channel.name} className="mb-3 h-10 w-10 rounded-full object-cover" />
          )}
          <p className="text-sm font-semibold leading-snug text-gray-900">{meta.title}</p>
          <p className="mt-1 text-xs text-gray-400">
            {channel?.name} · {formatDate(meta.startTime)}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={`/live/${meta.videoId}`}
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              配信データを見る
            </Link>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${isTwitch ? "bg-purple-600 hover:bg-purple-700" : "bg-red-500 hover:bg-red-600"}`}
            >
              {isTwitch ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              )}
              {isTwitch ? "Twitchで見る" : "YouTubeで見る"}
            </a>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function ViewersChart({
  data,
  visibleIds,
  selectedIds,
  channelMap,
  isPastMode,
  recentMeta,
  onSelectMeta,
}: {
  data: ChartDataPoint[];
  visibleIds: string[];
  selectedIds: string[];
  channelMap: Map<string, Channel>;
  isPastMode: boolean;
  recentMeta: RecentMeta[];
  onSelectMeta?: (meta: RecentMeta) => void;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
        {isPastMode ? "この配信のデータがありません" : "この期間の同接データがありません"}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="t"
              tickFormatter={(v) =>
                isPastMode
                  ? formatRelMin(Number(v))
                  : new Date(String(v)).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
              }
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => formatK(Number(v))}
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toLocaleString()}人`,
                channelMap.get(String(name))?.name ?? String(name),
              ]}
              labelFormatter={(v) =>
                isPastMode
                  ? `開始から ${formatRelMin(Number(v))}`
                  : new Date(String(v)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
              }
              contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "12px" }}
            />
            {selectedIds.map((channelId, idx) => (
              <Line
                key={channelId}
                type="monotone"
                dataKey={channelId}
                stroke={GRAPH_COLORS[idx % GRAPH_COLORS.length]}
                strokeWidth={visibleIds.includes(channelId) ? 2 : 0}
                dot={false}
                activeDot={visibleIds.includes(channelId) ? { r: 4, strokeWidth: 0 } : false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Past mode: stream titles */}
      {isPastMode && recentMeta.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {recentMeta.map((m) => {
              const idx = selectedIds.indexOf(m.channelId);
              const color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
              const ch = channelMap.get(m.channelId);
              return (
                <button
                  key={m.channelId}
                  onClick={() => onSelectMeta?.(m)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-violet-50/60"
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{formatDate(m.startTime)}</span>
                  <span className="text-[11px] font-medium text-gray-500 flex-shrink-0">{ch?.name}</span>
                  <span className="truncate text-[11px] text-gray-400">{m.title}</span>
                  <svg className="ml-auto h-3 w-3 flex-shrink-0 text-gray-300" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SCView({
  data,
  visibleIds,
  selectedIds,
  channelMap,
}: {
  data: { channelId: string; value: number }[];
  visibleIds: string[];
  selectedIds: string[];
  channelMap: Map<string, Channel>;
}) {
  const barData = visibleIds.map((channelId) => {
    const idx = selectedIds.indexOf(channelId);
    return {
      channelId,
      name: channelMap.get(channelId)?.name ?? channelId,
      value: data.find((d) => d.channelId === channelId)?.value ?? 0,
      color: GRAPH_COLORS[idx % GRAPH_COLORS.length],
    };
  }).sort((a, b) => b.value - a.value);

  if (barData.length === 0 || barData.every((d) => d.value === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
        この期間のスパチャデータがありません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
            <YAxis
              tickFormatter={(v) => formatSC(Number(v)).replace("¥", "")}
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              formatter={(v) => [formatSC(Number(v)), "スパチャ"]}
              contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "12px" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {barData.map((row, i) => {
            const ch = channelMap.get(row.channelId);
            return (
              <div key={row.channelId} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 flex-shrink-0 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                {ch?.icon_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ch.icon_url} alt={ch.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                )}
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="truncate text-sm font-medium text-gray-800">{row.name}</span>
                </div>
                <span className="flex-shrink-0 text-sm font-bold text-violet-600">{formatSC(row.value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SubsChart({
  data,
  visibleIds,
  selectedIds,
  channelMap,
}: {
  data: ChartDataPoint[];
  visibleIds: string[];
  selectedIds: string[];
  channelMap: Map<string, Channel>;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
        この期間の登録者データがありません
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) => formatDate(String(v))}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => formatK(Number(v))}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toLocaleString()}人`,
              channelMap.get(String(name))?.name ?? String(name),
            ]}
            labelFormatter={(v) => formatDate(String(v))}
            contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "12px" }}
          />
          {selectedIds.map((channelId, idx) => (
            <Line
              key={channelId}
              type="monotone"
              dataKey={channelId}
              stroke={GRAPH_COLORS[idx % GRAPH_COLORS.length]}
              strokeWidth={visibleIds.includes(channelId) ? 2 : 0}
              dot={false}
              activeDot={visibleIds.includes(channelId) ? { r: 4, strokeWidth: 0 } : false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
