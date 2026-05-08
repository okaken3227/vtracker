export type ChannelRef =
  | { type: "id"; value: string }
  | { type: "handle"; value: string }
  | { type: "video_id"; value: string };

/**
 * YouTube URL or shorthand から channelId / handle / videoId を抽出する。
 *
 * 対応フォーマット（チャンネル）:
 *   https://www.youtube.com/channel/UCxxxxx
 *   https://www.youtube.com/@handle
 *   https://www.youtube.com/c/customUrl
 *   UCxxxxx  / @handle  (直接入力)
 *
 * 対応フォーマット（動画）:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://www.youtube.com/shorts/VIDEO_ID
 *   https://www.youtube.com/live/VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 */
export function parseChannelUrl(input: string): ChannelRef | null {
  const trimmed = input.trim();

  if (/^UC[\w-]{20,}$/.test(trimmed)) return { type: "id", value: trimmed };
  if (/^@[\w.-]+$/.test(trimmed)) return { type: "handle", value: trimmed.slice(1) };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const hostname = url.hostname.replace(/^www\./, "");

  if (hostname === "youtu.be") {
    const vid = url.pathname.slice(1).split(/[?#]/)[0];
    if (vid) return { type: "video_id", value: vid };
    return null;
  }

  if (hostname !== "youtube.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const v = url.searchParams.get("v");

  if (parts[0] === "watch" && v) return { type: "video_id", value: v };
  if ((parts[0] === "shorts" || parts[0] === "live") && parts[1]) return { type: "video_id", value: parts[1] };
  if (parts[0] === "channel" && parts[1]) return { type: "id", value: parts[1] };
  if (parts[0]?.startsWith("@")) return { type: "handle", value: parts[0].slice(1) };
  if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return { type: "handle", value: parts[1] };

  return null;
}
