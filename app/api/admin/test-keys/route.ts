import { NextResponse } from "next/server";

const BASE_URL = "https://www.googleapis.com/youtube/v3";
// 既知のチャンネルID（YouTube公式）で最小コストの疎通確認
const TEST_CHANNEL_ID = "UCBR8-60-B28hp2BmDPdntcQ";

async function testKey(key: string, label: string): Promise<{ label: string; ok: boolean; error?: string }> {
  try {
    const url = new URL(`${BASE_URL}/channels`);
    url.searchParams.set("key", key);
    url.searchParams.set("part", "id");
    url.searchParams.set("id", TEST_CHANNEL_ID);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const isQuota = body.includes("quotaExceeded") || body.includes("dailyLimitExceeded");
      return { label, ok: false, error: isQuota ? "クォータ超過" : `HTTP ${res.status}` };
    }
    return { label, ok: true };
  } catch (e) {
    return { label, ok: false, error: String(e) };
  }
}

export async function GET() {
  const keyEnvs = [
    { env: process.env.YOUTUBE_API_KEY, label: "KEY_1 (YOUTUBE_API_KEY)" },
    { env: process.env.YOUTUBE_API_KEY_2, label: "KEY_2 (YOUTUBE_API_KEY_2)" },
    { env: process.env.YOUTUBE_API_KEY_3, label: "KEY_3 (YOUTUBE_API_KEY_3)" },
  ];

  const results = await Promise.all(
    keyEnvs.map(({ env, label }) =>
      env ? testKey(env, label) : Promise.resolve({ label, ok: false, error: "未設定" })
    )
  );

  return NextResponse.json({ results, testedAt: new Date().toISOString() });
}
