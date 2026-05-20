"use client";

import { useState } from "react";
import type { Channel, Group } from "@/lib/types";
import ChannelCard from "./ChannelCard";
import GroupTabs from "./GroupTabs";

type LatestVideoInfo = { status: string; startTime: string | null };

type Props = {
  channels: Channel[];
  groups: Group[];
  scByChannel: Record<string, number>;
  latestByChannel: Record<string, LatestVideoInfo>;
  initialGroup?: string;
};

export default function ChannelListSection({
  channels,
  groups,
  scByChannel,
  latestByChannel,
  initialGroup,
}: Props) {
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(initialGroup);

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  // 双方向リンク対応: YouTube を primary として Twitch 側を非表示
  const linkedToIds = new Set(
    channels.filter((c) => c.linked_channel_id).map((c) => c.linked_channel_id as string)
  );
  const shownAsLinked = new Set<string>();
  for (const ch of channels) {
    if (!ch.linked_channel_id) continue;
    const isYt = !ch.platform || ch.platform === "youtube";
    const isChPointedTo = linkedToIds.has(ch.channel_id);
    if (!isChPointedTo || isYt) {
      shownAsLinked.add(ch.linked_channel_id);
    }
  }
  const deduped = channels.filter((c) => !shownAsLinked.has(c.channel_id));

  const filteredChannels = selectedGroup
    ? deduped.filter((c) => c.group_id === selectedGroup)
    : deduped;

  const liveChannelIds = new Set(
    channels
      .filter((c) => latestByChannel[c.channel_id]?.status === "live")
      .map((c) => c.channel_id)
  );

  const sortedChannels = [...filteredChannels].sort((a, b) => {
    const aLive = liveChannelIds.has(a.channel_id) ? 0 : 1;
    const bLive = liveChannelIds.has(b.channel_id) ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return b.subscriber_count - a.subscriber_count;
  });

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">チャンネル一覧</h2>
      {groups.length > 0 && (
        <GroupTabs groups={groups} selected={selectedGroup} onSelect={setSelectedGroup} />
      )}
      {sortedChannels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">追跡チャンネルがありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sortedChannels.map((ch) => {
            const group = ch.group_id ? groupMap.get(ch.group_id) : undefined;
            const parentGroup = group?.parent_group_id ? groupMap.get(group.parent_group_id) : undefined;
            const latest = latestByChannel[ch.channel_id];
            return (
              <ChannelCard
                key={ch.channel_id}
                channelId={ch.channel_id}
                name={ch.name}
                customUrl={ch.custom_url}
                iconUrl={ch.icon_url}
                subscriberCount={ch.subscriber_count}
                totalSuperchat={scByChannel[ch.channel_id] ?? 0}
                latestVideoStatus={latest?.status ?? "none"}
                latestVideoStartTime={latest?.startTime ?? null}
                groupId={ch.group_id}
                groupName={group?.name}
                groupColor={group?.color}
                groupIconUrl={parentGroup?.icon_url ?? group?.icon_url}
                onGroupFilter={setSelectedGroup}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
