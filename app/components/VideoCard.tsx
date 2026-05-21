import ChannelAvatar from "./ChannelAvatar";
import PlatformIcon from "./PlatformIcon";

type Props = {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  iconUrl: string;
  thumbnailUrl: string;
  status: string;
  startTime: string | null;
  superchatTotal: number;
  platform?: string | null;
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  live:     { label: "● LIVE",    className: "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.45)] live-pulse-ring" },
  upcoming: { label: "○ 配信予定", className: "bg-gradient-to-r from-amber-400 to-orange-400 text-white" },
  none:     { label: "配信終了",   className: "bg-black/40 text-white backdrop-blur-sm" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function VideoCard({
  videoId, title, channelId, channelName, iconUrl,
  thumbnailUrl, status, startTime, superchatTotal, platform,
}: Props) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.none;
  const isLive = status === "live";

  return (
    <a
      href={`/live/${videoId}`}
      className="group card-lift flex flex-col overflow-hidden rounded-2xl bg-white/90 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] border border-white/70 backdrop-blur-sm"
    >
      {/* サムネイル */}
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-violet-50 to-gray-100">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={title}
            className="thumb-inner h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-gray-200">▶</div>
        )}
        {/* 下部グラデーションオーバーレイ */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <span className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
        <div className={`absolute right-1.5 top-1.5 rounded-full p-1 shadow-sm ${isLive ? "bg-black/30 backdrop-blur-sm" : "bg-white/90"}`}>
          <PlatformIcon platform={platform} size={12} />
        </div>
      </div>

      {/* テキスト情報 */}
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 transition-colors duration-200 group-hover:text-violet-600">
          {title}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <ChannelAvatar channelId={channelId} name={channelName} iconUrl={iconUrl} size={18} />
          <p className="truncate text-xs text-gray-500">{channelName}</p>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
          <span>{formatDate(startTime)}</span>
          {superchatTotal > 0 && (
            <span className="font-mono font-bold text-violet-600">¥{superchatTotal.toLocaleString()}</span>
          )}
        </div>
      </div>
    </a>
  );
}
