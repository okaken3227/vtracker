import { NextResponse } from "next/server";
import { YouTubeClient, getYouTubeApiKeys } from "@/lib/youtube/client";
import { TwitchClient } from "@/lib/twitch/client";
import { supabase } from "@/lib/supabase/client";
import { extractChannel } from "@/lib/youtube/extractors";

export const dynamic = "force-dynamic";

export async function POST() {
  const ytKeys = getYouTubeApiKeys();
  if (ytKeys.length === 0) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not set" }, { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        const { data: allChannels, error } = await supabase
          .from("channels")
          .select("channel_id, name, platform");

        if (error) {
          send({ type: "error", message: `DB エラー: ${error.message}` });
          send({ type: "done", updated: 0, errors: 1 });
          controller.close();
          return;
        }

        const channels = allChannels ?? [];
        const ytChannels = channels.filter(
          (c: { platform: string | null }) => !c.platform || c.platform === "youtube"
        );
        const twChannels = channels.filter(
          (c: { platform: string | null }) => c.platform === "twitch"
        );

        send({
          type: "info",
          message: `対象: YouTube ${ytChannels.length}件 / Twitch ${twChannels.length}件`,
        });

        const yt = new YouTubeClient(ytKeys);
        let updated = 0;
        let errors = 0;

        // ── YouTube ──────────────────────────────────────────
        if (ytChannels.length > 0) {
          send({ type: "phase", message: "YouTube チャンネルを更新中..." });

          for (let i = 0; i < ytChannels.length; i += 50) {
            const batch = ytChannels.slice(i, i + 50) as { channel_id: string; name: string }[];
            const ids = batch.map((c) => c.channel_id).join(",");

            try {
              const res = await yt.channels({
                part: "snippet,statistics,brandingSettings",
                id: ids,
              });

              for (const item of res.items ?? []) {
                const ch = extractChannel(item);
                await supabase
                  .from("channels")
                  .update({
                    name: ch.name,
                    description: ch.description,
                    icon_url: ch.icon_url,
                    custom_url: ch.custom_url,
                    subscriber_count: ch.subscriber_count,
                    view_count: ch.view_count,
                    video_count: ch.video_count,
                    banner_url: ch.banner_url ?? null,
                  })
                  .eq("channel_id", ch.channel_id);

                const hasBanner = !!ch.banner_url;
                const subs = ch.subscriber_count >= 10000
                  ? `${(ch.subscriber_count / 10000).toFixed(0)}万`
                  : ch.subscriber_count.toLocaleString();
                send({
                  type: "channel",
                  message: `✓ ${ch.name} — 登録者 ${subs}${hasBanner ? " [バナー取得]" : ""}`,
                });
                updated++;
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              send({ type: "error", message: `バッチエラー (${i}〜${i + batch.length}): ${msg}` });
              errors++;
            }
          }
        }

        // ── Twitch ───────────────────────────────────────────
        if (twChannels.length > 0) {
          const clientId = process.env.TWITCH_CLIENT_ID;
          const clientSecret = process.env.TWITCH_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            send({ type: "error", message: "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET が未設定" });
          } else {
            send({ type: "phase", message: "Twitch チャンネルを更新中..." });
            const tw = new TwitchClient(clientId, clientSecret);

            for (let i = 0; i < twChannels.length; i += 100) {
              const batch = twChannels.slice(i, i + 100) as { channel_id: string }[];
              try {
                const res = await tw.users({ id: batch.map((c) => c.channel_id) });
                for (const user of res.data) {
                  await supabase
                    .from("channels")
                    .update({
                      name: user.display_name,
                      description: user.description,
                      icon_url: user.profile_image_url,
                      banner_url: user.offline_image_url ?? null,
                    })
                    .eq("channel_id", user.id);

                  const hasBanner = !!user.offline_image_url;
                  send({
                    type: "channel",
                    message: `✓ ${user.display_name}${hasBanner ? " [バナー取得]" : ""}`,
                  });
                  updated++;
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                send({ type: "error", message: `Twitch バッチエラー: ${msg}` });
                errors++;
              }
            }
          }
        }

        send({
          type: "done",
          updated,
          errors,
          message: `完了: ${updated}件更新${errors > 0 ? ` / エラー ${errors}件` : ""}`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", message: `予期しないエラー: ${msg}` });
        send({ type: "done", updated: 0, errors: 1, message: "失敗" });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
