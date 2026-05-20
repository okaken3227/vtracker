import { supabase } from "./supabase/client";

const ENDPOINT_UNITS: Record<string, number> = {
  "channels": 1,
  "videos": 1,
  "playlistItems": 1,
  "liveChat/messages": 5,
  "search": 100,
};

export async function trackApiCall(endpoint: string, keyIndex: number = 1): Promise<void> {
  const units = ENDPOINT_UNITS[endpoint] ?? 1;
  const date = new Date().toISOString().split("T")[0];
  try {
    const { data } = await supabase
      .from("api_usage_daily")
      .select("key_units, calls_count")
      .eq("date", date)
      .maybeSingle();

    const keyUnits = (data?.key_units ?? {}) as Record<string, number>;
    keyUnits[String(keyIndex)] = (keyUnits[String(keyIndex)] ?? 0) + units;

    if (data) {
      await supabase
        .from("api_usage_daily")
        .update({ key_units: keyUnits, calls_count: (data.calls_count ?? 0) + 1 })
        .eq("date", date);
    } else {
      await supabase
        .from("api_usage_daily")
        .insert({ date, units_used: 0, calls_count: 1, key_units: keyUnits });
    }
  } catch {
    // tracking failure must not break the main flow
  }
}

export async function trackQuotaExceeded(keyIndex: number): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  try {
    const { data } = await supabase
      .from("api_usage_daily")
      .select("quota_exceeded_keys")
      .eq("date", date)
      .maybeSingle();

    const exceeded = (data?.quota_exceeded_keys ?? {}) as Record<string, boolean>;
    exceeded[String(keyIndex)] = true;

    if (data) {
      await supabase
        .from("api_usage_daily")
        .update({ quota_exceeded_keys: exceeded })
        .eq("date", date);
    } else {
      await supabase
        .from("api_usage_daily")
        .insert({ date, units_used: 0, calls_count: 0, quota_exceeded_keys: exceeded });
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
