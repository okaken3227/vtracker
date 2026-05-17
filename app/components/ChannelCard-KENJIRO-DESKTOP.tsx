import LiveTimer from "./LiveTimer";

type Props = {
  channelId: string;
  name: string;
  customUrl: string;
  iconUrl: string;
  subscriberCount: number;
  totalSuperchat: number;
  latestVideoStatus: string;
  latestVideoStartTime?: string | null;
  groupId?: string | null;
  groupName?: string;
  groupColor?: string;
  groupIconUrl?: string | null;
  onGroupFilter?: (groupId: string) => void;
};

// 累計スパチャ: YouTube 配色の基準軸を踏襲しつつ累計額スケールに調整
function scColor(amount: number): string {
  if (amount >= 100000) return "text-red-500";       // 赤（¥10k赤×10回分）
  if (amount >= 50000)  return "text-fuchsia-500";   // マゼンタ
  if (amount >= 20000)  return "text-orange-500";    // 橙
  if (amount >= 10000)  return "text-yellow-600";    // 黄
  if (amount >= 5000)   return "text-green-600";     // 緑
  if (amount >= 2000)   return "text-cyan-500";      // 水色
  return "text-blue-400";                            // 青
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  live:     { label: "● LIVE",    className: "bg-red-500 text-white" },
  upcoming: { label: "○ 配信予定", className: "bg-amber-400 text-white" },
  none:     { label: "配信終了",   className: "bg-gray-500/80 text-white backdrop-blur-sm" },
};

export default function ChannelCard({
  channelId, name, customUrl, iconUrl,
  subscriberCount, totalSuperchat,
  latestVideoStatus, latestVideoStartTime,
  groupId, groupName, groupColor, groupIconUrl, onGroupFilter,
}: Props) {
  const badge = STATUS_BADGE[latestVideoStatus] ?? STATUS_BADGE.none;

  return (
    <div className="card-lift flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* チャンネルアイコン */}
      <a
        href={`/channel/${channelId}`}
        className="group relative flex aspect-square w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100"
      >
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt={name}
            className="thumb-inner h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: groupColor ?? "#7c3aed" }}
          >
            {name[0]}
          </div>
        )}
        <span className={`absolute left-2 top-2 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
          {latestVideoStatus === "live" && latestVideoStartTime && (
            <LiveTimer startTime={latestVideoStartTime} className="font-mono text-[10px] tabular-nums" />
          )}
        </span>
      </a>

      {/* チャンネル情報 */}
      <div className="flex items-start gap-1.5 p-2">
        <a href={`/channel/${channelId}`} className="group min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-gray-900 transition-colors duration-300 group-hover:text-violet-600">{name}</p>
          <p className="truncate text-[10px] text-gray-400">{formatCount(subscriberCount)}登録</p>
          {totalSuperchat > 0 && (
            <p className={`font-mono text-[10px] font-semibold ${scColor(totalSuperchat)}`}>¥{totalSuperchat.toLocaleString()}</p>
          )}
        </a>
        {groupId && (groupIconUrl || groupName) && (
          <div className="flex flex-shrink-0 items-center">
            {/* グループでフィルター */}
            {onGroupFilter ? (
              <button
                type="button"
                onClick={() => onGroupFilter(groupId)}
                title={`${groupName ?? "グループ"}でフィルター`}
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                {groupIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={groupIconUrl}
                    alt={groupName ?? ""}
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-gray-200"
                  />
                ) : (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                    style={{ backgroundColor: groupColor ?? "#7c3aed" }}
                  >
                    {groupName}
                  </span>
                )}
              </button>
            ) : (
              <a
                href={`/?group=${groupId}`}
                title={`${groupName ?? "グループ"}でフィルター`}
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                {groupIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={groupIconUrl}
                    alt={groupName ?? ""}
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-gray-200"
                  />
                ) : (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                    style={{ backgroundColor: groupColor ?? "#7c3aed" }}
                  >
                    {groupName}
                  </span>
                )}
              </a>
            )}
            {/* グループページへ */}
            <a
              href={`/group/${groupId}`}
              title={`${groupName ?? "グループ"}のページへ`}
              className="ml-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
              style={{
                backgroundColor: groupColor ? `${groupColor}22` : "rgba(139,92,246,0.13)",
                color: groupColor ?? "#8b5cf6",
              }}
            >
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 9.5L9.5 2.5M6 2.5h3.5v3.5" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
