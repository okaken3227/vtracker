"use client";

import { useState } from "react";
import LiveGraphSection from "@/app/components/LiveGraphSection";
import SuperchatList from "./SuperchatList";
import type { GraphDataPoint } from "@/app/components/LiveGraphSection";
import type { SCItem } from "./SuperchatList";

type Props = {
  videoId: string;
  platform?: string | null;
  chartData: GraphDataPoint[];
  iconUrl?: string;
  channelName?: string;
  startTime?: string;
  twitchLogin?: string;
  scItems: SCItem[];
  scCount: number;
  totalJPY: number;
  hasMultiCurrency: boolean;
  byCurrencyOrig: [string, number][];
  byCurrencyJPY: [string, number][];
  isLive: boolean;
};

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        {/* コンテンツ */}
        <div className="overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function LiveDetailDialogs({
  videoId, platform, chartData, iconUrl, channelName, startTime,
  twitchLogin, scItems, scCount, totalJPY, hasMultiCurrency,
  byCurrencyOrig, byCurrencyJPY, isLive,
}: Props) {
  const [open, setOpen] = useState<"graph" | "sc" | null>(null);

  return (
    <>
      {/* ボタン2つ */}
      <div className="mb-8 grid grid-cols-2 gap-3">
        {/* グラフ */}
        <button
          onClick={() => setOpen("graph")}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-5 shadow-sm transition-all hover:border-violet-300 hover:shadow-md active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-violet-500">
            <path d="M3 17l4-8 4 4 4-6 4 5" />
            <path d="M3 21h18" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">同接推移</span>
          {chartData.length > 0 && (
            <span className="text-xs text-gray-400">{chartData.length}ポイント</span>
          )}
        </button>

        {/* スパチャ */}
        <button
          onClick={() => setOpen("sc")}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-amber-500">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">スパチャ一覧</span>
          <span className="text-xs text-gray-400">
            {scCount > 0 ? `${scCount}件 / ¥${totalJPY.toLocaleString()}` : "0件"}
          </span>
        </button>
      </div>

      {/* グラフダイアログ */}
      {open === "graph" && (
        <Dialog title="同接推移" onClose={() => setOpen(null)}>
          {chartData.length > 0 ? (
            <LiveGraphSection
              data={chartData}
              videoId={videoId}
              iconUrl={iconUrl}
              channelName={channelName}
              startTime={startTime}
              height={320}
              platform={platform ?? undefined}
              twitchLogin={twitchLogin}
            />
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">グラフデータがありません</p>
          )}
        </Dialog>
      )}

      {/* スパチャダイアログ */}
      {open === "sc" && (
        <Dialog
          title={`スパチャ一覧 ${scCount > 0 ? `(${scCount}件 / ¥${totalJPY.toLocaleString()})` : ""}`}
          onClose={() => setOpen(null)}
        >
          {hasMultiCurrency && (
            <p className="mb-3 text-xs text-gray-400">
              {byCurrencyOrig.map(([cur, orig], i) => {
                const jpy = byCurrencyJPY.find(([c]) => c === cur)?.[1] ?? 0;
                return (
                  <span key={cur}>
                    {i > 0 && <span className="mx-1">+</span>}
                    {cur === "JPY" ? `¥${orig.toLocaleString()}` : `${cur} ${orig.toLocaleString()} → ¥${jpy.toLocaleString()}`}
                  </span>
                );
              })}
            </p>
          )}
          {scCount === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">スパチャはありません</p>
          ) : (
            <SuperchatList videoId={videoId} platform={platform} items={scItems} />
          )}
        </Dialog>
      )}
    </>
  );
}
