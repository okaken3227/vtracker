import ChannelAvatar from "./ChannelAvatar";

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
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  live:     { label: "● LIVE",    className: "bg-red-500 text-white" },
  upcoming: { label: "○ 配信予定", className: "bg-amber-400 text-white" },
  none:     { label: "配信終了",   className: "bg-gray-500/80 text-white backdrop-blur-sm" },
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
  thumbnailUrl, status, startTime, superchatTotal,
}: Props) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.none;

  return (
    <a
      href={`/live/${videoId}`}
      className="group card-lift flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      {/* サムネイル */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={title}
            className="thumb-inner h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-gray-300">▶</div>
        )}
        <span className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* テキスト情報 */}
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900 transition-colors duration-300 group-hover:text-violet-600">
          {title}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <ChannelAvatar channelId={channelId} name={channelName} iconUrl={iconUrl} size={18} />
          <p className="truncate text-xs text-gray-500">{channelName}</p>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
          <span>{formatDate(startTime)}</span>
          {superchatTotal > 0 && (
            <span className="font-mono text-violet-600">¥{superchatTotal.toLocaleString()}</span>
          )}
        </div>
      </div>
    </a>
  );
}
