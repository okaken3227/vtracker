"use client";

import { useState } from "react";

type PlaylistChannel = {
  channelId: string;
  channelName: string;
  ok: boolean;
  error?: string;
  videoCount: number;
  videoIds: string[];
};

type ApiResult = {
  videoId: string;
  title: string;
  channelId: string;
  status: string;
  wasInDb: boolean;
  previousStatus: string | null;
};

type DebugResult = {
  summary: {
    totalChannels: number;
    totalPlaylistVideos: number;
    dbLiveCount: number;
    toCheckCount: number;
    skippedNoneCount: number;
    apiCheckedCount: number;
    finalLiveCount: number;
  };
  playlistPerChannel: PlaylistChannel[];
  dbAlreadyLive: { videoId: string; title: string }[];
  skippedBecauseNone: { videoId: string; title: string }[];
  apiResults: ApiResult[];
  finalLive: { videoId: string; title: string; source: string }[];
};

const STATUS_COLOR: Record<string, string> = {
  live: "bg-red-100 text-red-700",
  upcoming: "bg-yellow-100 text-yellow-700",
  none: "bg-gray-100 text-gray-500",
  error: "bg-orange-100 text-orange-700",
};

const STEPS = [
  {
    num: "1",
    title: "アップロードプレイリスト取得",
    desc: "YouTube Data API の playlistItems.list を使って、各チャンネルの最新10動画IDを取得します（1ユニット/チャンネル）。チャンネルIDの先頭「UC」を「UU」に変換したIDがプレイリストIDになります。",
    color: "bg-blue-50 border-blue-200",
    badge: "API: playlistItems.list",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    num: "2",
    title: "DB照合（ステータス確認）",
    desc: "取得した動画IDをまとめてDBに問い合わせ、すでに登録されている動画のステータスを確認します。「live」ならそのまま確定。「none（終了済）」は再確認をスキップ。「upcoming（配信予定）」または未登録は次のAPI確認へ回します。",
    color: "bg-gray-50 border-gray-200",
    badge: "DB: videos テーブル",
    badgeColor: "bg-gray-200 text-gray-700",
  },
  {
    num: "3",
    title: "ステータス確認（YouTube API）",
    desc: "「upcoming」か未登録の動画を YouTube Data API の videos.list で一括確認します（最大50本を1回のAPIコールでまとめて処理、1ユニット/50本）。liveStreamingDetails から実際のライブ状態を判定し、DBに反映します。",
    color: "bg-violet-50 border-violet-200",
    badge: "API: videos.list",
    badgeColor: "bg-violet-100 text-violet-700",
  },
];

export default function DebugPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState("");
  const [expandPlaylist, setExpandPlaylist] = useState(false);
  const [expandApi, setExpandApi] = useState(false);

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/debug/live", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "unknown error");
      setResult(data as DebugResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ライブ検出デバッグ</h1>
        <p className="mt-1 text-sm text-gray-500">
          ボタンを押すと、登録チャンネルがライブ中かどうかを検出するまでの全ステップをリアルタイムで実行し、結果を表示します。
        </p>
      </div>

      {/* 検出の仕組み説明 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">検出の仕組み（3ステップ）</h2>
        <div className="flex flex-col gap-3">
          {STEPS.map((step) => (
            <div key={step.num} className={`rounded-lg border p-3 ${step.color}`}>
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-white">{step.num}</span>
                <span className="text-sm font-semibold text-gray-800">{step.title}</span>
                <span className={`ml-auto rounded px-2 py-0.5 text-xs font-medium ${step.badgeColor}`}>{step.badge}</span>
              </div>
              <p className="pl-7 text-xs leading-relaxed text-gray-600">{step.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs text-amber-700">
            <span className="font-semibold">⚠ 「none」スキップに注意：</span>
            DBで「終了済（none）」と記録された動画は再チェックされません。同じIDで再配信された場合やライブが誤ってnoneになった場合は、下の「statusリセット」ボタンで修正できます。
          </p>
        </div>
      </section>

      <button
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
      >
        {loading ? "検出中..." : "▶ 今すぐ検出を実行"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* サマリー */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">実行結果サマリー</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="登録チャンネル数" value={result.summary.totalChannels} sub="対象チャンネル" />
              <Stat label="プレイリスト取得動画数" value={result.summary.totalPlaylistVideos} sub="ステップ①の結果" />
              <Stat label="DB確定LIVE" value={result.summary.dbLiveCount} sub="ステップ②でLIVE確定" color="text-red-600" />
              <Stat label="API確認した動画数" value={result.summary.apiCheckedCount} sub="ステップ③で確認" />
              <Stat label="noneでスキップ" value={result.summary.skippedNoneCount} sub="再チェック対象外" color="text-amber-500" />
              <Stat label="最終LIVE数" value={result.summary.finalLiveCount} sub="検出合計" color="text-red-600" bold />
            </div>
          </section>

          {/* 最終LIVEリスト */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              検出したLIVE配信
              <span className="ml-2 font-normal text-gray-400">({result.finalLive.length}件)</span>
            </h2>
            {result.finalLive.length === 0 ? (
              <p className="text-sm text-gray-400">ライブ中の配信は見つかりませんでした</p>
            ) : (
              <div className="flex flex-col gap-2">
                {result.finalLive.map((v) => (
                  <div key={v.videoId} className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-2.5">
                    <span className="animate-pulse text-red-500">●</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{v.title}</p>
                      <p className="text-xs text-gray-400">
                        {v.videoId}
                        <span className="ml-2 text-gray-300">—</span>
                        <span className="ml-2">{v.source === "db" ? "DBで確定（ステップ②）" : "APIで確認（ステップ③）"}</span>
                      </p>
                    </div>
                    <a
                      href={`https://www.youtube.com/watch?v=${v.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs text-red-500 hover:underline"
                    >
                      YouTube ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* noneでスキップされたもの（プルダウン）*/}
          {result.skippedBecauseNone.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-2 p-5">
                  <span className="text-sm font-semibold text-amber-700">
                    ⚠ 「終了済（none）」のためスキップされた動画
                  </span>
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {result.skippedBecauseNone.length}件
                  </span>
                  <span className="ml-auto text-xs text-amber-400">▼ 開く</span>
                </summary>
                <div className="px-5 pb-5">
                  <p className="mb-3 text-xs text-amber-700">
                    DBに「status = none（終了済）」で登録されており、ステップ③の再確認がスキップされています。
                    ライブ中のはずなのに検出されない場合は「statusリセット」を押してください。
                    「upcoming（配信予定）」に戻り、次のポーリングでAPIが再確認します。
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {result.skippedBecauseNone.map((v) => (
                      <div key={v.videoId} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs border border-amber-200">
                        <span className="min-w-0 flex-1 truncate text-gray-700">{v.title}</span>
                        <span className="flex-shrink-0 font-mono text-gray-400">{v.videoId}</span>
                        <a
                          href={`https://www.youtube.com/watch?v=${v.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-amber-600 hover:underline"
                        >
                          確認 ↗
                        </a>
                        <ResetButton videoId={v.videoId} />
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </section>
          )}

          {/* API結果（ステップ③詳細）*/}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <button
              onClick={() => setExpandApi((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-700"
            >
              <span>
                ステップ③ videos.list の確認結果
                <span className="ml-2 font-normal text-gray-400">({result.apiResults.length}件)</span>
              </span>
              <span className="text-gray-400">{expandApi ? "▲" : "▼"}</span>
            </button>
            <p className="mt-1 text-xs text-gray-400">
              DBに「upcoming」または未登録だった動画を YouTube API に問い合わせた結果です。ここで「live」になった動画が最終的に検出されます。
            </p>
            {expandApi && (
              <div className="mt-3 flex flex-col gap-1.5">
                {result.apiResults.length === 0 ? (
                  <p className="text-xs text-gray-400">確認対象がありませんでした（すべてDB確定または noneスキップ）</p>
                ) : (
                  result.apiResults.map((r, i) => (
                    <div key={`${r.videoId}-${i}`} className="flex items-center gap-2 rounded bg-gray-50 px-3 py-1.5 text-xs">
                      <span className={`flex-shrink-0 rounded px-1.5 py-0.5 font-mono font-medium ${STATUS_COLOR[r.status] ?? "bg-gray-100"}`}>
                        {r.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-gray-700">{r.title || r.videoId}</span>
                      {r.wasInDb && r.previousStatus && (
                        <span className="flex-shrink-0 text-gray-300">DB前: {r.previousStatus}</span>
                      )}
                      {!r.wasInDb && (
                        <span className="flex-shrink-0 text-blue-300">DB未登録</span>
                      )}
                      <a
                        href={`https://www.youtube.com/watch?v=${r.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-violet-400 hover:underline"
                      >
                        ↗
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          {/* チャンネル別プレイリスト取得結果（ステップ①詳細）*/}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <button
              onClick={() => setExpandPlaylist((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-700"
            >
              <span>
                ステップ① チャンネル別プレイリスト取得結果
                <span className="ml-2 font-normal text-gray-400">({result.playlistPerChannel.length}件)</span>
              </span>
              <span className="text-gray-400">{expandPlaylist ? "▲" : "▼"}</span>
            </button>
            <p className="mt-1 text-xs text-gray-400">
              各チャンネルの playlistItems.list が成功したか、何件の動画IDを取得したかを確認できます。「✗」のチャンネルはAPIキーの権限か動画ゼロの可能性があります。
            </p>
            {expandPlaylist && (
              <div className="mt-3 flex flex-col gap-1">
                {result.playlistPerChannel.map((ch) => (
                  <div key={ch.channelId} className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs ${ch.ok ? "bg-gray-50" : "bg-red-50"}`}>
                    <span className={`flex-shrink-0 font-medium ${ch.ok ? "text-green-600" : "text-red-500"}`}>
                      {ch.ok ? "✓" : "✗"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-gray-700">{ch.channelName}</span>
                    {ch.ok ? (
                      <span className="flex-shrink-0 text-gray-400">{ch.videoCount}件取得</span>
                    ) : (
                      <span className="flex-shrink-0 text-red-400">{ch.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color, bold }: { label: string; value: number; sub: string; color?: string; bold?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-0.5 text-lg font-${bold ? "bold" : "semibold"} ${color ?? "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-300">{sub}</p>
    </div>
  );
}

function ResetButton({ videoId }: { videoId: string }) {
  const [done, setDone] = useState(false);
  async function reset() {
    await fetch("/api/debug/reset-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });
    setDone(true);
  }
  return (
    <button
      onClick={reset}
      disabled={done}
      className="flex-shrink-0 rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-300 disabled:opacity-50"
    >
      {done ? "リセット済み ✓" : "statusリセット"}
    </button>
  );
}
