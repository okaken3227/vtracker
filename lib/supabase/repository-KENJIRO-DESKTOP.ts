import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel, Video, Superchat } from "../types";


export class VTrackerRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsertChannel(channel: Channel): Promise<void> {
    const { error } = await this.db
      .from("channels")
      .upsert(channel, { onConflict: "channel_id" });

    if (error) throw new Error(`upsertChannel failed: ${error.message}`);
  }

  async upsertVideo(video: Video): Promise<void> {
    const { error } = await this.db
      .from("videos")
      .upsert(video, { onConflict: "video_id" });

    if (error) throw new Error(`upsertVideo failed: ${error.message}`);
  }

  /**
   * スパチャは id が重複していれば無視（重複排除）
   */
  async upsertSuperchats(superchats: Superchat[]): Promise<void> {
    if (superchats.length === 0) return;

    const { error } = await this.db
      .from("superchats")
      .upsert(superchats, { onConflict: "id", ignoreDuplicates: true });

    if (error) throw new Error(`upsertSuperchats failed: ${error.message}`);
  }

  async getActiveVideos(): Promise<Video[]> {
    const { data, error } = await this.db
      .from("videos")
      .select("*")
      .eq("status", "live");

    if (error) throw new Error(`getActiveVideos failed: ${error.message}`);
    return (data as Video[]) ?? [];
  }

  async markVideoEnded(
    videoId: string,
    endTime: string,
  ): Promise<void> {
    const { error } = await this.db
      .from("videos")
      .update({ status: "none", end_time: endTime })
      .eq("video_id", videoId);

    if (error) throw new Error(`markVideoEnded failed: ${error.message}`);
  }

  async getTwitchChannels(): Promise<Channel[]> {
    const { data, error } = await this.db
      .from("channels")
      .select("*")
      .eq("platform", "twitch");

    if (error) throw new Error(`getTwitchChannels failed: ${error.message}`);
    return (data as Channel[]) ?? [];
  }

  async markTwitchStreamEnded(channelId: string, endTime: string): Promise<void> {
    const { error } = await this.db
      .from("videos")
      .update({ status: "none", end_time: endTime })
      .eq("channel_id", channelId)
      .eq("status", "live")
      .eq("platform", "twitch");

    if (error) throw new Error(`markTwitchStreamEnded failed: ${error.message}`);
  }
}
