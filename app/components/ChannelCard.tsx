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
  groupName?: string;
  groupColor?: string;
};

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
  groupName, groupColor,
}: Props) {
  const badge = STATUS_BADGE[latestVideoStatus] ?? STATUS_BADGE.none;

  return (
    <a
      href={`/channel/${channelId}`}
      className="group card-lift flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      {/* チャンネルアイコン */}
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
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
        {groupName && (
          <span
            className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: groupColor ?? "#7c3aed" }}
          >
            {groupName}
          </span>
        )}
      </div>

      {/* チャンネル情報 */}
      <div className="flex flex-col gap-1 p-2">
        <p className="truncate text-xs font-semibold text-gray-900 transition-colors duration-300 group-hover:text-violet-600">{name}</p>
        <p className="truncate text-[10px] text-gray-400">{formatCount(subscriberCount)}登録</p>
        {totalSuperchat > 0 && (
          <p className="font-mono text-[10px] font-semibold text-violet-600">¥{totalSuperchat.toLocaleString()}</p>
        )}
      </div>
    </a>
  );
}
