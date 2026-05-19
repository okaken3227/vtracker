import { supabase } from "./supabase/client";

const ENDPOINT_UNITS: Record<string, number> = {
  "channels": 1,
  "videos": 1,
  "playlistItems": 1,
  "liveChat/messages": 5,
  "search": 100,
};

type KeyIndex = 1 | 2 | 3 | 4 | 5 | 6;

const UNITS_COL: Record<KeyIndex, string> = {
  1: "units_used",
  2: "units_used_key2",
  3: "units_used_key3",
  4: "units_used_key4",
  5: "units_used_key5",
  6: "units_used_key6",
};

const QUOTA_COL: Record<KeyIndex, string> = {
  1: "quota_exceeded_key1",
  2: "quota_exceeded_key2",
  3: "quota_exceeded_key3",
  4: "quota_exceeded_key4",
  5: "quota_exceeded_key5",
  6: "quota_exceeded_key6",
};

export async function trackApiCall(endpoint: string, keyIndex: KeyIndex = 1): Promise<void> {
  const units = ENDPOINT_UNITS[endpoint] ?? 1;
  const date = new Date().toISOString().split("T")[0];
  const unitsCol = UNITS_COL[keyIndex];
  try {
    const { data } = await supabase
      .from("api_usage_daily")
      .select("units_used, units_used_key2, units_used_key3, units_used_key4, units_used_key5, units_used_key6, calls_count")
      .eq("date", date)
      .maybeSingle();

    if (data) {
      await supabase
        .from("api_usage_daily")
        .update({
          [unitsCol]: ((data[unitsCol as keyof typeof data] as number) ?? 0) + units,
          calls_count: data.calls_count + 1,
        })
        .eq("date", date);
    } else {
      await supabase
        .from("api_usage_daily")
        .insert({ date, units_used: 0, units_used_key2: 0, units_used_key3: 0, units_used_key4: 0, units_used_key5: 0, units_used_key6: 0, calls_count: 1, [unitsCol]: units });
    }
  } catch {
    // tracking failure must not break the main flow
  }
}

/** クォータ超過したキー番号（1-based）を記録する */
export async function trackQuotaExceeded(keyIndex: KeyIndex): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  const col = QUOTA_COL[keyIndex];
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
