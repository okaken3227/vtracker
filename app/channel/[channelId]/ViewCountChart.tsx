"use client";

import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Brush,
} from "recharts";
import type { ChannelStatsHistory } from "@/lib/types";

function formatCount(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}万`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-cyan-100 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-0.5 text-[10px] text-gray-400">{label ? formatDate(String(label)) : ""}</p>
      <p className="text-sm font-semibold text-cyan-600">{payload[0].value.toLocaleString()}<span className="ml-0.5 text-xs font-normal text-gray-400">回</span></p>
    </div>
  );
}

export default function ViewCountChart({ data }: { data: ChannelStatsHistory[] }) {
  const counts = data.map((d) => d.view_count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const pad = Math.max(Math.round((max - min) * 0.1), 1);
  const domain: [number, number] = [Math.max(0, min - pad), max + pad];

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-50 to-white p-4 shadow-sm ring-1 ring-cyan-100">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="recorded_at"
            tickFormatter={formatDate}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            domain={domain}
            tickFormatter={formatCount}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#06b6d4", strokeWidth: 1, strokeDasharray: "4 2" }} />
          <Area
            type="monotone"
            dataKey="view_count"
            stroke="#06b6d4"
            strokeWidth={2.5}
            fill="url(#viewGrad)"
            dot={false}
            activeDot={{ r: 5, fill: "#06b6d4", stroke: "white", strokeWidth: 2 }}
          />
          <Brush
            dataKey="recorded_at"
            tickFormatter={formatDate}
            height={22}
            stroke="#cffafe"
            fill="#ecfeff"
            travellerWidth={6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
