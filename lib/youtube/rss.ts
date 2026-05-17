export async function fetchVideoIdsFromRSS(channelId: string): Promise<string[]> {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const text = await res.text();
    const matches = text.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g);
    return Array.from(matches, (m) => m[1]);
  } catch {
    return [];
  }
}
