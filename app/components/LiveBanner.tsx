import ChannelAvatar from "./ChannelAvatar";

type Props = {
  title: string;
  channelName: string;
  channelId: string;
  iconUrl: string;
  videoId: string;
  startTime: string | null;
};

export default function LiveBanner({ title, channelName, channelId, iconUrl, videoId, startTime }: Props) {
  const elapsed = startTime
    ? Math.floor((Date.now() - new Date(startTime).getTime()) / 60000)
    : null;

  return (
    <a
      href={`/live/${videoId}`}
      className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 transition-all hover:bg-red-100"
    >
      <ChannelAvatar channelId={channelId} name={channelName} iconUrl={iconUrl} size={40} />
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-xs font-medium text-red-500">
          <span className="animate-pulse">●</span> LIVE NOW — {channelName}
        </p>
        <p className="truncate font-semibold text-gray-900">{title}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        {elapsed !== null && (
          <p className="text-xs text-gray-500">{elapsed}分経過</p>
        )}
        <p className="mt-0.5 text-xs font-medium text-red-500">▶ 今すぐ視聴</p>
      </div>
    </a>
  );
}
