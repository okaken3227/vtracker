"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  videoId?: string;
};

export default function RefreshButton({ videoId }: Props) {
  const router = useRouter();
  const [pollStatus, setPollStatus] = useState<"idle" | "loading" | "done">("idle");
  const [graphStatus, setGraphStatus] = useState<"idle" | "loading" | "done">("idle");

  const handlePoll = async () => {
    if (pollStatus === "loading") return;
    setPollStatus("loading");
    await fetch("/api/poll/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: videoId ? JSON.stringify({ videoId }) : undefined,
    }).catch(() => {});
    if (videoId) {
      // 個別ページはそのまま画面も更新
      router.refresh();
    }
    setPollStatus("done");
    setTimeout(() => setPollStatus("idle"), 2000);
  };

  const handleGraph = () => {
    if (graphStatus === "loading") return;
    setGraphStatus("loading");
    router.refresh();
    setGraphStatus("done");
    setTimeout(() => setGraphStatus("idle"), 2000);
  };

  if (videoId) {
    return (
      <button
        onClick={handlePoll}
        disabled={pollStatus === "loading"}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-600 disabled:opacity-50"
      >
        <span className={pollStatus === "loading" ? "animate-spin" : ""}>
          {pollStatus === "loading" ? "⟳" : pollStatus === "done" ? "✓" : "↻"}
        </span>
        {pollStatus === "loading" ? "更新中..." : pollStatus === "done" ? "更新しました" : "今すぐ更新"}
      </button>
    );
  }

  // ヘッダー用: 2つのボタン（モバイルはアイコンのみ）
  return (
    <>
      <button
        onClick={handlePoll}
        disabled={pollStatus === "loading"}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 sm:px-3"
      >
        <span className={pollStatus === "loading" ? "animate-spin" : ""}>{pollStatus === "loading" ? "⟳" : pollStatus === "done" ? "✓" : "↻"}</span>
        <span className="hidden sm:inline">{pollStatus === "loading" ? "取得中..." : pollStatus === "done" ? "取得完了" : "今すぐ更新"}</span>
      </button>
      <button
        onClick={handleGraph}
        disabled={graphStatus === "loading"}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 sm:px-3"
      >
        <span>{graphStatus === "done" ? "✓" : "⬡"}</span>
        <span className="hidden sm:inline">{graphStatus === "done" ? "更新しました" : "グラフ更新"}</span>
      </button>
    </>
  );
}
