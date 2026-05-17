import { YouTubeClient } from "../youtube/client";
import {
  extractChannel,
  extractVideo,
  extractSuperchat,
} from "../youtube/extractors";
import type { VTrackerRepository } from "../supabase/repository";
import type { ChannelRef } from "./urlParser";
import type { Superchat, Video } from "../types";

const CHAT_MAX_RESULTS = "2000";

export class VTrackerCrawler {
  constructor(
    private readonly yt: YouTubeClient,
    private readonly repo: VTrackerRepository,
  ) {}

  /**
   * 動画 URL からチャンネル + 動画 + スパチャを取得して保存する
   */
  async addVideo(videoId: string): Promise<void> {
    const res = await this.yt.videos({
      part: "snippet,liveStreamingDetails",
      id: videoId,
    });
    const item = res.items?.[0];
    if (!item) throw new Error(`Video not found: ${videoId}`);

    const video = extractVideo(item);
    const channelId = video.channel_id;

    // チャンネルを先に保存（FK 制約のため）
    await this.syncChannel(channelId);
    await this.repo.upsertVideo(video);
    console.log(`[crawler] upserted video: ${video.title} (${video.status})`);

    if (video.status === "live" && video.live_chat_id) {
      await this.syncSuperchats(video);
    }
  }

  /**
   * チャンネル URL からチャンネル情報だけを保存する
   * （動画は addVideo で個別追加）
   */
  async addChannel(ref: ChannelRef): Promise<string> {
    const channelId = await this.resolveChannelId(ref);
    console.log(`[crawler] resolved channelId: ${channelId}`);
    await this.syncChannel(channelId);
    return channelId;
  }

  /**
   * ライブ中の動画のスパチャを定期ポーリング
   */
  async pollActiveLiveChats(): Promise<void> {
    const liveVideos = await this.repo.getActiveVideos();
    console.log(`[crawler] active live videos: ${liveVideos.length}`);
    for (const video of liveVideos) {
      if (!video.live_chat_id) continue;
      await this.syncSuperchats(video);
    }
  }

  // ── private ────────────────────────────────────────────────────────────

  private async resolveChannelId(ref: ChannelRef): Promise<string> {
    if (ref.type === "id") return ref.value;

    const res = await this.yt.channels({ part: "id", forHandle: ref.value });
    const id = res.items?.[0]?.id;
    if (!id) throw new Error(`Channel not found for handle: @${ref.value}`);
    return id;
  }

  private async syncChannel(channelId: string): Promise<void> {
    const res = await this.yt.channels({
      part: "snippet,statistics,brandingSettings",
      id: channelId,
    });
    const item = res.items?.[0];
    if (!item) throw new Error(`Channel not found: ${channelId}`);

    const channel = extractChannel(item);
    await this.repo.upsertChannel(channel);
    console.log(`[crawler] upserted channel: ${channel.name}`);
  }

  private async syncSuperchats(video: Video): Promise<void> {
    if (!video.live_chat_id) return;

    let pageToken: string | undefined;
    let isEnded = false;

    do {
      const params: Record<string, string> = {
        part: "snippet,authorDetails",
        liveChatId: video.live_chat_id,
        maxResults: CHAT_MAX_RESULTS,
      };
      if (pageToken) params.pageToken = pageToken;

      const res = await this.yt.liveChatMessages(params);

      const superchats: Superchat[] = (res.items ?? [])
        .map((item) => extractSuperchat(item, video.video_id))
        .filter((sc): sc is Superchat => sc !== null);

      await this.repo.upsertSuperchats(superchats);

      if (superchats.length > 0) {
        console.log(`[crawler] upserted ${superchats.length} superchats for ${video.video_id}`);
      }

      if (res.offlineAt) {
        isEnded = true;
        await this.repo.markVideoEnded(video.video_id, res.offlineAt);
        console.log(`[crawler] video ended: ${video.video_id} at ${res.offlineAt}`);
      }

      // YouTube API が指定するポーリング間隔を守る
      if (res.pollingIntervalMillis && res.nextPageToken && !isEnded) {
        await new Promise((r) => setTimeout(r, res.pollingIntervalMillis));
      }

      pageToken = res.nextPageToken;
    } while (pageToken && !isEnded);
  }
}
