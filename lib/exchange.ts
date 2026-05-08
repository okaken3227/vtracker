export async function fetchRatesToJPY(): Promise<Record<string, number>> {
  const endpoints = [
    "https://open.er-api.com/v6/latest/JPY",
    "https://api.exchangerate-api.com/v4/latest/JPY",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const data = (await res.json()) as { rates?: Record<string, number> };
      if (data.rates && Object.keys(data.rates).length > 0) return data.rates;
    } catch { /* 次へ */ }
  }
  return {};
}
