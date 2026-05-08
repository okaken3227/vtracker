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

const TIER_COLORS: Record<number, string> = {
  1: "border-blue-200 bg-blue-50 text-blue-700",
  2: "border-cyan-200 bg-cyan-50 text-cyan-700",
  3: "border-green-200 bg-green-50 text-green-700",
  4: "border-yellow-200 bg-yellow-50 text-yellow-700",
  5: "border-orange-200 bg-orange-50 text-orange-700",
  6: "border-red-200 bg-red-50 text-red-700",
  7: "border-pink-200 bg-pink-50 text-pink-700",
};

function tierColor(tier: number) {
  return TIER_COLORS[tier] ?? TIER_COLORS[1];
}

function formatJST(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SuperchatList({ items }: { items: SCItem[] }) {
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
        {sorted.map(({ id, author_name, amount, currency, comment, tier, published_at, bucket, isFirstInBucket }) => (
          <div key={id}>
            {sort === "time" && isFirstInBucket && (
              <div id={`sc-${bucket}`} className="scroll-mt-20" />
            )}
            <div className={`rounded-lg border px-4 py-3 ${tierColor(tier)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{author_name}</span>
                <span className="font-mono text-sm font-bold">
                  {currency} {amount.toLocaleString()}
                </span>
              </div>
              {comment && <p className="mt-1 text-xs opacity-80">{comment}</p>}
              <p className="mt-1 text-xs opacity-50">{formatJST(published_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
