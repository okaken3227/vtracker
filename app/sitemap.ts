import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase/client";

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [{ data: groups }, { data: channels }] = await Promise.all([
    supabase.from("groups").select("id, created_at"),
    supabase.from("channels").select("channel_id, published_at"),
  ]);

  return [
    { url: base, lastModified: new Date(), changeFrequency: "hourly", priority: 1.0 },
    { url: `${base}/today`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.7 },
    ...(groups ?? []).map((g) => ({
      url: `${base}/group/${g.id}`,
      lastModified: new Date(g.created_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(channels ?? []).map((c) => ({
      url: `${base}/channel/${c.channel_id}`,
      lastModified: c.published_at ? new Date(c.published_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
