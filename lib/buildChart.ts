import type { Video, Channel, Group, LiveGraphPoint } from "./types";

export type StreamInfo = {
  videoId: string;
  channelId: string;
  channelName: string;
  videoTitle: string;
  color: string;
  peakT: number;
  peakViewers: number;
  iconUrl: string;
  groupName: string | null;
  groupColor: string | null;
  totalSCJPY?: number;
};

export type ChartPoint = { t: number } & Record<string, number>;

const STREAM_COLORS = [
  "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899",
  "#3b82f6", "#84cc16", "#f97316", "#a855f7", "#14b8a6", "#f43f5e",
];
const BUCKET_MS = 5 * 60 * 1000;

export function buildChart(
  allVideos: Video[],
  graphPoints: LiveGraphPoint[],
  channels: Channel[],
  groups: Group[],
  jstMidnightMs: number,
  scByVideo: Map<string, number>,
): { data: ChartPoint[]; streams: StreamInfo[] } {
  if (graphPoints.length === 0) return { data: [], streams: [] };

  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const videoMap = new Map(allVideos.map((v) => [v.video_id, v]));
  const videoIds = [...new Set(graphPoints.map((p) => p.video_id))];
  const videos = videoIds.map((id) => videoMap.get(id)).filter((v): v is Video => v != null);

  const streams: StreamInfo[] = [];
  const allTs = new Set<number>();
  const videoSeries = new Map<string, Map<number, number[]>>();

  for (const v of videos) {
    const buckets = new Map<number, number[]>();
    for (const p of graphPoints) {
      if (p.video_id !== v.video_id) continue;
      const ms = new Date(p.recorded_at).getTime() - jstMidnightMs;
      const t = Math.max(0, Math.floor(ms / BUCKET_MS) * 5);
      if (!buckets.has(t)) buckets.set(t, []);
      buckets.get(t)!.push(p.concurrent_viewers);
    }
    if (buckets.size === 0) continue;
    videoSeries.set(v.video_id, buckets);
    buckets.forEach((_, t) => allTs.add(t));

    let peakT = 0, peakViewers = 0;
    buckets.forEach((vs, t) => {
      const avg = Math.round(vs.reduce((s, x) => s + x, 0) / vs.length);
      if (avg > peakViewers) { peakViewers = avg; peakT = t; }
    });

    const ch = channelMap.get(v.channel_id);
    const group = ch?.group_id ? groupMap.get(ch.group_id) : undefined;
    streams.push({
      videoId: v.video_id,
      channelId: v.channel_id,
      channelName: ch?.name ?? v.channel_id,
      videoTitle: v.title,
      color: STREAM_COLORS[streams.length % STREAM_COLORS.length],
      peakT,
      peakViewers,
      iconUrl: ch?.icon_url ?? "",
      groupName: group?.name ?? null,
      groupColor: group?.color ?? null,
      totalSCJPY: scByVideo.get(v.video_id) ?? 0,
    });
  }

  const sortedTs = Array.from(allTs).sort((a, b) => a - b);
  const data: ChartPoint[] = sortedTs.map((t) => {
    const pt: ChartPoint = { t };
    for (const v of videos) {
      const vs = videoSeries.get(v.video_id)?.get(t);
      if (vs && vs.length > 0) pt[v.video_id] = Math.round(vs.reduce((s, x) => s + x, 0) / vs.length);
    }
    return pt;
  });

  return { data, streams };
}
