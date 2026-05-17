import type { TwUsersResponse, TwStreamsResponse, TwFollowersResponse } from "./types";
import { trackTwitchApiCall } from "../apiUsage";

const BASE_URL = "https://api.twitch.tv/helix";

interface TokenCache {
  token: string;
  expiresAt: number;
}

export class TwitchApiError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`Twitch API error [${status}] ${endpoint}: ${message}`);
    this.name = "TwitchApiError";
  }
}

// モジュールレベルのキャッシュ（同一プロセス内で再利用）
const moduleTokenCache = new Map<string, TokenCache>();

export class TwitchClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private async getAccessToken(): Promise<string> {
    const cacheKey = this.clientId;
    const cached = moduleTokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.token;

    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Twitch auth failed [${res.status}]: ${body}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    const entry: TokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    moduleTokenCache.set(cacheKey, entry);
    return entry.token;
  }

  private async twitchFetch<T>(
    endpoint: string,
    params: Record<string, string | string[]>,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = new URL(`${BASE_URL}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, item);
      } else {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": this.clientId,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new TwitchApiError(res.status, endpoint, body);
    }

    trackTwitchApiCall().catch(() => {});
    return res.json() as Promise<T>;
  }

  users(params: Record<string, string | string[]>): Promise<TwUsersResponse> {
    return this.twitchFetch<TwUsersResponse>("users", params);
  }

  streams(params: Record<string, string | string[]>): Promise<TwStreamsResponse> {
    return this.twitchFetch<TwStreamsResponse>("streams", params);
  }

  channelFollowers(broadcasterId: string): Promise<TwFollowersResponse> {
    return this.twitchFetch<TwFollowersResponse>("channels/followers", {
      broadcaster_id: broadcasterId,
    });
  }
}
