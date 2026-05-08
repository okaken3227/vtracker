import type { Channel, Video, Superchat, VideoStatus } from "../types";
import type {
  YtChannelItem,
  YtVideoItem,
  YtLiveChatMessageItem,
} from "./types";

export function extractChannel(item: YtChannelItem): Channel {
  const { snippet, statistics } = item;
  const icon =
    snippet.thumbnails.high?.url ??
    snippet.thumbnails.medium?.url ??
    snippet.thumbnails.default?.url ??
    "";

  return {
    channel_id: item.id,
    name: snippet.title,
    description: snippet.description,
    icon_url: icon,
    custom_url: snippet.customUrl ?? "",
    published_at: snippet.publishedAt,
    subscriber_count: parseInt(statistics.subscriberCount ?? "0", 10),
    view_count: parseInt(statistics.viewCount ?? "0", 10),
    video_count: parseInt(statistics.videoCount ?? "0", 10),
  };
}

export function extractVideo(item: YtVideoItem): Video {
  const { snippet, liveStreamingDetails } = item;
  const thumbnail =
    snippet.thumbnails.high?.url ??
    snippet.thumbnails.medium?.url ??
    snippet.thumbnails.default?.url ??
    "";

  const status = (snippet.liveBroadcastContent ?? "none") as VideoStatus;

  return {
    video_id: item.id,
    channel_id: snippet.channelId,
    title: snippet.title,
    description: snippet.description,
    thumbnail_url: thumbnail,
    live_chat_id: liveStreamingDetails?.activeLiveChatId ?? null,
    start_time: liveStreamingDetails?.actualStartTime ?? null,
    end_time: liveStreamingDetails?.actualEndTime ?? null,
    scheduled_start_time: liveStreamingDetails?.scheduledStartTime ?? null,
    status,
  };
}

export function extractSuperchat(
  item: YtLiveChatMessageItem,
  videoId: string,
): Superchat | null {
  if (item.snippet.type !== "superChatEvent") return null;

  const sc = item.snippet.superChatDetails;
  if (!sc) return null;

  // amountMicros は通貨の 1/1,000,000 単位（JPY の場合は 1/1,000,000 円）
  const amount = Math.round(parseInt(sc.amountMicros, 10) / 1_000_000);

  return {
    id: item.id,
    video_id: videoId,
    author_channel_id: item.authorDetails.channelId,
    author_name: item.authorDetails.displayName,
    amount,
    currency: sc.currency,
    comment: sc.userComment ?? "",
    tier: sc.tier,
    published_at: item.snippet.publishedAt,
  };
}
