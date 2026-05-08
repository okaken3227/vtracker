"use client";

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
  active, payload, label, iconUrl, channelName, startTime, videoId, coordinate, viewBox,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
  iconUrl?: string;
  channelName?: string;
  startTime?: string;
  videoId: string;
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
    </div>
  );
}

export default function LiveGraphSection({
  data, videoId, iconUrl, channelName, startTime, height = 320,
}: {
  data: GraphDataPoint[];
  videoId: string;
  iconUrl?: string;
  channelName?: string;
  startTime?: string;
  height?: number;
}) {
  const handleClick = (chartData: { activeLabel?: string | number | undefined }) => {
    if (chartData?.activeLabel == null) return;
    const t = Number(chartData.activeLabel);
    window.open(`https://www.youtube.com/watch?v=${videoId}&t=${t * 60}s`, "_blank");
  };

  return (
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
            dot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
            activeDot={{ r: 7, fill: "#7c3aed", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-gray-400">
        グラフをクリックするとその時刻のYouTube動画へジャンプします
      </p>
    </div>
  );
}
