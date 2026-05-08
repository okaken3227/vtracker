import { describe, it, expect, vi, beforeEach } from "vitest";
import { VTrackerCrawler } from "../lib/crawler/index";
import type { YouTubeClient } from "../lib/youtube/client";
import type { VTrackerRepository } from "../lib/supabase/repository";
import type { Video } from "../lib/types";

// モックデータ（mock/ ディレクトリの内容と一致）
import channels from "../../mock/channel.json";
import videos from "../../mock/video.json";
import superchats from "../../mock/superchat.json";

function makeMockYt(): YouTubeClient {
  return {
    channels: vi.fn().mockResolvedValue({
      items: [
        {
          id: channels[0].channel_id,
          snippet: {
            title: channels[0].name,
            description: channels[0].description,
            customUrl: channels[0].custom_url,
            publishedAt: channels[0].published_at,
            thumbnails: { high: { url: channels[0].icon_url } },
          },
          statistics: {
            subscriberCount: String(channels[0].subscriber_count),
            viewCount: String(channels[0].view_count),
            videoCount: String(channels[0].video_count),
          },
        },
      ],
    }),
    videos: vi.fn().mockResolvedValue({
      items: [
        {
          id: videos[0].video_id,
          snippet: {
            channelId: videos[0].channel_id,
            title: videos[0].title,
            description: "",
            thumbnails: { high: { url: videos[0].thumbnail_url } },
            liveBroadcastContent: videos[0].status,
          },
          liveStreamingDetails: {
            actualStartTime: videos[0].start_time,
            actualEndTime: videos[0].end_time,
            scheduledStartTime: videos[0].scheduled_start_time,
            activeLiveChatId: videos[0].live_chat_id,
          },
        },
      ],
    }),
    liveChatMessages: vi.fn().mockResolvedValue({
      items: [
        {
          id: superchats[0].id,
          snippet: {
            type: "superChatEvent",
            publishedAt: superchats[0].published_at,
            authorChannelId: superchats[0].author_channel_id,
            superChatDetails: {
              amountMicros: String(superchats[0].amount * 1_000_000),
              currency: superchats[0].currency,
              userComment: superchats[0].comment,
              tier: superchats[0].tier,
            },
          },
          authorDetails: {
            channelId: superchats[0].author_channel_id,
            displayName: superchats[0].author_name,
          },
        },
      ],
    }),
  } as unknown as YouTubeClient;
}

function makeMockRepo(): VTrackerRepository {
  return {
    upsertChannel: vi.fn().mockResolvedValue(undefined),
    upsertVideo: vi.fn().mockResolvedValue(undefined),
    upsertSuperchats: vi.fn().mockResolvedValue(undefined),
    getActiveVideos: vi.fn().mockResolvedValue([]),
    markVideoEnded: vi.fn().mockResolvedValue(undefined),
  } as unknown as VTrackerRepository;
}

describe("VTrackerCrawler.addChannel", () => {
  let yt: YouTubeClient;
  let repo: VTrackerRepository;
  let crawler: VTrackerCrawler;

  beforeEach(() => {
    yt = makeMockYt();
    repo = makeMockRepo();
    crawler = new VTrackerCrawler(yt, repo);
  });

  it("channel ID で addChannel するとチャンネルと動画が保存される", async () => {
    await crawler.addChannel({ type: "id", value: "UC001" });

    expect(yt.channels).toHaveBeenCalledWith(
      expect.objectContaining({ id: "UC001" }),
    );
    expect(repo.upsertChannel).toHaveBeenCalledOnce();
    expect(repo.upsertVideo).toHaveBeenCalledOnce();
  });

  it("handle で addChannel すると forHandle で ID を解決する", async () => {
    await crawler.addChannel({ type: "handle", value: "minamina" });

    expect(yt.channels).toHaveBeenCalledWith(
      expect.objectContaining({ forHandle: "minamina" }),
    );
  });
});

describe("VTrackerCrawler.pollActiveLiveChats", () => {
  it("ライブ中の動画のスパチャを取得する", async () => {
    const liveVideo: Video = {
      video_id: "VID001",
      channel_id: "UC001",
      title: "テスト配信",
      description: "",
      thumbnail_url: "",
      live_chat_id: "CHAT001",
      start_time: "2026-05-01T12:00:00Z",
      end_time: null,
      scheduled_start_time: null,
      status: "live",
    };

    const yt = makeMockYt();
    const repo = {
      ...makeMockRepo(),
      getActiveVideos: vi.fn().mockResolvedValue([liveVideo]),
    } as unknown as VTrackerRepository;

    const crawler = new VTrackerCrawler(yt, repo);
    await crawler.pollActiveLiveChats();

    expect(yt.liveChatMessages).toHaveBeenCalledWith(
      expect.objectContaining({ liveChatId: "CHAT001" }),
    );
    expect(repo.upsertSuperchats).toHaveBeenCalledOnce();
  });

  it("offlineAt が返ってきたら動画を終了済みにする", async () => {
    const liveVideo: Video = {
      video_id: "VID001",
      channel_id: "UC001",
      title: "テスト配信",
      description: "",
      thumbnail_url: "",
      live_chat_id: "CHAT001",
      start_time: "2026-05-01T12:00:00Z",
      end_time: null,
      scheduled_start_time: null,
      status: "live",
    };

    const yt = {
      ...makeMockYt(),
      liveChatMessages: vi.fn().mockResolvedValue({
        offlineAt: "2026-05-01T14:00:00Z",
        items: [],
      }),
    } as unknown as YouTubeClient;

    const repo = {
      ...makeMockRepo(),
      getActiveVideos: vi.fn().mockResolvedValue([liveVideo]),
    } as unknown as VTrackerRepository;

    const crawler = new VTrackerCrawler(yt, repo);
    await crawler.pollActiveLiveChats();

    expect(repo.markVideoEnded).toHaveBeenCalledWith(
      "VID001",
      "2026-05-01T14:00:00Z",
    );
  });
});
