"use client";

import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Brush,
} from "recharts";
import type { ChannelStatsHistory } from "@/lib/types";

function formatK(v: number) {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}万`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-violet-100 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-0.5 text-[10px] text-gray-400">{label ? formatDate(String(label)) : ""}</p>
      <p className="text-sm font-semibold text-violet-700">{payload[0].value.toLocaleString()}<span className="ml-0.5 text-xs font-normal text-gray-400">人</span></p>
    </div>
  );
}

export default function SubscriberChart({ data }: { data: ChannelStatsHistory[] }) {
  const counts = data.map((d) => d.subscriber_count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const pad = Math.max(Math.round((max - min) * 0.1), 1);
  const domain: [number, number] = [Math.max(0, min - pad), max + pad];

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm ring-1 ring-violet-100">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
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
            tickFormatter={formatK}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#7c3aed", strokeWidth: 1, strokeDasharray: "4 2" }} />
          <Area
            type="monotone"
            dataKey="subscriber_count"
            stroke="#7c3aed"
            strokeWidth={2.5}
            fill="url(#subGrad)"
            dot={false}
            activeDot={{ r: 5, fill: "#7c3aed", stroke: "white", strokeWidth: 2 }}
          />
          <Brush
            dataKey="recorded_at"
            tickFormatter={formatDate}
            height={22}
            stroke="#ede9fe"
            fill="#f5f3ff"
            travellerWidth={6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
