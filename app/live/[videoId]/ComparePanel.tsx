"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import CombinedLiveGraph from "@/app/components/CombinedLiveGraph";
import type { LineConfig } from "@/app/components/CombinedLiveGraph";

type StreamOption = {
  videoId: string;
  title: string;
  channelName: string;
  iconUrl: string | null;
  startTime: string | null;
  status: string;
  platform: string;
};

type CompareData = {
  data: Record<string, number | string | null>[];
  lines: LineConfig[];
};

const STREAM_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#3b82f6", "#a21caf"];

function formatStartTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export default function ComparePanel({
  initialVideoId,
  initialTitle,
  initialChannelName,
  initialIconUrl,
}: {
  initialVideoId: string;
  initialTitle: string;
  initialChannelName: string;
  initialIconUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([initialVideoId]);
  const [options, setOptions] = useState<StreamOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<CompareData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOptions = useCallback((q: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.append("exclude", initialVideoId);
    fetch(`/api/compare/streams?${params}`)
      .then((r) => r.json())
      .then((data: StreamOption[]) => setOptions(data))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [initialVideoId]);

  useEffect(() => {
    if (!open) return;
    fetchOptions("");
  }, [open, fetchOptions]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOptions(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchOptions]);

  useEffect(() => {
    if (selectedIds.length < 1) return;
    setChartLoading(true);
    const params = new URLSearchParams();
    for (const id of selectedIds) params.append("v", id);
    fetch(`/api/compare?${params}`)
      .then((r) => r.json())
      .then((d: CompareData) => setChartData(d))
      .catch(() => setChartData(null))
      .finally(() => setChartLoading(false));
  }, [selectedIds]);

  const toggle = (videoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : prev.length >= 8
        ? prev
        : [...prev, videoId]
    );
  };

  const selectedColor = (videoId: string) => {
    const idx = selectedIds.indexOf(videoId);
    return idx >= 0 ? STREAM_COLORS[idx % STREAM_COLORS.length] : undefined;
  };

  return (
    <section className="mb-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-violet-400 hover:text-violet-600"
      >
        <span className="text-base leading-none">{open ? "▲" : "▼"}</span>
        他の配信と比較
        {selectedIds.length > 1 && (
          <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
            {selectedIds.length}件選択中
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {/* Selected chips */}
          <div className="mb-3 flex flex-wrap gap-2">
            <span
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              style={{ borderColor: STREAM_COLORS[0], color: STREAM_COLORS[0], backgroundColor: `${STREAM_COLORS[0]}18` }}
            >
              {initialIconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={initialIconUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
              )}
              <span className="max-w-[140px] truncate">{initialChannelName}</span>
              <span className="max-w-[120px] truncate text-gray-500">（この配信）</span>
            </span>
            {selectedIds.slice(1).map((id) => {
              const opt = options.find((o) => o.videoId === id);
              const color = selectedColor(id)!;
              return (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ borderColor: color, color, backgroundColor: `${color}18` }}
                >
                  {opt?.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={opt.iconUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                  )}
                  <span className="max-w-[160px] truncate">{opt?.channelName ?? id}</span>
                  <span className="ml-0.5 text-gray-400">×</span>
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="配信名で検索..."
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />

          {/* Stream list */}
          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100">
            {loading ? (
              <p className="p-4 text-center text-xs text-gray-400">読み込み中...</p>
            ) : options.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-400">配信が見つかりません</p>
            ) : (
              options.map((opt) => {
                const checked = selectedIds.includes(opt.videoId);
                const color = selectedColor(opt.videoId);
                return (
                  <button
                    key={opt.videoId}
                    onClick={() => toggle(opt.videoId)}
                    className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-gray-50 ${checked ? "bg-violet-50" : ""}`}
                  >
                    <span
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 text-white transition-colors"
                      style={checked ? { borderColor: color, backgroundColor: color } : { borderColor: "#d1d5db" }}
                    >
                      {checked && <svg viewBox="0 0 10 10" className="h-2.5 w-2.5"><path d="M1.5 5l2.5 2.5 5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                    {opt.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opt.iconUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="h-7 w-7 flex-shrink-0 rounded-full bg-gray-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-700">{opt.channelName}</p>
                      <p className="truncate text-[11px] text-gray-400">{opt.title}</p>
                      {opt.startTime && (
                        <p className="text-[10px] text-gray-300">{formatStartTime(opt.startTime)}</p>
                      )}
                    </div>
                    {opt.status === "live" && (
                      <span className="flex-shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">LIVE</span>
                    )}
                    {opt.platform === "twitch" && (
                      <span className="flex-shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">Twitch</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Combined graph */}
          {selectedIds.length >= 2 && (
            <div className="mt-4">
              {chartLoading ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                  グラフを読み込み中...
                </div>
              ) : chartData && chartData.data.length >= 2 ? (
                <CombinedLiveGraph data={chartData.data} lines={chartData.lines} />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                  グラフデータが不足しています
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
