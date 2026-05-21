export type GroupCategory = "vtuber" | "esports" | "indie" | "other";

export type Group = {
  id: string;
  name: string;
  color: string;
  created_at: string;
  parent_group_id?: string | null;
  icon_url?: string | null;
  keywords?: string | null;
  category?: GroupCategory | null;
  slug?: string | null;
  sort_order?: number | null;
  website_url?: string | null;
};

export type Platform = "youtube" | "twitch";

export type Channel = {
  channel_id: string;
  name: string;
  description: string;
  icon_url: string;
  custom_url: string;
  published_at: string;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  group_id?: string | null;
  banner_url?: string | null;
  color?: string | null;
  platform?: Platform;
  linked_channel_id?: string | null;
  keywords?: string | null;
};

export type VideoStatus = "live" | "upcoming" | "none";

export type Video = {
  video_id: string;
  channel_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  live_chat_id: string | null;
  start_time: string | null;
  end_time: string | null;
  scheduled_start_time: string | null;
  status: VideoStatus;
  platform?: Platform;
};

export type Superchat = {
  id: string;
  video_id: string;
  author_channel_id: string;
  author_name: string;
  amount: number;
  currency: string;
  comment: string;
  tier: number;
  published_at: string;
  amount_jpy?: number | null;
  exchange_rate?: number | null;
};

export type LiveGraphPoint = {
  id: number;
  video_id: string;
  recorded_at: string;
  concurrent_viewers: number;
  view_count: number;
  like_count: number;
};

export type ChannelStatsHistory = {
  id: number;
  channel_id: string;
  subscriber_count: number;
  view_count: number;
  recorded_at: string;
};
