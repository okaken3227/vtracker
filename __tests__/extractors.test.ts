import { describe, it, expect } from "vitest";
import {
  extractChannel,
  extractVideo,
  extractSuperchat,
} from "../lib/youtube/extractors";
import type { YtChannelItem, YtVideoItem, YtLiveChatMessageItem } from "../lib/youtube/types";

const mockChannelItem: YtChannelItem = {
  id: "UC001",
  snippet: {
    title: "白雪ミナ",
    description: "ゲームと雑談が中心の配信者。",
    customUrl: "@minamina",
    publishedAt: "2024-01-12T00:00:00Z",
    thumbnails: {
      high: { url: "https://example.com/icon1.jpg" },
    },
  },
  statistics: {
    subscriberCount: "120000",
    viewCount: "5500000",
    videoCount: "320",
  },
};

const mockVideoItem: YtVideoItem = {
  id: "VID001",
  snippet: {
    channelId: "UC001",
    title: "【雑談】今日はゆっくり話そう",
    description: "",
    thumbnails: { high: { url: "https://example.com/thumb1.jpg" } },
    liveBroadcastContent: "live",
  },
  liveStreamingDetails: {
    actualStartTime: "2026-05-01T12:00:00Z",
    scheduledStartTime: "2026-05-01T12:00:00Z",
    activeLiveChatId: "CHAT001",
  },
};

const mockSuperchatItem: YtLiveChatMessageItem = {
  id: "SC001",
  snippet: {
    type: "superChatEvent",
    publishedAt: "2026-05-01T12:30:00Z",
    authorChannelId: "USER001",
    superChatDetails: {
      amountMicros: "1000000000", // 1000 JPY
      currency: "JPY",
      userComment: "今日も楽しい！",
      tier: 1,
    },
  },
  authorDetails: {
    channelId: "USER001",
    displayName: "視聴者A",
  },
};

describe("extractChannel", () => {
  it("必要なフィールドだけ抽出する", () => {
    const channel = extractChannel(mockChannelItem);
    expect(channel.channel_id).toBe("UC001");
    expect(channel.name).toBe("白雪ミナ");
    expect(channel.custom_url).toBe("@minamina");
    expect(channel.subscriber_count).toBe(120000);
    expect(channel.view_count).toBe(5500000);
    expect(channel.video_count).toBe(320);
    expect(channel.icon_url).toBe("https://example.com/icon1.jpg");
  });

  it("statistics が欠けていても 0 になる", () => {
    const item: YtChannelItem = {
      ...mockChannelItem,
      statistics: {},
    };
    const channel = extractChannel(item);
    expect(channel.subscriber_count).toBe(0);
    expect(channel.view_count).toBe(0);
    expect(channel.video_count).toBe(0);
  });
});

describe("extractVideo", () => {
  it("必要なフィールドだけ抽出する", () => {
    const video = extractVideo(mockVideoItem);
    expect(video.video_id).toBe("VID001");
    expect(video.channel_id).toBe("UC001");
    expect(video.status).toBe("live");
    expect(video.live_chat_id).toBe("CHAT001");
    expect(video.start_time).toBe("2026-05-01T12:00:00Z");
    expect(video.end_time).toBeNull();
  });

  it("liveStreamingDetails がなければ null", () => {
    const item: YtVideoItem = { ...mockVideoItem, liveStreamingDetails: undefined };
    const video = extractVideo(item);
    expect(video.live_chat_id).toBeNull();
    expect(video.start_time).toBeNull();
  });
});

describe("extractSuperchat", () => {
  it("スパチャメッセージを正しく変換する", () => {
    const sc = extractSuperchat(mockSuperchatItem, "VID001");
    expect(sc).not.toBeNull();
    expect(sc!.id).toBe("SC001");
    expect(sc!.amount).toBe(1000); // 1000000000 micros → 1000 JPY
    expect(sc!.currency).toBe("JPY");
    expect(sc!.tier).toBe(1);
    expect(sc!.comment).toBe("今日も楽しい！");
    expect(sc!.author_name).toBe("視聴者A");
  });

  it("superChatEvent 以外は null を返す", () => {
    const item: YtLiveChatMessageItem = {
      ...mockSuperchatItem,
      snippet: { ...mockSuperchatItem.snippet, type: "textMessageEvent" },
    };
    expect(extractSuperchat(item, "VID001")).toBeNull();
  });

  it("superChatDetails がなければ null を返す", () => {
    const item: YtLiveChatMessageItem = {
      ...mockSuperchatItem,
      snippet: {
        ...mockSuperchatItem.snippet,
        superChatDetails: undefined,
      },
    };
    expect(extractSuperchat(item, "VID001")).toBeNull();
  });
});
