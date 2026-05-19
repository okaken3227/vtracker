import type {
  YtChannelsResponse,
  YtVideosResponse,
  YtLiveChatMessagesResponse,
  YtSearchResponse,
  YtPlaylistItemsResponse,
} from "./types";
import { trackApiCall, trackQuotaExceeded } from "../apiUsage";

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

function isQuotaExceeded(err: unknown): boolean {
  if (!(err instanceof YouTubeApiError)) return false;
  if (err.status !== 403) return false;
  return err.message.includes("quotaExceeded") || err.message.includes("dailyLimitExceeded");
}

async function ytFetch<T>(
  apiKey: string,
  endpoint: string,
  params: Record<string, string>,
  keyIndex: 1 | 2 | 3 = 1,
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
  trackApiCall(endpoint, keyIndex).catch(() => {});
  return res.json() as Promise<T>;
}

/** 環境変数から利用可能な全APIキーを取得する */
export function getYouTubeApiKeys(): string[] {
  return [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
  ].filter((k): k is string => Boolean(k));
}

export class YouTubeClient {
  private readonly keys: string[];

  /** 単一キーまたは複数キー（クォータ超過時に自動ローテーション）を受け付ける */
  constructor(apiKeyOrKeys: string | string[]) {
    this.keys = Array.isArray(apiKeyOrKeys) ? apiKeyOrKeys : [apiKeyOrKeys];
    if (this.keys.length === 0) throw new Error("No YouTube API key provided");
  }

  private async fetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    let lastError: unknown;
    for (let idx = 0; idx < this.keys.length; idx++) {
      const key = this.keys[idx];
      try {
        return await ytFetch<T>(key, endpoint, params, (idx + 1) as 1 | 2 | 3);
      } catch (err) {
        if (isQuotaExceeded(err)) {
          const keyNum = (idx + 1) as 1 | 2 | 3;
          console.warn(`[YouTubeClient] quota exceeded on key #${keyNum}, trying next`);
          trackQuotaExceeded(keyNum).catch(() => {});
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError ?? new Error("All YouTube API keys exhausted");
  }

  channels(params: Record<string, string>): Promise<YtChannelsResponse> {
    return this.fetch<YtChannelsResponse>("channels", params);
  }

  videos(params: Record<string, string>): Promise<YtVideosResponse> {
    return this.fetch<YtVideosResponse>("videos", params);
  }

  liveChatMessages(params: Record<string, string>): Promise<YtLiveChatMessagesResponse> {
    return this.fetch<YtLiveChatMessagesResponse>("liveChat/messages", params);
  }

  search(params: Record<string, string>): Promise<YtSearchResponse> {
    return this.fetch<YtSearchResponse>("search", params);
  }

  playlistItems(params: Record<string, string>): Promise<YtPlaylistItemsResponse> {
    return this.fetch<YtPlaylistItemsResponse>("playlistItems", params);
  }
}
