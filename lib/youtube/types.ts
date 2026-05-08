export type YtChannelItem = {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    publishedAt: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
  };
};

export type YtChannelsResponse = {
  items?: YtChannelItem[];
};

export type YtVideoItem = {
  id: string;
  snippet: {
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
    liveBroadcastContent: "live" | "upcoming" | "none";
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
  };
  liveStreamingDetails?: {
    actualStartTime?: string;
    actualEndTime?: string;
    scheduledStartTime?: string;
    activeLiveChatId?: string;
    concurrentViewers?: string;
  };
};

export type YtVideosResponse = {
  nextPageToken?: string;
  items?: YtVideoItem[];
};

export type YtLiveChatMessageItem = {
  id: string;
  snippet: {
    type: string;
    publishedAt: string;
    authorChannelId: string;
    superChatDetails?: {
      amountMicros: string;
      currency: string;
      userComment?: string;
      tier: number;
    };
  };
  authorDetails: {
    channelId: string;
    displayName: string;
  };
};

export type YtLiveChatMessagesResponse = {
  nextPageToken?: string;
  offlineAt?: string;
  pollingIntervalMillis?: number;
  items?: YtLiveChatMessageItem[];
};

export type YtSearchItem = {
  id: { kind: string; channelId?: string };
  snippet: {
    channelId: string;
    title: string;
    description: string;
    thumbnails: { default?: { url: string }; medium?: { url: string } };
  };
};

export type YtSearchResponse = {
  items?: YtSearchItem[];
};

export type YtPlaylistItemItem = {
  contentDetails: {
    videoId: string;
  };
};

export type YtPlaylistItemsResponse = {
  items?: YtPlaylistItemItem[];
};
