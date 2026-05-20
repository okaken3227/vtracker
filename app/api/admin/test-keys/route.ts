import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const BASE_URL = "https://www.googleapis.com/youtube/v3";
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

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const keyEnvs: { env: string | undefined; label: string }[] = [
    { env: process.env.YOUTUBE_API_KEY, label: "KEY_1 (YOUTUBE_API_KEY)" },
  ];
  for (let i = 2; i <= 50; i++) {
    keyEnvs.push({
      env: process.env[`YOUTUBE_API_KEY_${i}`],
      label: `KEY_${i} (YOUTUBE_API_KEY_${i})`,
    });
  }

  const activeKeys = keyEnvs.filter(({ env }) => env);

  const results = await Promise.all(
    activeKeys.map(({ env, label }) =>
      env ? testKey(env, label) : Promise.resolve({ label, ok: false, error: "未設定" })
    )
  );

  return NextResponse.json({ results, testedAt: new Date().toISOString() });
}
