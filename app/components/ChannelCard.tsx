"use client";

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
  linkedPlatform?: string | null;
  onGroupFilter?: (groupId: string | undefined) => void;
};

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  live:     { label: "● LIVE",    className: "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_2px_10px_rgba(239,68,68,0.5)] live-pulse-ring" },
  upcoming: { label: "○ 配信予定", className: "bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-[0_2px_6px_rgba(245,158,11,0.35)]" },
  none:     { label: "配信終了",   className: "bg-black/35 text-white backdrop-blur-sm" },
};

export default function ChannelCard({
  channelId, name, customUrl: _customUrl, iconUrl,
  subscriberCount, totalSuperchat,
  latestVideoStatus, latestVideoStartTime,
  groupId, groupName, groupColor, groupIconUrl: _groupIconUrl,
  linkedPlatform,
  onGroupFilter,
}: Props) {
  const badge = STATUS_BADGE[latestVideoStatus] ?? STATUS_BADGE.none;
  const isLive = latestVideoStatus === "live";

  return (
    <a
      href={`/channel/${channelId}`}
      className="group card-lift flex flex-col overflow-hidden rounded-2xl bg-white/90 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] backdrop-blur-sm border border-white/70"
    >
      {/* チャンネルアイコン */}
      <div className={`relative flex aspect-square w-full items-center justify-center overflow-hidden ${isLive ? "bg-gradient-to-br from-red-50 to-rose-100" : "bg-gradient-to-br from-violet-50/60 to-purple-100/40"}`}>
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt={name}
            className="thumb-inner h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg"
            style={{ backgroundColor: groupColor ?? "#7c3aed" }}
          >
            {name[0]}
          </div>
        )}

        {/* ステータスバッジ */}
        <span className={`absolute left-2 top-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}>
          {badge.label}
          {isLive && latestVideoStartTime && (
            <LiveTimer startTime={latestVideoStartTime} className="font-mono text-[10px] tabular-nums opacity-90" />
          )}
        </span>

        {/* グループアイコン */}
        {groupName && (
          <button
            onClick={(e) => { e.preventDefault(); onGroupFilter?.(groupId ?? undefined); }}
            title={groupName}
            className="absolute right-1.5 top-1.5 overflow-hidden rounded-full ring-2 ring-white shadow-md transition-transform hover:scale-110"
          >
            {_groupIconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={_groupIconUrl} alt={groupName} className="h-5 w-5 object-cover" />
            ) : (
              <span
                className="flex h-5 w-5 items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: groupColor ?? "#7c3aed" }}
              >
                {groupName[0]}
              </span>
            )}
          </button>
        )}

        {/* ライブ中のグロー演出 */}
        {isLive && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-red-500/10 via-transparent to-transparent" />
        )}
      </div>

      {/* チャンネル情報 */}
      <div className="flex flex-col gap-0.5 p-2.5">
        <p className="truncate text-xs font-bold text-gray-900 transition-colors duration-200 group-hover:text-violet-600 leading-tight">
          {name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <p className="truncate text-[10px] text-gray-400 font-medium">{formatCount(subscriberCount)}登録</p>
          {linkedPlatform === "twitch" && (
            <span className="ml-auto flex-shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[8px] font-bold text-purple-700 leading-none">Twitch</span>
          )}
          {linkedPlatform === "youtube" && (
            <span className="ml-auto flex-shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-bold text-red-600 leading-none">YouTube</span>
          )}
        </div>
        {totalSuperchat > 0 && (
          <p className="font-mono text-[10px] font-bold text-violet-600 mt-0.5">¥{totalSuperchat.toLocaleString()}</p>
        )}
      </div>
    </a>
  );
}
