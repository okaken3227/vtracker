import { supabase } from "./supabase/client";

const ENDPOINT_UNITS: Record<string, number> = {
  "channels": 1,
  "videos": 1,
  "playlistItems": 1,
  "liveChat/messages": 5,
  "search": 100,
};

export async function trackApiCall(endpoint: string): Promise<void> {
  const units = ENDPOINT_UNITS[endpoint] ?? 1;
  const date = new Date().toISOString().split("T")[0];
  try {
    const { data } = await supabase
      .from("api_usage_daily")
      .select("units_used, calls_count")
      .eq("date", date)
      .maybeSingle();

    if (data) {
      await supabase
        .from("api_usage_daily")
        .update({ units_used: data.units_used + units, calls_count: data.calls_count + 1 })
        .eq("date", date);
    } else {
      await supabase
        .from("api_usage_daily")
        .insert({ date, units_used: units, calls_count: 1 });
    }
  } catch {
    // tracking failure must not break the main flow
  }
}

/** クォータ超過したキー番号（1-based）を記録する */
export async function trackQuotaExceeded(keyIndex: 1 | 2 | 3): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  const col = keyIndex === 1 ? "quota_exceeded_key1" : keyIndex === 2 ? "quota_exceeded_key2" : "quota_exceeded_key3";
  try {
    const { data } = await supabase.from("api_usage_daily").select("date").eq("date", date).maybeSingle();
    if (data) {
      await supabase.from("api_usage_daily").update({ [col]: true }).eq("date", date);
    } else {
      await supabase.from("api_usage_daily").insert({ date, units_used: 0, calls_count: 0, [col]: true });
    }
  } catch {
    // tracking failure must not break the main flow
  }
}

export async function trackTwitchApiCall(): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  try {
    const { data } = await supabase
      .from("api_usage_daily")
      .select("twitch_calls_count")
      .eq("date", date)
      .maybeSingle();

    if (data) {
      await supabase
        .from("api_usage_daily")
        .update({ twitch_calls_count: (data.twitch_calls_count ?? 0) + 1 })
        .eq("date", date);
    } else {
      await supabase
        .from("api_usage_daily")
        .insert({ date, units_used: 0, calls_count: 0, twitch_calls_count: 1 });
    }
  } catch {
    // tracking failure must not break the main flow
  }
}
