import type { Channel, Video } from "../types";
import type { TwUser, TwStream } from "./types";

export function extractTwitchChannel(user: TwUser, followerCount: number): Channel {
  return {
    channel_id: user.id,
    name: user.display_name,
    description: user.description,
    icon_url: user.profile_image_url,
    custom_url: user.login,
    published_at: user.created_at,
    subscriber_count: followerCount,
    view_count: 0,
    video_count: 0,
    platform: "twitch",
    banner_url: user.offline_image_url || undefined,
  };
}

export function extractTwitchStream(stream: TwStream): Video {
  const thumbnail = stream.thumbnail_url
    .replace("{width}", "640")
    .replace("{height}", "360");

  return {
    video_id: stream.id,
    channel_id: stream.user_id,
    title: stream.title,
    description: stream.game_name,
    thumbnail_url: thumbnail,
    live_chat_id: null,
    start_time: stream.started_at,
    end_time: null,
    scheduled_start_time: null,
    status: "live",
    platform: "twitch",
  };
}
