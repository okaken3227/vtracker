"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

export type GraphDataPoint = { t: number; viewers: number };

function formatK(v: number) {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}万`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

function elapsedToTime(startTime: string, elapsedMin: number): string {
  const d = new Date(new Date(startTime).getTime() + elapsedMin * 60000);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
}

function CustomTooltip({
  active, payload, label, iconUrl, channelName, startTime, videoId, platform, twitchLogin, coordinate, viewBox,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
  iconUrl?: string;
  channelName?: string;
  startTime?: string;
  videoId: string;
  platform?: string;
  twitchLogin?: string;
  coordinate?: { x: number; y: number };
  viewBox?: { x: number; y: number; width: number; height: number };
}) {
  if (!active || !payload?.length) return null;
  const viewers = payload[0]?.value;
  const cx = coordinate?.x ?? 0;
  const cw = (viewBox?.width ?? 0) + (viewBox?.x ?? 0);
  const flipLeft = cw > 0 && cx > cw * 0.62;
  const timeLabel = startTime ? elapsedToTime(startTime, label ?? 0) : `${label}分`;

  return (
    <div
      style={{ transform: flipLeft ? "translateX(calc(-100% - 16px))" : "translateX(16px)" }}
      className="min-w-[180px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center gap-2">
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt={channelName ?? ""} className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
        )}
        <div>
          <p className="text-xs font-medium text-gray-700">{timeLabel}</p>
          {startTime && (
            <p className="text-[10px] text-gray-400">{label}分経過</p>
          )}
        </div>
      </div>
      <p className="text-lg font-bold tracking-tight text-violet-700">
        {viewers != null ? `${viewers.toLocaleString()}人` : "—"}
      </p>
      {platform === "twitch" ? (
        twitchLogin && (
          <a
            href={`https://www.twitch.tv/${twitchLogin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-600"
            onClick={(e) => e.stopPropagation()}
          >
            <span>Twitchで見る</span>
            <span>↗</span>
          </a>
        )
      ) : (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}&t=${(label ?? 0) * 60}s`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-600"
          onClick={(e) => e.stopPropagation()}
        >
          <span>この時点の動画へジャンプ</span>
          <span>↗</span>
        </a>
      )}
    </div>
  );
}

function StarDot({ cx, cy, color }: { cx?: number; cy?: number; color: string }) {
  if (cx == null || cy == null) return null;
  const R = 10;
  const r = R * 0.42;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a1 = (i * 72 - 90) * (Math.PI / 180);
    const a2 = a1 + 36 * (Math.PI / 180);
    return `${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)} ${cx + r * Math.cos(a2)},${cy + r * Math.sin(a2)}`;
  }).join(" ");
  return <polygon points={pts} fill={color} stroke="white" strokeWidth={2} />;
}

type SelectedPoint = { t: number; viewers: number; url: string; label: string; thumbnailUrl?: string };

function GraphDialog({ point, onClose }: { point: SelectedPoint; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* モバイル: ボトムシート / PC: 中央モーダル */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
        <div
          className="relative w-full sm:max-w-sm overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ドラッグハンドル（モバイルのみ） */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-gray-300" />
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            {point.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={point.thumbnailUrl} alt="" className="h-14 w-24 flex-shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">{point.label}</p>
              <p className="text-xl font-bold text-violet-700">{point.viewers.toLocaleString()}人</p>
            </div>
          </div>

          <div className="flex gap-2 px-4 pb-4">
            <a
              href={point.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              この時点の動画へ
            </a>
            <button
              onClick={onClose}
              className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-violet-300 hover:text-violet-600"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LiveGraphSection({
  data, videoId, iconUrl, channelName, startTime, height = 320, platform, twitchLogin, thumbnailUrl,
}: {
  data: GraphDataPoint[];
  videoId: string;
  iconUrl?: string;
  channelName?: string;
  startTime?: string;
  height?: number;
  platform?: string;
  twitchLogin?: string;
  thumbnailUrl?: string;
}) {
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);

  const peakPoint = data.length > 0
    ? data.reduce((best, p) => p.viewers > best.viewers ? p : best, data[0])
    : null;

  const handleClick = (chartData: { activeLabel?: string | number | undefined; activePayload?: { value: number }[] }) => {
    if (chartData?.activeLabel == null) return;
    const t = Number(chartData.activeLabel);
    const viewers = chartData.activePayload?.[0]?.value ?? data.find((d) => d.t === t)?.viewers ?? 0;
    const label = startTime ? elapsedToTime(startTime, t) : `${t}分`;

    if (platform === "twitch") {
      if (!twitchLogin) return;
      setSelectedPoint({ t, viewers, url: `https://www.twitch.tv/${twitchLogin}`, label, thumbnailUrl });
      return;
    }
    setSelectedPoint({ t, viewers, url: `https://www.youtube.com/watch?v=${videoId}&t=${t * 60}s`, label, thumbnailUrl });
  };

  return (
    <>
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          onClick={handleClick}
          style={{ cursor: "pointer" }}
          margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) =>
              startTime ? elapsedToTime(startTime, Number(v)) : `${v}分`
            }
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={(props) => {
              const p = props as unknown as {
                active?: boolean;
                payload?: { value: number }[];
                label?: number;
                coordinate?: { x: number; y: number };
                viewBox?: { x: number; y: number; width: number; height: number };
              };
              return (
                <CustomTooltip
                  active={p.active}
                  payload={p.payload}
                  label={p.label}
                  iconUrl={iconUrl}
                  channelName={channelName}
                  startTime={startTime}
                  videoId={videoId}
                  platform={platform}
                  twitchLogin={twitchLogin}
                  coordinate={p.coordinate}
                  viewBox={p.viewBox}
                />
              );
            }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="viewers"
            stroke="#7c3aed"
            strokeWidth={2.5}
            dot={(props: { cx?: number; cy?: number; payload?: GraphDataPoint }) => {
              if (peakPoint && props.payload?.t === peakPoint.t) {
                return <StarDot key={`star-${props.payload.t}`} cx={props.cx} cy={props.cy} color="#7c3aed" />;
              }
              return <g key={`empty-${props.payload?.t}`} />;
            }}
            activeDot={{ r: 7, fill: "#7c3aed", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {platform === "twitch" ? (
        twitchLogin && (
          <p className="mt-2 text-center text-[11px] text-gray-400">クリックでTwitchチャンネルへ</p>
        )
      ) : (
        <p className="mt-2 text-center text-[11px] text-gray-400">クリックでYouTube動画の該当時刻へジャンプ</p>
      )}
    </div>

    {selectedPoint && (
      <GraphDialog point={selectedPoint} onClose={() => setSelectedPoint(null)} />
    )}
    </>
  );
}
