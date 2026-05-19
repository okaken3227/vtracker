"use client";

type ApiUsage = {
  unitsUsed: number;
  callsCount: number;
  quotaLimit: number;
  twitchCallsCount: number;
  keyCount: number;
  perKeyUnits: number[];
  quotaExceededKeys: boolean[];
};

type TestKeysResult = {
  results: { label: string; ok: boolean; error?: string }[];
  testedAt: string;
};

type Props = {
  apiUsage: ApiUsage | null;
  testKeysResult: TestKeysResult | null;
  testKeysLoading: boolean;
  pollStatus: string;
  findLiveStatus: string;
  reclassifyStatus: string;
  syncStatus: string;
  onRefreshUsage: () => void;
  onTestKeys: () => void;
  onPollVideos: () => void;
  onFindLive: () => void;
  onReclassify: () => void;
  onSyncChannels: () => void;
};

export default function AdminHeader({
  apiUsage, testKeysResult, testKeysLoading,
  pollStatus, findLiveStatus, reclassifyStatus, syncStatus,
  onRefreshUsage, onTestKeys, onPollVideos, onFindLive, onReclassify, onSyncChannels,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">管理画面</h1>
        {apiUsage && (
          <div className="mt-1 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${apiUsage.unitsUsed / apiUsage.quotaLimit > 0.8 ? "bg-red-500" : apiUsage.unitsUsed / apiUsage.quotaLimit > 0.5 ? "bg-amber-400" : "bg-green-500"}`}
                  style={{ width: `${Math.min(100, (apiUsage.unitsUsed / apiUsage.quotaLimit) * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                <span className="font-medium text-red-500">YouTube</span>{" "}
                {apiUsage.unitsUsed.toLocaleString()} / {apiUsage.quotaLimit.toLocaleString()} units
                <span className="ml-1 text-gray-400">（{apiUsage.callsCount}回）</span>
              </span>
              <button onClick={onRefreshUsage} className="text-xs text-gray-300 hover:text-gray-500">↻</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {Array.from({ length: apiUsage.keyCount }, (_, i) => {
                const used = apiUsage.perKeyUnits[i] ?? 0;
                const exceeded = apiUsage.quotaExceededKeys[i] ?? false;
                const pct = Math.min(100, (used / 10000) * 100);
                const color = exceeded ? "text-red-600" : pct > 80 ? "text-amber-600" : "text-green-600";
                const remaining = Math.max(0, 10000 - used);
                const testResult = testKeysResult?.results[i];
                return (
                  <span key={i} className={`rounded border px-2 py-0.5 text-[11px] font-medium ${exceeded ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                    <span className="text-gray-400">API{i + 1}  </span>
                    <span className={color}>{used.toLocaleString()}</span>
                    <span className="text-gray-300"> / 10,000</span>
                    {!exceeded && <span className="ml-1 text-gray-400">（余裕 {remaining.toLocaleString()}）</span>}
                    {exceeded && <span className="ml-1 text-red-500">枯渇</span>}
                    {testResult && (
                      <span className={`ml-1.5 ${testResult.ok ? "text-green-600" : "text-red-500"}`}>
                        {testResult.ok ? "✓ 疎通OK" : `✗ ${testResult.error ?? "NG"}`}
                      </span>
                    )}
                  </span>
                );
              })}
              <button
                onClick={onTestKeys}
                disabled={testKeysLoading}
                className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50"
              >
                {testKeysLoading ? "確認中..." : "疎通確認"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-purple-400 transition-all"
                  style={{ width: `${Math.min(100, (apiUsage.twitchCallsCount / 800) * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                <span className="font-medium text-purple-500">Twitch</span>{" "}
                {apiUsage.twitchCallsCount.toLocaleString()} calls
                <span className="ml-1 text-gray-400">（上限 800/分）</span>
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <button onClick={onPollVideos}
          className="rounded-lg border border-cyan-400 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-600 transition-colors hover:bg-cyan-100">
          RSS動画を今すぐ検索
        </button>
        <button onClick={onFindLive}
          className="rounded-lg border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100">
          ライブ確認（RSS）
        </button>
        <button onClick={onReclassify}
          className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100">
          未分類を一括再分類
        </button>
        <button onClick={onSyncChannels}
          className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100">
          チャンネル情報を一括更新
        </button>
        {(pollStatus || findLiveStatus || reclassifyStatus || syncStatus) && (
          <span className="text-xs text-gray-500">{syncStatus || reclassifyStatus || pollStatus || findLiveStatus}</span>
        )}
      </div>
    </div>
  );
}
