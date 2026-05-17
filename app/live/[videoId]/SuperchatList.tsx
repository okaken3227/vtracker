"use client";

import { useState, useEffect } from "react";

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

type SelectedSC = SCItem & { ytUrl: string | null; thumbnailUrl?: string };

export default function SuperchatList({
  items,
  videoId,
  startTime: _startTime,
  platform,
  thumbnailUrl,
}: {
  items: SCItem[];
  videoId?: string;
  startTime?: string | null;
  platform?: string | null;
  thumbnailUrl?: string;
}) {
  const [sort, setSort] = useState<SortKey>("time");
  const [selected, setSelected] = useState<SelectedSC | null>(null);

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
        {sorted.map(({ id, author_name, amount, currency, comment, tier, published_at, amount_jpy, bucket, isFirstInBucket }) => {
          const ytUrl = videoId && platform !== "twitch"
            ? `https://www.youtube.com/watch?v=${videoId}&t=${bucket * 60}`
            : null;
          const item: SCItem = { id, author_name, amount, currency, comment, tier, published_at, amount_jpy, bucket, isFirstInBucket };
          return (
            <div key={id}>
              {sort === "time" && isFirstInBucket && (
                <div id={`sc-${bucket}`} className="scroll-mt-20" />
              )}
              <button
                onClick={() => setSelected({ ...item, ytUrl, thumbnailUrl })}
                className={`block w-full text-left rounded-lg border px-4 py-3 transition-opacity hover:opacity-80 ${tierColor(tier)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{author_name}</span>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-sm font-bold">
                      {currency === "JPY" ? `¥${amount.toLocaleString()}` : `${currency} ${amount.toLocaleString()}`}
                    </span>
                    {currency !== "JPY" && amount_jpy != null && (
                      <span className="font-mono text-[11px] opacity-60">≈ ¥{amount_jpy.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                {comment && <p className="mt-1 text-xs opacity-80">{comment}</p>}
                <p className="mt-1 text-xs opacity-50">{formatJST(published_at)}</p>
              </button>
            </div>
          );
        })}
      </div>

      {selected && (
        <SuperchatDialog item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SuperchatDialog({ item, onClose }: { item: SelectedSC; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-gray-700 transition-colors hover:bg-black/30"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>

          {item.thumbnailUrl && (
            <div className="aspect-video w-full overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className={`p-5 ${TIER_COLORS[item.tier] ?? TIER_COLORS[1]}`}>
            <div className="flex items-start justify-between gap-3 pr-8">
              <p className="text-sm font-semibold">{item.author_name}</p>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="font-mono text-base font-bold">
                  {item.currency === "JPY"
                    ? `¥${item.amount.toLocaleString()}`
                    : `${item.currency} ${item.amount.toLocaleString()}`}
                </span>
                {item.currency !== "JPY" && item.amount_jpy != null && (
                  <span className="font-mono text-xs opacity-60">≈ ¥{item.amount_jpy.toLocaleString()}</span>
                )}
              </div>
            </div>
            {item.comment && (
              <p className="mt-2 text-sm opacity-90">{item.comment}</p>
            )}
            <p className="mt-2 text-xs opacity-50">{new Date(item.published_at).toLocaleString("ja-JP", {
              month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}</p>
          </div>

          <div className="flex gap-2 p-4">
            {item.ytUrl && (
              <a
                href={item.ytUrl}
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
            )}
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
