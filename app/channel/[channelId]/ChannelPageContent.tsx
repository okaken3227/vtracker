"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Channel, Video, ChannelStatsHistory, Group } from "@/lib/types";
import SubscriberChart from "./SubscriberChart";

export type ChData = {
  channel: Channel;
  videos: Video[];
  history: ChannelStatsHistory[];
  group: Group | null;
  totalSCJPY: number;
  peakByVideo: Record<string, number>;
};

type PreviewVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
  channelIcon: string;
  status: string;
  platform: string;
};

function formatCount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function VideoPreviewDialog({ video, onClose }: { video: PreviewVideo; onClose: () => void }) {
  const isYt = !video.platform || video.platform === "youtube";
  const externalUrl = isYt
    ? `https://www.youtube.com/watch?v=${video.videoId}`
    : `https://www.twitch.tv/videos/${video.videoId}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>

          <div className="aspect-video w-full overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
          </div>

          <div className="p-4">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{video.title}</p>
            <div className="mt-2 flex items-center gap-2">
              {video.channelIcon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.channelIcon} alt="" className="h-5 w-5 rounded-full object-cover" />
              )}
              <span className="text-xs text-gray-500">{video.channelName}</span>
              {video.status === "live" && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">● LIVE</span>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
                  isYt ? "bg-red-500 hover:bg-red-600" : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {isYt ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                  </svg>
                )}
                {isYt ? "YouTubeで見る" : "Twitchで見る"}
              </a>
              <Link
                href={`/live/${video.videoId}`}
                onClick={onClose}
                className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-violet-300 hover:text-violet-600"
              >
                配信データを見る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ChannelView({ d }: { d: ChData }) {
  const { channel, videos, history, group, totalSCJPY, peakByVideo } = d;
  const [preview, setPreview] = useState<PreviewVideo | null>(null);

  const isYt = !channel.platform || channel.platform === "youtube";
  const externalUrl = isYt
    ? (channel.custom_url
        ? `https://www.youtube.com/${channel.custom_url}?sub_confirmation=1`
        : `https://www.youtube.com/channel/${channel.channel_id}?sub_confirmation=1`)
    : `https://www.twitch.tv/${channel.custom_url}`;

  const fallbackBg = videos.find((v) => v.thumbnail_url)?.thumbnail_url;

  return (
    <>
      {/* パンくず */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
        <span className="text-gray-300">›</span>
        {group && (
          <>
            <Link href={`/group/${group.id}`} className="hover:text-violet-600 transition-colors">{group.name}</Link>
            <span className="text-gray-300">›</span>
          </>
        )}
        <span className="truncate text-gray-400">{channel.name}</span>
      </div>

      {/* ── YouTubeスタイル チャンネルヘッダー ── */}
      <div className="mb-6">

        {/* バナー（YouTubeのみ） */}
        {isYt && (() => {
          const accentColor = channel.color ?? group?.color;
          return (
            <div className="relative h-[88px] overflow-hidden bg-gray-100 sm:h-[176px]">
              {channel.banner_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={channel.banner_url}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover"
                />
              ) : accentColor ? (
                <div
                  className="h-full w-full"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}55 0%, ${accentColor}22 100%)`,
                    backgroundColor: `${accentColor}18`,
                  }}
                />
              ) : fallbackBg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fallbackBg}
                  alt=""
                  aria-hidden
                  className="h-full w-full scale-110 object-cover opacity-30 blur-sm"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{ background: "linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)" }}
                />
              )}
            </div>
          );
        })()}

        {/* アイコン + 情報 */}
        <div className="flex flex-row items-center gap-3 px-4 pt-3 sm:items-end sm:gap-5 sm:px-6 sm:pt-0">

          {/* アイコン（YouTubeはsm以上でバナーに重なる） */}
          <div className={`flex-shrink-0 ${isYt ? "sm:-mt-12" : ""}`}>
            {channel.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.icon_url}
                alt={channel.name}
                className="h-14 w-14 rounded-full object-cover shadow-lg ring-2 ring-white sm:h-28 sm:w-28 sm:ring-4"
              />
            ) : (
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg ring-2 ring-white sm:h-28 sm:w-28 sm:text-3xl sm:ring-4"
                style={{ backgroundColor: group?.color ?? "#6b7280" }}
              >
                {channel.name[0]}
              </div>
            )}
          </div>

          {/* チャンネル情報 */}
          <div className="min-w-0 flex-1 py-2 sm:pb-3 sm:pt-0">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <h2
                className="min-w-0 shrink font-bold text-gray-900 overflow-hidden whitespace-nowrap"
                style={{ fontSize: "clamp(0.95rem, 4vw, 1.5rem)" }}
              >
                {channel.name}
              </h2>
              {group && (
                <Link
                  href={`/group/${group.id}`}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                  style={{ backgroundColor: group.color }}
                >
                  {group.icon_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={group.icon_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                  )}
                  {group.name}
                </Link>
              )}
            </div>

            <div
              className="mt-1 flex items-center gap-x-2 overflow-x-auto text-sm text-gray-500"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none", flexWrap: "nowrap" } as React.CSSProperties}
            >
              {channel.custom_url && (
                <span className="flex-shrink-0 text-gray-400">{channel.custom_url}</span>
              )}
              {channel.custom_url && <span className="flex-shrink-0 text-gray-300">·</span>}
              <span className="flex-shrink-0">
                {isYt ? "登録者" : "フォロワー"}{" "}
                <strong className="text-gray-800">{formatCount(channel.subscriber_count)}</strong>
              </span>
              <span className="flex-shrink-0 text-gray-300">·</span>
              <span className="flex-shrink-0">
                動画 <strong className="text-gray-800">{channel.video_count.toLocaleString()}</strong> 本
              </span>
              <span className="flex-shrink-0 text-gray-300">·</span>
              <span className="flex-shrink-0">
                総再生 <strong className="text-gray-800">{formatCount(channel.view_count)}</strong>
              </span>
            </div>

            {channel.description && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-400 leading-relaxed">{channel.description}</p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 ${
                  isYt ? "bg-red-500" : "bg-purple-600"
                }`}
              >
                {isYt ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                  </svg>
                )}
                {isYt ? "YouTubeで開く" : "Twitchで開く"}
              </a>

              {totalSCJPY > 0 && (
                <Link
                  href={`/channel/${channel.channel_id}/superchats`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-100"
                >
                  累計スパチャ ¥{formatCount(totalSCJPY)}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 登録者数推移グラフ ── */}
      {history.length >= 2 && (
        <section className="mb-8">
          <h3 className="mb-3 text-base font-semibold text-gray-900">
            {isYt ? "登録者数推移" : "フォロワー数推移"}
          </h3>
          <SubscriberChart data={history} />
        </section>
      )}

      {/* ── 過去の配信グリッド ── */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          過去の配信{" "}
          <span className="text-sm font-normal text-gray-400">({videos.length}件)</span>
        </h3>
        {videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
            配信データがありません
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {videos.map((v) => {
              const peak = peakByVideo[v.video_id];
              const vIsYt = !v.platform || v.platform === "youtube";
              const hiResSrc = vIsYt
                ? `https://i.ytimg.com/vi/${v.video_id}/maxresdefault.jpg`
                : v.thumbnail_url ?? "";

              return (
                <button
                  key={v.video_id}
                  onClick={() =>
                    setPreview({
                      videoId: v.video_id,
                      title: v.title,
                      thumbnail: hiResSrc,
                      channelName: channel.name,
                      channelIcon: channel.icon_url,
                      status: v.status,
                      platform: v.platform ?? "youtube",
                    })
                  }
                  className="group flex flex-col text-left"
                >
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hiResSrc}
                      alt={v.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        if (v.thumbnail_url && e.currentTarget.src !== v.thumbnail_url) {
                          e.currentTarget.src = v.thumbnail_url;
                        }
                      }}
                    />
                    {v.status === "live" && (
                      <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                        ● LIVE
                      </span>
                    )}
                    {v.status === "upcoming" && (
                      <span className="absolute left-2 top-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                        配信予定
                      </span>
                    )}
                    {peak != null && (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
                        {peak.toLocaleString()}人
                      </span>
                    )}
                  </div>
                  <div className="mt-2 px-0.5">
                    <p className="line-clamp-2 text-xs font-medium leading-snug text-gray-900 transition-colors duration-200 group-hover:text-violet-600">
                      {v.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(v.start_time)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {preview && <VideoPreviewDialog video={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

export default function ChannelPageContent({
  mainData,
  linkedData,
  startChannelId,
}: {
  mainData: ChData;
  linkedData: ChData | null;
  startChannelId: string;
}) {
  const [activeId, setActiveId] = useState(startChannelId);

  const mainIsYt = !mainData.channel.platform || mainData.channel.platform === "youtube";
  const active = activeId === mainData.channel.channel_id ? mainData : linkedData ?? mainData;

  return (
    <div>
      {linkedData && (
        <div className="mb-4 flex gap-2">
          {(() => {
            const ytData = mainIsYt ? mainData : linkedData;
            const isActive = activeId === ytData.channel.channel_id;
            return (
              <button
                onClick={() => setActiveId(ytData.channel.channel_id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-red-500 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:text-red-500"
                }`}
              >
                {ytData.channel.icon_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ytData.channel.icon_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                )}
                <span>YouTube</span>
              </button>
            );
          })()}

          {(() => {
            const twData = mainIsYt ? linkedData : mainData;
            const isActive = activeId === twData.channel.channel_id;
            return (
              <button
                onClick={() => setActiveId(twData.channel.channel_id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-purple-600 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-500 hover:border-purple-200 hover:text-purple-600"
                }`}
              >
                {twData.channel.icon_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={twData.channel.icon_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                )}
                <span>Twitch</span>
              </button>
            );
          })()}
        </div>
      )}

      <ChannelView d={active} />
    </div>
  );
}
