"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Channel, Video, Group } from "@/lib/types";
import ChannelCard from "./ChannelCard";
import VideoCard from "./VideoCard";
import Marquee from "./Marquee";
import GroupTabs from "./GroupTabs";
import ChannelAvatar from "./ChannelAvatar";
import LiveSection from "./LiveSection";
import type { LineConfig } from "./CombinedLiveGraph";

const LINE_COLORS = ["#7c3aed", "#e11d48", "#0891b2", "#d97706", "#16a34a", "#9333ea", "#64748b"];

const NICE_BUCKET_MS = [1, 2, 3, 5, 10, 15, 20, 30, 60].map((m) => m * 60 * 1000);

function computeBucketMs(points: GraphPoint[], liveIds: Set<string>): number {
  const gaps: number[] = [];
  const byVideo = new Map<string, number[]>();
  for (const p of points) {
    if (!liveIds.has(p.video_id)) continue;
    if (!byVideo.has(p.video_id)) byVideo.set(p.video_id, []);
    byVideo.get(p.video_id)!.push(new Date(p.recorded_at).getTime());
  }
  for (const times of byVideo.values()) {
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap > 0) gaps.push(gap);
    }
  }
  if (gaps.length === 0) return 60 * 1000;
  gaps.sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)];
  return NICE_BUCKET_MS.find((b) => b >= medianGap) ?? NICE_BUCKET_MS[NICE_BUCKET_MS.length - 1];
}

type GraphPoint = { video_id: string; concurrent_viewers: number; recorded_at: string };

export type HomeData = {
  channels: Channel[];
  videos: Video[];
  scByVideo: Record<string, number>;
  scByChannel: Record<string, number>;
  groups: Group[];
  todayPoints: GraphPoint[];
  error: string | null;
};

function buildCombinedGraph(
  liveVideos: Video[],
  channelMap: Map<string, Channel>,
  points: GraphPoint[],
): { merged: Record<string, number | string | null>[]; lines: LineConfig[] } {
  const lines: LineConfig[] = liveVideos.map((v, i) => ({
    key: v.video_id,
    channelName: channelMap.get(v.channel_id)?.name ?? v.channel_id,
    color: LINE_COLORS[i % LINE_COLORS.length],
    videoId: v.video_id,
    iconUrl: channelMap.get(v.channel_id)?.icon_url ?? undefined,
  }));

  const liveIds = new Set(liveVideos.map((v) => v.video_id));
  const BUCKET_MS = computeBucketMs(points, liveIds);
  const allBuckets = new Set<number>();
  const byVideoAndBucket = new Map<string, Map<number, number[]>>();

  for (const p of points) {
    if (!liveIds.has(p.video_id)) continue;
    const bucket = Math.floor(new Date(p.recorded_at).getTime() / BUCKET_MS) * BUCKET_MS;
    allBuckets.add(bucket);
    if (!byVideoAndBucket.has(p.video_id)) byVideoAndBucket.set(p.video_id, new Map());
    const vm = byVideoAndBucket.get(p.video_id)!;
    if (!vm.has(bucket)) vm.set(bucket, []);
    vm.get(bucket)!.push(p.concurrent_viewers);
  }

  if (allBuckets.size < 2) return { merged: [], lines };

  const sorted = Array.from(allBuckets).sort((a, b) => a - b);
  const merged = sorted.map((bucket) => {
    const t = new Date(bucket).toLocaleTimeString("ja-JP", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
    });
    const row: Record<string, number | string | null> = { t };
    for (const { key } of lines) {
      const vals = byVideoAndBucket.get(key)?.get(bucket);
      row[key] = vals ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null;
    }
    return row;
  });

  return { merged, lines };
}

type PreviewVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  channelIcon: string;
  startTime: string | null;
  status: string;
};

export default function HomeContent({ channels, videos, scByVideo, scByChannel, groups, todayPoints, error }: HomeData) {
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<PreviewVideo | null>(null);
  const channelListRef = useRef<HTMLElement>(null);

  function handleGroupSelect(groupId: string | undefined) {
    setSelectedGroup(groupId);
    setTimeout(() => {
      const el = channelListRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    }, 0);
  }

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));
  const videoMap = new Map(videos.map((v) => [v.video_id, v]));

  // 双方向リンク対応の重複除去
  const linkedToIds = new Set(
    channels.filter((c) => c.linked_channel_id).map((c) => c.linked_channel_id as string)
  );
  const shownAsLinked = new Set<string>();
  for (const ch of channels) {
    if (!ch.linked_channel_id) continue;
    const isYt = !ch.platform || ch.platform === "youtube";
    const isChPointedTo = linkedToIds.has(ch.channel_id);
    if (!isChPointedTo || isYt) shownAsLinked.add(ch.linked_channel_id);
  }
  const deduped = channels.filter((c) => !shownAsLinked.has(c.channel_id));
  const filteredChannels = selectedGroup
    ? deduped.filter((c) => c.group_id === selectedGroup)
    : deduped;

  // ライブ動画のグループフィルタはリンク先含む全チャンネルで判定
  const allFiltered = selectedGroup
    ? channels.filter((c) => c.group_id === selectedGroup)
    : channels;
  const filteredChannelIds = new Set(allFiltered.map((c) => c.channel_id));

  const liveVideos = videos
    .filter((v) => v.status === "live")
    .filter((v) => !selectedGroup || filteredChannelIds.has(v.channel_id));

  // 今日のサマリー
  const todayVideoIds = [...new Set(todayPoints.map((p) => p.video_id))];
  const todayVideos = todayVideoIds
    .map((id) => videoMap.get(id))
    .filter((v): v is Video => v != null);

  const scRanking = todayVideos
    .map((v) => ({ video: v, channel: channelMap.get(v.channel_id), sc: scByVideo[v.video_id] ?? 0 }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 5);

  const todaySCTotal = todayVideos.reduce((s, v) => s + (scByVideo[v.video_id] ?? 0), 0);

  const finishedToday = todayVideos
    .filter((v) => v.status !== "live")
    .filter((v) => !selectedGroup || filteredChannelIds.has(v.channel_id))
    .sort((a, b) => (b.start_time ?? "").localeCompare(a.start_time ?? ""));

  const { merged: graphData, lines: graphLines } = buildCombinedGraph(liveVideos, channelMap, todayPoints);

  // チャンネルカード用の最新動画情報
  const latestByChannel: Record<string, { status: string; startTime: string | null }> = {};
  for (const v of videos) {
    if (!latestByChannel[v.channel_id]) {
      latestByChannel[v.channel_id] = { status: v.status, startTime: v.start_time };
    }
  }

  // ライブ中チャンネルを先頭にソート
  const liveChannelIds = new Set(liveVideos.map((v) => v.channel_id));
  const sortedChannels = [...filteredChannels].sort((a, b) => {
    const aLive = liveChannelIds.has(a.channel_id) ? 0 : 1;
    const bLive = liveChannelIds.has(b.channel_id) ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return b.subscriber_count - a.subscriber_count;
  });

  // サムネイルマーキー用: 配信予定以外・グループフィルター適用（ショート含む）
  const thumbVideos = videos.filter(
    (v) =>
      v.status !== "upcoming" &&
      v.thumbnail_url &&
      (!selectedGroup || filteredChannelIds.has(v.channel_id))
  );
  const thumbRow1 = thumbVideos.filter((_, i) => i % 3 === 0);
  const thumbRow2 = thumbVideos.filter((_, i) => i % 3 === 1);
  const thumbRow3 = thumbVideos.filter((_, i) => i % 3 === 2);

  const thumbCard = (v: Video) => {
    const ch = channelMap.get(v.channel_id);
    const isYt = !v.platform || v.platform === "youtube";
    const hiResSrc = isYt
      ? `https://i.ytimg.com/vi/${v.video_id}/maxresdefault.jpg`
      : v.thumbnail_url!;
    return (
      <button
        key={v.video_id}
        onClick={() =>
          setPreview({
            videoId: v.video_id,
            title: v.title,
            thumbnail: hiResSrc,
            channelId: v.channel_id,
            channelName: ch?.name ?? v.channel_id,
            channelIcon: ch?.icon_url ?? "",
            startTime: v.start_time,
            status: v.status,
          })
        }
        className="flex-shrink-0 overflow-hidden rounded-xl transition-opacity hover:opacity-80"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hiResSrc}
          alt=""
          className="h-24 w-[170px] object-cover"
          loading="lazy"
          onError={(e) => {
            if (v.thumbnail_url && e.currentTarget.src !== v.thumbnail_url) {
              e.currentTarget.src = v.thumbnail_url;
            }
          }}
        />
      </button>
    );
  };

  return (
    <div>
      {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            DB エラー: {error}
          </div>
        )}

        {/* 今日のまとめ */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">今日のまとめ</h2>
            <Link href="/today" className="text-xs text-violet-500 hover:underline">
              24時間タイムライン →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatMini label="今日の配信数" value={`${todayVideos.length}`} unit="本" />
            <StatMini label="現在ライブ中" value={`${liveVideos.length}`} unit="本" />
            <StatMini
              label="今日のスパチャ"
              value={todaySCTotal > 0 ? `¥${todaySCTotal.toLocaleString()}` : "—"}
            />
          </div>

          {todayVideos.length === 0 && liveVideos.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              今日の配信データはまだありません
            </div>
          )}
        </section>

        {/* ライブ中グラフ / 終了済み配信 */}
        {liveVideos.length > 0 ? (
          <section className="mb-8">
            <LiveSection
              entries={liveVideos.map((v) => {
                const ch = channelMap.get(v.channel_id);
                const group = ch?.group_id ? groupMap.get(ch.group_id) : undefined;
                return {
                  videoId: v.video_id,
                  title: v.title,
                  channelName: ch?.name ?? v.channel_id,
                  channelId: v.channel_id,
                  iconUrl: ch?.icon_url ?? "",
                  startTime: v.start_time,
                  groupName: group?.name ?? null,
                  groupColor: group?.color ?? null,
                  platform: v.platform,
                };
              })}
              graphData={graphData}
              graphLines={graphLines}
            />
          </section>
        ) : finishedToday.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-4 text-base font-semibold text-gray-900">終了済み配信</h2>
            {(() => {
              const row1 = finishedToday.filter((_, i) => i % 2 === 0);
              const row2 = finishedToday.filter((_, i) => i % 2 === 1);
              const card = (v: Video) => {
                const ch = channelMap.get(v.channel_id);
                return (
                  <div key={v.video_id} className="w-52 flex-shrink-0">
                    <VideoCard
                      videoId={v.video_id}
                      title={v.title}
                      channelId={v.channel_id}
                      channelName={ch?.name ?? v.channel_id}
                      iconUrl={ch?.icon_url ?? ""}
                      thumbnailUrl={v.thumbnail_url}
                      status={v.status}
                      startTime={v.start_time}
                      superchatTotal={scByVideo[v.video_id] ?? 0}
                      platform={v.platform}
                    />
                  </div>
                );
              };
              return (
                <div className="flex flex-col gap-3">
                  <Marquee itemCount={row1.length}>{row1.map(card)}</Marquee>
                  {row2.length > 0 && (
                    <Marquee itemCount={row2.length} reverse>{row2.map(card)}</Marquee>
                  )}
                </div>
              );
            })()}
          </section>
        ) : null}

        {/* スパチャランキング */}
        {scRanking.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-gray-900">今日のスパチャ</h2>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="divide-y divide-gray-100">
                {scRanking.map(({ video, channel, sc }, i) => (
                  <Link
                    key={video.video_id}
                    href={`/live/${video.video_id}`}
                    className="flex items-center gap-3 py-2 transition-opacity hover:opacity-70"
                  >
                    <span className="w-4 flex-shrink-0 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                    <ChannelAvatar
                      channelId={video.channel_id}
                      name={channel?.name ?? ""}
                      iconUrl={channel?.icon_url ?? undefined}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-800">{channel?.name ?? video.channel_id}</p>
                      <p className="truncate text-xs text-gray-400">{video.title}</p>
                    </div>
                    <span className="flex-shrink-0 text-sm font-bold text-violet-600">
                      ¥{sc.toLocaleString()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

      {/* ── 関連動画マーキー（全幅） ── */}
      {thumbVideos.length >= 3 && (
        <div className="mb-8">
          {/* ラベル */}
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">関連動画</h2>
            {selectedGroup && groupMap.get(selectedGroup) && (() => {
              const g = groupMap.get(selectedGroup)!;
              return (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: g.color }}
                >
                  {g.name}
                </span>
              );
            })()}
            <span className="text-sm text-gray-400">{thumbVideos.length}件</span>
          </div>
          {/* マーキー本体（全幅） */}
          <div className="-mx-4 flex flex-col gap-1.5 overflow-hidden">
            <Marquee itemCount={thumbRow1.length} gap={8}>{thumbRow1.map(thumbCard)}</Marquee>
            {thumbRow2.length > 0 && (
              <Marquee itemCount={thumbRow2.length} gap={8} reverse>{thumbRow2.map(thumbCard)}</Marquee>
            )}
            {thumbRow3.length > 0 && (
              <Marquee itemCount={thumbRow3.length} gap={8}>{thumbRow3.map(thumbCard)}</Marquee>
            )}
          </div>
        </div>
      )}

      {/* ── チャンネル一覧（全幅） ── */}
      <section ref={channelListRef}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">チャンネル一覧</h2>
        {groups.length > 0 && (
          <GroupTabs groups={groups} selected={selectedGroup} onSelect={handleGroupSelect} />
        )}
        {sortedChannels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-sm text-gray-400">追跡チャンネルがありません</p>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
          >
            {sortedChannels.map((ch) => {
              const latest = latestByChannel[ch.channel_id];
              const group = ch.group_id ? groupMap.get(ch.group_id) : undefined;
              const linked = ch.linked_channel_id ? channelMap.get(ch.linked_channel_id) : undefined;
              return (
                <ChannelCard
                  key={ch.channel_id}
                  channelId={ch.channel_id}
                  name={ch.name}
                  customUrl={ch.custom_url}
                  iconUrl={ch.icon_url}
                  subscriberCount={ch.subscriber_count}
                  totalSuperchat={scByChannel[ch.channel_id] ?? 0}
                  latestVideoStatus={latest?.status ?? "none"}
                  latestVideoStartTime={latest?.startTime ?? null}
                  groupId={ch.group_id}
                  groupName={group?.name}
                  groupColor={group?.color}
                  groupIconUrl={group?.icon_url}
                  linkedPlatform={linked?.platform ?? null}
                  onGroupFilter={setSelectedGroup}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── 動画プレビューダイアログ ── */}
      {preview && (
        <VideoPreviewDialog video={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function VideoPreviewDialog({ video, onClose }: { video: PreviewVideo; onClose: () => void }) {
  const ytUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* バックドロップ */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* ダイアログ本体 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>

          {/* サムネイル */}
          <div className="aspect-video w-full overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnail}
              alt={video.title}
              className="h-full w-full object-cover"
            />
          </div>

          {/* 情報エリア */}
          <div className="p-4">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
              {video.title}
            </p>
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

            {/* ボタン */}
            <div className="mt-4 flex gap-2">
              <a
                href={ytUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTubeで見る
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

function StatMini({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:block">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 sm:mt-1">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-gray-400">{unit}</span>}
      </p>
    </div>
  );
}
