import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase/client";
import { ARTICLES } from "@/lib/articles";

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
    { url: base,                  lastModified: new Date(), changeFrequency: "hourly",  priority: 1.0 },
    { url: `${base}/ranking`,     lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${base}/compare`,     lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/today`,       lastModified: new Date(), changeFrequency: "hourly",  priority: 0.7 },
    { url: `${base}/groups`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.6 },
    { url: `${base}/articles`,    lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/about`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    ...ARTICLES.map((a) => ({
      url: `${base}/articles/${a.slug}`,
      lastModified: new Date(a.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
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
