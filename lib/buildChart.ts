import type { Video, Channel, Group } from "./types";
import { GRAPH_COLORS, GRAPH_BUCKET_MS } from "./chartConfig";

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

// get_chart_data RPC から返ってくる行の型
export type GraphPoint = {
  video_id: string;
  bucket: string;       // 5分バケットのタイムスタンプ (ISO string)
  avg_viewers: number;  // DBで平均済み
};

const STREAM_COLORS = GRAPH_COLORS;
const BUCKET_MS = GRAPH_BUCKET_MS;

export function buildChart(
  allVideos: Video[],
  graphPoints: GraphPoint[],
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

  // O(n+m): video_id でグループ化してからイテレート
  const pointsByVideo = new Map<string, { t: number; viewers: number }[]>();
  for (const p of graphPoints) {
    const ms = new Date(p.bucket).getTime() - jstMidnightMs;
    const t = Math.max(0, Math.floor(ms / BUCKET_MS) * 5);
    if (!pointsByVideo.has(p.video_id)) pointsByVideo.set(p.video_id, []);
    pointsByVideo.get(p.video_id)!.push({ t, viewers: p.avg_viewers });
  }

  const streams: StreamInfo[] = [];
  const allTs = new Set<number>();
  const videoSeries = new Map<string, Map<number, number>>();

  for (const v of videos) {
    const pts = pointsByVideo.get(v.video_id);
    if (!pts || pts.length === 0) continue;
    const buckets = new Map<number, number>();
    let peakT = 0, peakViewers = 0;
    for (const { t, viewers } of pts) {
      buckets.set(t, viewers); // DBで平均済みなので上書きでOK
      allTs.add(t);
      if (viewers > peakViewers) { peakViewers = viewers; peakT = t; }
    }
    videoSeries.set(v.video_id, buckets);

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
      const val = videoSeries.get(v.video_id)?.get(t);
      if (val !== undefined) pt[v.video_id] = val;
    }
    return pt;
  });

  return { data, streams };
}
