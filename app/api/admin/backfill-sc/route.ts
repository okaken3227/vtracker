import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import type { Superchat } from "@/lib/types";

async function fetchRatesToJPY(): Promise<Record<string, number>> {
  const endpoints = [
    "https://open.er-api.com/v6/latest/JPY",
    "https://api.exchangerate-api.com/v4/latest/JPY",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { rates?: Record<string, number> };
      if (data.rates && Object.keys(data.rates).length > 0) return data.rates;
    } catch {
      // 次のエンドポイントを試す
    }
  }
  return {};
}

export async function POST() {
  // amount_jpy が未設定のスパチャをすべて取得
  const { data, error } = await supabase
    .from("superchats")
    .select("id, amount, currency")
    .is("amount_jpy", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Pick<Superchat, "id" | "amount" | "currency">[];

  if (rows.length === 0) {
    return NextResponse.json({ updated: 0, message: "バックフィル対象なし" });
  }

  // 対象通貨の一覧
  const currencies = [...new Set(rows.map((r) => r.currency).filter((c) => c !== "JPY"))];
  if (currencies.length === 0) {
    // JPY のみなら rate=1, amount_jpy=amount で更新
    let updated = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const results = await Promise.all(
        batch.map((r) =>
          supabase
            .from("superchats")
            .update({ amount_jpy: r.amount, exchange_rate: 1 })
            .eq("id", r.id),
        ),
      );
      const err = results.find((res) => res.error)?.error;
      if (err) return NextResponse.json({ error: err.message, updated }, { status: 500 });
      updated += batch.length;
    }
    return NextResponse.json({ updated });
  }

  const rates = await fetchRatesToJPY();
  const missing = currencies.filter((c) => !rates[c]);

  const updates = rows.map((r) => {
    const rate = r.currency === "JPY" ? 1 : (rates[r.currency] ?? null);
    const amount_jpy =
      r.currency === "JPY"
        ? r.amount
        : rate != null
        ? Math.round(r.amount / rate)
        : null;
    return { id: r.id, amount_jpy, exchange_rate: rate };
  });

  // 50件ずつ並列 update（upsert は NOT NULL 制約に引っかかるため update を使う）
  let updated = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    const results = await Promise.all(
      batch.map((upd) =>
        supabase
          .from("superchats")
          .update({ amount_jpy: upd.amount_jpy, exchange_rate: upd.exchange_rate })
          .eq("id", upd.id),
      ),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) return NextResponse.json({ error: err.message, updated }, { status: 500 });
    updated += batch.length;
  }

  return NextResponse.json({
    updated,
    currencies: currencies.join(", "),
    missing: missing.length > 0 ? missing.join(", ") : null,
  });
}
