import type {
  YtChannelsResponse,
  YtVideosResponse,
  YtLiveChatMessagesResponse,
  YtSearchResponse,
  YtPlaylistItemsResponse,
} from "./types";
import { trackApiCall } from "../apiUsage";

const BASE_URL = "https://www.googleapis.com/youtube/v3";

export class YouTubeApiError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`YouTube API error [${status}] ${endpoint}: ${message}`);
    this.name = "YouTubeApiError";
  }
}

async function ytFetch<T>(
  apiKey: string,
  endpoint: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new YouTubeApiError(res.status, endpoint, body);
  }
  trackApiCall(endpoint).catch(() => {});
  return res.json() as Promise<T>;
}

export class YouTubeClient {
  constructor(private readonly apiKey: string) {}

  channels(params: Record<string, string>): Promise<YtChannelsResponse> {
    return ytFetch<YtChannelsResponse>(this.apiKey, "channels", params);
  }

  videos(params: Record<string, string>): Promise<YtVideosResponse> {
    return ytFetch<YtVideosResponse>(this.apiKey, "videos", params);
  }

  liveChatMessages(
    params: Record<string, string>,
  ): Promise<YtLiveChatMessagesResponse> {
    return ytFetch<YtLiveChatMessagesResponse>(
      this.apiKey,
      "liveChat/messages",
      params,
    );
  }

  search(params: Record<string, string>): Promise<YtSearchResponse> {
    return ytFetch<YtSearchResponse>(this.apiKey, "search", params);
  }

  playlistItems(params: Record<string, string>): Promise<YtPlaylistItemsResponse> {
    return ytFetch<YtPlaylistItemsResponse>(this.apiKey, "playlistItems", params);
  }
}
