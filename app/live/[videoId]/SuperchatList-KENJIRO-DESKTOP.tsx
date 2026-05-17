"use client";

import { useState } from "react";

export type SCItem = {
  id: string;
  author_name: string;
  amount: number;
  currency: string;
  comment: string;
  tier: number;
  published_at: string;
  amount_jpy: number | null;
  bucket: number;
  isFirstInBucket: boolean;
};

type SortKey = "time" | "amount";

// YouTube SuperChat 公式配色（円換算額基準）
function scStyle(amountJpy: number): { card: string; badge: string } {
  if (amountJpy >= 10000) return { card: "border-red-500 bg-red-500 text-white",         badge: "bg-red-700 text-white" };
  if (amountJpy >= 5000)  return { card: "border-fuchsia-500 bg-fuchsia-500 text-white", badge: "bg-fuchsia-700 text-white" };
  if (amountJpy >= 2000)  return { card: "border-orange-400 bg-orange-400 text-white",   badge: "bg-orange-600 text-white" };
  if (amountJpy >= 1000)  return { card: "border-yellow-300 bg-yellow-300 text-gray-900", badge: "bg-yellow-500 text-gray-900" };
  if (amountJpy >= 500)   return { card: "border-green-400 bg-green-400 text-white",     badge: "bg-green-600 text-white" };
  if (amountJpy >= 200)   return { card: "border-cyan-400 bg-cyan-400 text-white",       badge: "bg-cyan-600 text-white" };
  return                         { card: "border-blue-400 bg-blue-400 text-white",        badge: "bg-blue-600 text-white" };
}

function formatJST(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// 配信内経過時間を H:MM:SS / MM:SS 形式に
function formatOffset(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SuperchatList({
  items,
  videoId,
  startTime,
}: {
  items: SCItem[];
  videoId: string;
  startTime?: string | null;
}) {
  const [sort, setSort] = useState<SortKey>("time");

  const sorted =
    sort === "amount"
      ? [...items].sort((a, b) => (b.amount_jpy ?? b.amount) - (a.amount_jpy ?? a.amount))
      : items;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        {(["time", "amount"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              sort === key
                ? "bg-violet-600 text-white"
                : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
            }`}
          >
            {key === "time" ? "時系列" : "金額順"}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map(({ id, author_name, amount, currency, comment, published_at, amount_jpy, bucket, isFirstInBucket }) => {
          const jpy = amount_jpy ?? (currency === "JPY" ? amount : 0);
          const { card, badge } = scStyle(jpy);

          const offsetSec = startTime
            ? Math.max(0, Math.floor((new Date(published_at).getTime() - new Date(startTime).getTime()) / 1000))
            : null;
          const offsetLabel = offsetSec != null ? formatOffset(offsetSec) : null;
          const ytUrl = offsetSec != null
            ? `https://www.youtube.com/watch?v=${videoId}&t=${offsetSec}s`
            : `https://www.youtube.com/watch?v=${videoId}`;

          return (
            <div key={id}>
              {sort === "time" && isFirstInBucket && (
                <div id={`sc-${bucket}`} className="scroll-mt-20" />
              )}

              <a
                href={ytUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`group/sc relative block overflow-hidden rounded-xl border ${card}`}
              >
                {/* 上段: 名前 + 金額バッジ */}
                <div className="flex items-center justify-between gap-2 px-4 py-2">
                  <span className="truncate text-sm font-bold">{author_name}</span>
                  <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                    <span className={`rounded-full px-2.5 py-0.5 font-mono text-sm font-bold ${badge}`}>
                      {currency === "JPY" ? `¥${amount.toLocaleString()}` : `${currency} ${amount.toLocaleString()}`}
                    </span>
                    {currency !== "JPY" && amount_jpy != null && (
                      <span className="font-mono text-xs font-medium opacity-80">約 {amount_jpy.toLocaleString()} 円</span>
                    )}
                  </div>
                </div>

                {/* 下段: コメント + 時刻 */}
                <div className="border-t border-white/20 bg-black/10 px-4 py-1.5">
                  {comment && <p className="text-xs leading-snug opacity-90">{comment}</p>}
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] opacity-50">
                    <span>{formatJST(published_at)}</span>
                    {offsetLabel && (
                      <>
                        <span>·</span>
                        <span>配信 {offsetLabel}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* ホバーオーバーレイ */}
                {offsetLabel && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2.5 bg-black/50 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover/sc:opacity-100">
                    <svg className="h-8 w-8 flex-shrink-0 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.2 5 12 5 12 5s-4.2 0-7 .1c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.2.8C6.8 19 12 19 12 19s4.2 0 7-.1c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8zM10 15V9l5.5 3-5.5 3z"/>
                    </svg>
                    <div className="text-white drop-shadow">
                      <p className="text-[10px] font-medium opacity-80">このLIVEの</p>
                      <p className="font-mono text-xl font-bold tracking-wide">{offsetLabel}を見る</p>
                    </div>
                  </div>
                )}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
