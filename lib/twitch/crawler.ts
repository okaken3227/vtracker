import { TwitchClient } from "./client";
import { extractTwitchChannel, extractTwitchStream } from "./extractors";
import type { VTrackerRepository } from "../supabase/repository";

export class TwitchCrawler {
  constructor(
    private readonly tw: TwitchClient,
    private readonly repo: VTrackerRepository,
  ) {}

  async addChannel(login: string): Promise<string> {
    const usersRes = await this.tw.users({ login });
    const user = usersRes.data[0];
    if (!user) throw new Error(`Twitch user not found: ${login}`);

    let followerCount = 0;
    try {
      const followersRes = await this.tw.channelFollowers(user.id);
      followerCount = followersRes.total;
    } catch {
      // follower endpoint may require broadcaster/moderator scope — skip gracefully
    }

    const channel = extractTwitchChannel(user, followerCount);
    await this.repo.upsertChannel(channel);
    console.log(`[twitch-crawler] upserted channel: ${channel.name}`);

    // Check if currently live and record the stream
    const streamsRes = await this.tw.streams({ user_id: user.id });
    const stream = streamsRes.data[0];
    if (stream) {
      const video = extractTwitchStream(stream);
      await this.repo.upsertVideo(video);
      console.log(`[twitch-crawler] found live stream: ${video.title}`);
    }

    return user.id;
  }

  async pollActiveLiveStreams(): Promise<{ updated: number; ended: number }> {
    const twitchChannels = await this.repo.getTwitchChannels();
    if (twitchChannels.length === 0) return { updated: 0, ended: 0 };

    const userIds = twitchChannels.map((c) => c.channel_id);
    console.log(`[twitch-crawler] polling ${userIds.length} Twitch channels`);

    let updated = 0;
    let ended = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < userIds.length; i += 100) {
      const batch = userIds.slice(i, i + 100);
      const streamsRes = await this.tw.streams({ user_id: batch });
      const liveByUserId = new Map(streamsRes.data.map((s) => [s.user_id, s]));

      // Upsert currently live streams
      for (const stream of streamsRes.data) {
        const video = extractTwitchStream(stream);
        await this.repo.upsertVideo(video);
        updated++;
      }

      // Mark ended streams
      for (const channelId of batch) {
        if (!liveByUserId.has(channelId)) {
          await this.repo.markTwitchStreamEnded(channelId, now);
          ended++;
        }
      }
    }

    return { updated, ended };
  }
}
