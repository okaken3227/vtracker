"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Group, GroupCategory } from "@/lib/types";
import AdminHeader from "./AdminHeader";
import AdminFeedbackSection from "./AdminFeedbackSection";

type ChannelRow = {
  channel_id: string;
  name: string;
  group_id: string | null;
  icon_url: string;
  platform?: string;
  linked_channel_id?: string | null;
  custom_url?: string;
  color?: string | null;
  keywords?: string | null;
};

type ChannelPreview = {
  channelId: string;
  name: string;
  iconUrl: string;
  description: string;
  detectedGroupId: string | null;
  alreadyExists: boolean;
  existingGroupId: string | null;
  platform?: string;
};

type SearchCandidate = {
  channelId: string;
  name: string;
  iconUrl: string;
  description: string;
};

type BulkRow = {
  id: number;
  input: string;
  status: "loading" | "found" | "error";
  preview?: ChannelPreview;
  error?: string;
  selectedGroupId: string;
  keywords: string;
  include: boolean;
  addStatus?: "adding" | "added" | "failed";
  addError?: string;
  platform?: string;
};

const GROUP_COLORS = [
  "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981",
  "#ef4444", "#ec4899", "#3b82f6", "#84cc16",
];

const CHANNEL_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#64748b", "#0f172a", "#ffffff", "#f59e0b",
];

const CATEGORY_LABELS: Record<GroupCategory, string> = {
  vtuber: "VTuber",
  esports: "Eスポーツ",
  indie: "個人勢",
  other: "その他",
};

function autoId(name: string): string {
  const ascii = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  return ascii || `group_${Date.now().toString(36)}`;
}

function PlatformBadge({ platform }: { platform?: string }) {
  if (platform === "twitch") {
    return <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Twitch</span>;
  }
  return <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">YouTube</span>;
}

export default function AdminPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollStatus, setPollStatus] = useState("");
  const [findLiveStatus, setFindLiveStatus] = useState("");
  const [findLiveResults, setFindLiveResults] = useState<{ videoId: string; channelId: string; channelName: string; title: string; platform?: string; url?: string }[] | null>(null);
  const [findLiveLog, setFindLiveLog] = useState<string[]>([]);
  const [findLiveUnits, setFindLiveUnits] = useState<{ calls: number; units: number } | null>(null);
  const [reclassifyStatus, setReclassifyStatus] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const syncLogRef = useRef<HTMLDivElement>(null);
  const [apiUsage, setApiUsage] = useState<{ unitsUsed: number; callsCount: number; quotaLimit: number; twitchCallsCount: number; keyCount: number; perKeyUnits: number[]; quotaExceededKeys: boolean[] } | null>(null);
  const [testKeysResult, setTestKeysResult] = useState<{ results: { label: string; ok: boolean; error?: string }[]; testedAt: string } | null>(null);
  const [testKeysLoading, setTestKeysLoading] = useState(false);

  // グループ作成
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupIconUrl, setNewGroupIconUrl] = useState("");
  const [newGroupKeywords, setNewGroupKeywords] = useState("");
  const [newGroupCategory, setNewGroupCategory] = useState<GroupCategory>("vtuber");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [newGroupParentId, setNewGroupParentId] = useState("");
  const [newGroupStatus, setNewGroupStatus] = useState("");

  // グループキーワード・アイコン編集
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editKeywords, setEditKeywords] = useState("");
  const [editGroupIconUrl, setEditGroupIconUrl] = useState("");
  const [editGroupColor, setEditGroupColor] = useState("");
  const [editGroupParentId, setEditGroupParentId] = useState("");
  const [keywordSaving, setKeywordSaving] = useState(false);

  // チャンネル追加 - 単件
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [addUrl, setAddUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [nameSearchPending, setNameSearchPending] = useState(false);
  const [candidates, setCandidates] = useState<SearchCandidate[] | null>(null);
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addStatus, setAddStatus] = useState("");

  // チャンネル追加 - 一括
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSearching, setBulkSearching] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);

  // チャンネル編集
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editLinkPreview, setEditLinkPreview] = useState<ChannelPreview | null>(null);
  const [editLinkSearching, setEditLinkSearching] = useState(false);
  const [editLinkError, setEditLinkError] = useState("");
  const [editLinkSaving, setEditLinkSaving] = useState(false);

  // チャンネルキーワード編集
  const [editChannelKeywords, setEditChannelKeywords] = useState("");
  const [channelKeywordSaving, setChannelKeywordSaving] = useState(false);

  // 新規追加時のキーワード
  const [addKeywords, setAddKeywords] = useState("");

  // チャンネル削除
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 要望・質問
  type FeedbackRow = { id: string; type: string; message: string; name: string | null; created_at: string };
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // チャンネルカラーピッカー
  const [colorPickerChannelId, setColorPickerChannelId] = useState<string | null>(null);

  const loadApiUsage = useCallback(async () => {
    const res = await fetch("/api/admin/api-usage").then((r) => r.json()).catch(() => null);
    if (res) setApiUsage(res);
  }, []);

  const handleTestKeys = useCallback(async () => {
    setTestKeysLoading(true);
    const res = await fetch("/api/admin/test-keys").then((r) => r.json()).catch(() => null);
    setTestKeysResult(res);
    setTestKeysLoading(false);
  }, []);

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    const res = await fetch("/api/feedback").then((r) => r.json()).catch(() => []);
    setFeedbackList(Array.isArray(res) ? res : []);
    setFeedbackLoading(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [gRes, cRes] = await Promise.all([
      fetch("/api/admin/groups").then((r) => r.json()),
      fetch("/api/admin/channels").then((r) => r.json()),
    ]);
    setGroups(Array.isArray(gRes) ? gRes : []);
    setChannels(Array.isArray(cRes) ? cRes : []);
    setLoading(false);
    loadApiUsage();
    loadFeedback();
  }, [loadApiUsage, loadFeedback]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (syncLogRef.current) {
      syncLogRef.current.scrollTop = syncLogRef.current.scrollHeight;
    }
  }, [syncLog]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setNewGroupStatus("作成中...");
    const res = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: autoId(newGroupName),
        name: newGroupName.trim(),
        icon_url: newGroupIconUrl.trim() || undefined,
        keywords: newGroupKeywords.trim() || undefined,
        category: newGroupCategory,
        color: newGroupColor,
        parent_group_id: newGroupParentId || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewGroupStatus("✓ 作成しました");
      setNewGroupName("");
      setNewGroupIconUrl("");
      setNewGroupKeywords("");
      setNewGroupCategory("vtuber");
      setNewGroupColor(GROUP_COLORS[0]);
      setNewGroupParentId("");
      setShowNewGroup(false);

      const gRes = await fetch("/api/admin/groups").then((r) => r.json());
      const updatedGroups: Group[] = Array.isArray(gRes) ? gRes : [];
      setGroups(updatedGroups);

      if (preview && !selectedGroupId) {
        const descLower = preview.description.toLowerCase();
        const matched = updatedGroups.find((g: Group) =>
          g.keywords?.split(",").map((k: string) => k.trim()).some((kw: string) => descLower.includes(kw.toLowerCase()))
        );
        if (matched) setSelectedGroupId(matched.id);
      }
    } else {
      setNewGroupStatus(`エラー: ${data.error}`);
    }
    setTimeout(() => setNewGroupStatus(""), 4000);
  }

  async function handleSaveKeywords(groupId: string) {
    setKeywordSaving(true);
    await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: groupId,
        keywords: editKeywords.trim() || null,
        icon_url: editGroupIconUrl.trim() || null,
        color: editGroupColor || null,
        parent_group_id: editGroupParentId || null,
      }),
    });
    setKeywordSaving(false);
    setEditingGroupId(null);
    await load();
  }

  async function handleMoveGroup(groupId: string, direction: "up" | "down") {
    const moving = groups.find((g) => g.id === groupId);
    if (!moving) return;

    // 同じ階層（同じ親）のグループのみを対象にする
    const sameLevel = groups.filter((g) => (g.parent_group_id ?? null) === (moving.parent_group_id ?? null));
    const idx = sameLevel.findIndex((g) => g.id === groupId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sameLevel.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;

    // 同階層内で配列上の実際の位置を特定してswap（画面に即反映）
    const groupsCopy = [...groups];
    const globalIdx = groupsCopy.findIndex((g) => g.id === sameLevel[idx].id);
    const globalSwapIdx = groupsCopy.findIndex((g) => g.id === sameLevel[swapIdx].id);
    [groupsCopy[globalIdx], groupsCopy[globalSwapIdx]] = [groupsCopy[globalSwapIdx], groupsCopy[globalIdx]];
    // sort_order も正規化して更新
    groupsCopy[globalIdx] = { ...groupsCopy[globalIdx], sort_order: idx + 1 };
    groupsCopy[globalSwapIdx] = { ...groupsCopy[globalSwapIdx], sort_order: swapIdx + 1 };
    setGroups(groupsCopy);

    await Promise.all([
      fetch("/api/admin/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: groupsCopy[globalIdx].id, sort_order: idx + 1 }),
      }),
      fetch("/api/admin/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: groupsCopy[globalSwapIdx].id, sort_order: swapIdx + 1 }),
      }),
    ]);
  }

  async function handleDeleteGroup(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch("/api/admin/groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function fetchPreview(url: string): Promise<{ preview?: ChannelPreview; candidates?: SearchCandidate[]; error?: string }> {
    const res = await fetch("/api/admin/channel-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "エラーが発生しました" };
    if (data.candidates) return { candidates: data.candidates as SearchCandidate[] };
    return { preview: data as ChannelPreview };
  }

  function looksLikeUrl(input: string): boolean {
    const t = input.trim();
    return t.startsWith("http") || t.startsWith("@") || /^UC[\w-]{20,}$/.test(t);
  }

  function looksLikeTwitchUrl(input: string): boolean {
    return input.trim().includes("twitch.tv/");
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!addUrl.trim()) return;
    setSearchError("");
    setPreview(null);
    setCandidates(null);
    setAddStatus("");

    if (!looksLikeUrl(addUrl) && !looksLikeTwitchUrl(addUrl)) {
      setNameSearchPending(true);
      return;
    }

    setSearching(true);
    const result = await fetchPreview(addUrl.trim());
    setSearching(false);

    if (result.error) {
      setSearchError(result.error);
    } else if (result.preview) {
      setPreview(result.preview);
      setSelectedGroupId(result.preview.existingGroupId ?? result.preview.detectedGroupId ?? "");
    }
  }

  async function handleNameSearch() {
    setNameSearchPending(false);
    setSearching(true);
    const result = await fetchPreview(addUrl.trim());
    setSearching(false);
    if (result.error) {
      setSearchError(result.error);
    } else if (result.candidates) {
      setCandidates(result.candidates);
    } else if (result.preview) {
      setPreview(result.preview);
      setSelectedGroupId(result.preview.existingGroupId ?? result.preview.detectedGroupId ?? "");
    }
  }

  async function handleSelectCandidate(channelId: string) {
    setSearching(true);
    setCandidates(null);
    const result = await fetchPreview(channelId);
    setSearching(false);
    if (result.error) {
      setSearchError(result.error);
    } else if (result.preview) {
      setPreview(result.preview);
      setSelectedGroupId(result.preview.existingGroupId ?? result.preview.detectedGroupId ?? "");
    }
  }

  async function handleBulkSearch() {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20);
    if (!lines.length) return;
    const nameLines = lines.filter((l) => !looksLikeUrl(l) && !looksLikeTwitchUrl(l));
    if (nameLines.length > 0) {
      const cost = nameLines.length * 100;
      if (!confirm(`${nameLines.length}件が名前検索になります（Search API: ${cost}ユニット消費）。続けますか？\n\n該当:\n${nameLines.join("\n")}`)) return;
    }
    setBulkSearching(true);
    setBulkRows(lines.map((input, i) => ({ id: i, input, status: "loading", selectedGroupId: "", keywords: "", include: true })));

    const results = await Promise.all(
      lines.map(async (input, i): Promise<BulkRow> => {
        const result = await fetchPreview(input);
        if (result.error) {
          return { id: i, input, status: "error", error: result.error, selectedGroupId: "", keywords: "", include: false };
        }
        if (result.candidates) {
          if (result.candidates.length === 0) {
            return { id: i, input, status: "error", error: "見つかりません", selectedGroupId: "", keywords: "", include: false };
          }
          const c = result.candidates[0];
          return {
            id: i, input, status: "found",
            preview: { channelId: c.channelId, name: c.name, iconUrl: c.iconUrl, description: c.description, detectedGroupId: null, alreadyExists: false, existingGroupId: null },
            selectedGroupId: "",
            keywords: "",
            include: true,
            platform: "youtube",
          };
        }
        const p = result.preview!;
        return { id: i, input, status: "found", preview: p, selectedGroupId: p.existingGroupId ?? p.detectedGroupId ?? "", keywords: "", include: true, platform: p.platform ?? "youtube" };
      })
    );

    setBulkRows(results);
    setBulkSearching(false);
  }

  async function handleBulkAdd() {
    setBulkAdding(true);
    const toAdd = bulkRows.filter((r) => r.include && r.status === "found" && r.preview);
    for (const row of toAdd) {
      setBulkRows((prev) => prev.map((r) => r.id === row.id ? { ...r, addStatus: "adding" } : r));
      const p = row.preview!;
      let ok = false;
      let errMsg = "";
      if (p.alreadyExists) {
        const patchBody: Record<string, unknown> = { channelId: p.channelId, groupId: row.selectedGroupId || null };
        if (row.keywords.trim()) patchBody.keywords = row.keywords.trim();
        const res = await fetch("/api/admin/channels", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        const data = await res.json();
        ok = res.ok;
        if (!ok) errMsg = data.error ?? "エラー";
      } else {
        const crawlUrl = (row.platform === "twitch" || p.platform === "twitch")
          ? (row.input.startsWith("http") ? row.input.trim() : `https://www.twitch.tv/${p.channelId}`)
          : `https://www.youtube.com/channel/${p.channelId}`;
        const res = await fetch("/api/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: crawlUrl, groupId: row.selectedGroupId || undefined, ...(row.keywords.trim() ? { keywords: row.keywords.trim() } : {}) }),
        });
        const data = await res.json();
        ok = res.ok;
        if (!ok) errMsg = data.error ?? "エラー";
      }
      setBulkRows((prev) => prev.map((r) => r.id === row.id ? { ...r, addStatus: ok ? "added" : "failed", addError: ok ? undefined : errMsg } : r));
    }
    setBulkAdding(false);
    await load();
  }

  async function handleAdd() {
    if (!preview) return;
    setAdding(true);
    setAddStatus(preview.alreadyExists ? "更新中..." : "登録中...");

    let ok = false;
    let errMsg = "";

    if (preview.alreadyExists) {
      const res = await fetch("/api/admin/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: preview.channelId,
          groupId: selectedGroupId || null,
          ...(addKeywords.trim() ? { keywords: addKeywords.trim() } : {}),
        }),
      });
      const data = await res.json();
      ok = res.ok;
      if (!res.ok) errMsg = data.error ?? "エラー";
    } else {
      const isTwitch = preview.platform === "twitch";
      // Twitch は数値IDではなく元のURL（loginを含む）を使う
      const crawlUrl = isTwitch
        ? addUrl.trim()
        : `https://www.youtube.com/channel/${preview.channelId}`;
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl, groupId: selectedGroupId || undefined }),
      });
      const data = await res.json();
      ok = res.ok;
      if (!res.ok) errMsg = data.error ?? "エラー";
      if (ok && addKeywords.trim()) {
        const targetChannelId = data.channelId ?? preview.channelId;
        await fetch("/api/admin/channels", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: targetChannelId, keywords: addKeywords.trim() }),
        });
      }
    }

    setAdding(false);
    if (ok) {
      setAddStatus("✓ 完了しました");
      setAddUrl("");
      setPreview(null);
      setSelectedGroupId("");
      setAddKeywords("");
      await load();
    } else {
      setAddStatus(`エラー: ${errMsg}`);
    }
    setTimeout(() => setAddStatus(""), 4000);
  }

  async function handleChannelColor(channelId: string, color: string | null) {
    setChannels((prev) =>
      prev.map((c) => c.channel_id === channelId ? { ...c, color } : c)
    );
    setColorPickerChannelId(null);
    await fetch("/api/admin/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, color }),
    });
  }

  async function handleChannelGroup(channelId: string, groupId: string) {
    await fetch("/api/admin/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, groupId: groupId || null }),
    });
    setChannels((prev) =>
      prev.map((c) => c.channel_id === channelId ? { ...c, group_id: groupId || null } : c)
    );
  }

  async function handleDeleteChannel(channelId: string) {
    setDeleting(true);
    const res = await fetch("/api/admin/channels", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
    setDeleting(false);
    setDeleteConfirmId(null);
    if (res.ok) {
      setChannels((prev) => prev.filter((c) => c.channel_id !== channelId));
    }
  }

  async function handleEditLinkSearch() {
    if (!editLinkUrl.trim()) return;
    setEditLinkSearching(true);
    setEditLinkPreview(null);
    setEditLinkError("");
    const result = await fetchPreview(editLinkUrl.trim());
    setEditLinkSearching(false);
    if (result.error) {
      setEditLinkError(result.error);
    } else if (result.preview) {
      setEditLinkPreview(result.preview);
    } else if (result.candidates) {
      setEditLinkError("チャンネルを特定できませんでした。URLで入力してください。");
    }
  }

  async function handleSaveLink(channelId: string) {
    if (!editLinkPreview) return;
    setEditLinkSaving(true);

    let linkedChannelId = editLinkPreview.channelId;

    // まだ登録されていない場合は先に登録
    if (!editLinkPreview.alreadyExists) {
      const isTwitch = editLinkPreview.platform === "twitch";
      // Twitch は数値IDではなくユーザーが入力した元のURL（loginを含む）を使う
      const crawlUrl = isTwitch
        ? editLinkUrl.trim()
        : `https://www.youtube.com/channel/${editLinkPreview.channelId}`;

      // 登録中のチャンネルと同じグループを付与
      const baseChannel = channels.find((c) => c.channel_id === channelId);
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl, groupId: baseChannel?.group_id || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditLinkError(data.error ?? "登録に失敗しました");
        setEditLinkSaving(false);
        return;
      }
      const data = await res.json();
      linkedChannelId = data.channelId ?? editLinkPreview.channelId;
    }

    // 双方向リンク
    const res = await fetch("/api/admin/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, linkedChannelId }),
    });

    setEditLinkSaving(false);
    if (res.ok) {
      setEditingChannelId(null);
      setEditLinkUrl("");
      setEditLinkPreview(null);
      await load();
    } else {
      const data = await res.json();
      setEditLinkError(data.error ?? "保存に失敗しました");
    }
  }

  async function handleUnlink(channelId: string) {
    await fetch("/api/admin/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, linkedChannelId: null }),
    });
    await load();
  }

  async function handleSaveChannelKeywords(channelId: string) {
    setChannelKeywordSaving(true);
    await fetch("/api/admin/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, keywords: editChannelKeywords.trim() || null }),
    });
    setChannelKeywordSaving(false);
    setChannels((prev) =>
      prev.map((c) => c.channel_id === channelId ? { ...c, keywords: editChannelKeywords.trim() || null } : c)
    );
  }

  async function handleFindLive() {
    setFindLiveStatus("スキャン中...");
    setFindLiveResults(null);
    setFindLiveLog([]);
    setFindLiveUnits(null);

    const res = await fetch("/api/admin/find-live/stream", { method: "POST" });
    if (!res.ok || !res.body) {
      setFindLiveStatus("エラー: ストリーム接続失敗");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() ?? "";
      for (const chunk of lines) {
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const ev = JSON.parse(dataLine.slice(6));
          if (ev.type === "done") {
            const units = ev.apiUnits ?? 0;
            const calls = ev.apiCalls ?? 0;
            setFindLiveUnits({ calls, units });
            setFindLiveStatus(`✓ ${ev.found ?? 0}件がライブ中 (${units}ユニット消費)`);
            setFindLiveResults(ev.lives ?? []);
            setFindLiveLog((prev) => [...prev, `完了: ${ev.found ?? 0}件ライブ中 / YouTube API ${calls}回 ${units}ユニット消費`]);
          } else if (ev.type === "error") {
            setFindLiveLog((prev) => [...prev, `❌ ${ev.message}`]);
          } else if (ev.type === "info" || ev.type === "phase") {
            setFindLiveLog((prev) => [...prev, `ℹ ${ev.message}`]);
          } else if (ev.type === "rss") {
            setFindLiveLog((prev) => [...prev, `RSS ${ev.channel}: ${ev.count}件`]);
          } else if (ev.type === "rss_error") {
            setFindLiveLog((prev) => [...prev, `RSS取得失敗: ${ev.channel}`]);
          } else if (ev.type === "live_known") {
            setFindLiveLog((prev) => [...prev, `● ${ev.channel} — ${ev.title}`]);
          } else if (ev.type === "live_new") {
            setFindLiveLog((prev) => [...prev, `🆕 ${ev.channel} — ${ev.title}`]);
          } else if (ev.type === "no_live") {
            setFindLiveLog((prev) => [...prev, ev.message]);
          } else if (ev.type === "twitch_offline") {
            setFindLiveLog((prev) => [...prev, `○ ${ev.channel} — オフライン`]);
          } else if (ev.type === "twitch_ended") {
            setFindLiveLog((prev) => [...prev, `⬛ ${ev.channel} — ライブ終了`]);
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }

  async function handleSyncChannels() {
    setSyncStatus("更新中...");
    setSyncLog([]);

    const res = await fetch("/api/admin/sync-channels", { method: "POST" });
    if (!res.ok || !res.body) {
      setSyncStatus("エラー: ストリーム接続失敗");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() ?? "";
      for (const chunk of lines) {
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const ev = JSON.parse(dataLine.slice(6));
          if (ev.type === "done") {
            setSyncStatus(`✓ ${ev.message}`);
            setSyncLog((prev) => [...prev, `── ${ev.message} ──`]);
          } else if (ev.type === "error") {
            setSyncLog((prev) => [...prev, `❌ ${ev.message}`]);
          } else if (ev.type === "phase") {
            setSyncLog((prev) => [...prev, `▶ ${ev.message}`]);
          } else if (ev.type === "info") {
            setSyncLog((prev) => [...prev, `ℹ ${ev.message}`]);
          } else if (ev.type === "channel") {
            setSyncLog((prev) => [...prev, ev.message]);
          }
        } catch { /* ignore parse errors */ }
      }
    }
    setTimeout(() => setSyncStatus(""), 8000);
  }

  async function handleReclassify() {
    setReclassifyStatus("分類中...");
    const res = await fetch("/api/admin/reclassify", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setReclassifyStatus(`✓ ${data.total}件中 ${data.matched + data.indie}件を分類しました`);
    } else {
      setReclassifyStatus(`エラー: ${data.error}`);
    }
    setTimeout(() => setReclassifyStatus(""), 8000);
    await load();
  }

  async function handlePollVideos() {
    setPollStatus("検索中...");
    const res = await fetch("/api/poll/videos", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setPollStatus(`✓ 完了: ${data.discovered ?? 0}件の新規動画、${data.started ?? 0}件のライブ開始を検知`);
    } else {
      setPollStatus(`エラー: ${data.error}`);
    }
    setTimeout(() => setPollStatus(""), 5000);
  }

  if (loading) {
    return <div className="py-20 text-center text-gray-500">読み込み中...</div>;
  }

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));

  // 連携ペアを除いたプライマリチャンネルを計算
  const linkedToIds = new Set(
    channels.filter((c) => c.linked_channel_id).map((c) => c.linked_channel_id as string)
  );
  const shownAsLinked = new Set<string>();
  for (const ch of channels) {
    if (!ch.linked_channel_id) continue;
    const isYt = !ch.platform || ch.platform === "youtube";
    const isChPointedTo = linkedToIds.has(ch.channel_id);
    if (!isChPointedTo || isYt) shownAsLinked.add(ch.linked_channel_id);
  }
  const primaryChannels = channels.filter((c) => !shownAsLinked.has(c.channel_id));
  const ytCount = channels.filter((c) => !c.platform || c.platform === "youtube").length;
  const twitchCount = channels.filter((c) => c.platform === "twitch").length;

  const deleteTarget = deleteConfirmId ? channelMap.get(deleteConfirmId) : null;

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <button
          onClick={handleLogout}
          className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-red-300 hover:text-red-500"
        >
          ログアウト
        </button>
      </div>
      {/* カラーピッカー背面クリックで閉じる */}
      {colorPickerChannelId && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setColorPickerChannelId(null)}
        />
      )}

      {/* 削除確認モーダル */}
      {deleteConfirmId && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-gray-900">チャンネルを削除</h3>
            <p className="mb-1 text-sm text-gray-600">
              <span className="font-medium">{deleteTarget.name}</span> を削除しますか？
            </p>
            <p className="mb-5 text-xs text-red-500">
              関連する動画・スパチャ・グラフデータもすべて削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteChannel(deleteConfirmId)}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40"
              >
                {deleting ? "削除中..." : "削除する"}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <AdminHeader
        apiUsage={apiUsage}
        testKeysResult={testKeysResult}
        testKeysLoading={testKeysLoading}
        pollStatus={pollStatus}
        findLiveStatus={findLiveStatus}
        reclassifyStatus={reclassifyStatus}
        syncStatus={syncStatus}
        onRefreshUsage={loadApiUsage}
        onTestKeys={handleTestKeys}
        onPollVideos={handlePollVideos}
        onFindLive={handleFindLive}
        onReclassify={handleReclassify}
        onSyncChannels={handleSyncChannels}
      />

      {/* チャンネル情報更新ログ */}
      {syncLog.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-gray-950 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">チャンネル情報更新ログ</span>
            <button onClick={() => setSyncLog([])} className="text-xs text-gray-500 hover:text-gray-300">クリア</button>
          </div>
          <div
            ref={syncLogRef}
            className="max-h-56 overflow-y-auto space-y-0.5 font-mono scroll-smooth"
          >
            {syncLog.map((line, i) => (
              <p
                key={i}
                className={`text-xs leading-relaxed ${
                  line.startsWith("❌") ? "text-red-400"
                  : line.startsWith("▶") ? "text-cyan-400 font-semibold"
                  : line.startsWith("ℹ") ? "text-gray-400"
                  : line.startsWith("──") ? "text-gray-500"
                  : "text-green-400"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ライブ確認ログ */}
      {findLiveLog.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-gray-950 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">スキャンログ</span>
            <button onClick={() => setFindLiveLog([])} className="text-xs text-gray-500 hover:text-gray-300">クリア</button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono">
            {findLiveLog.map((line, i) => (
              <p key={i} className="text-xs text-green-400 leading-relaxed">{line}</p>
            ))}
          </div>
        </section>
      )}

      {/* ライブ確認結果 */}
      {findLiveResults !== null && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-red-700">
                {findLiveResults.length === 0 ? "現在ライブ中のチャンネルはありません" : `ライブ中 ${findLiveResults.length}件`}
              </h2>
              {findLiveUnits && findLiveUnits.units > 0 && (
                <p className="text-xs text-red-400">YouTube API: {findLiveUnits.calls}回 / {findLiveUnits.units}ユニット消費</p>
              )}
            </div>
            <button onClick={() => { setFindLiveResults(null); setFindLiveLog([]); setFindLiveUnits(null); }} className="text-xs text-red-400 hover:text-red-600">閉じる</button>
          </div>
          {findLiveResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {findLiveResults.map((v) => {
                const href = v.platform === "twitch" && v.url
                  ? v.url
                  : `https://www.youtube.com/watch?v=${v.videoId}`;
                const dotColor = v.platform === "twitch" ? "bg-purple-500" : "bg-red-500";
                return (
                  <a
                    key={v.videoId}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-red-200 bg-white px-4 py-2.5 hover:bg-red-50 transition-colors"
                  >
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotColor} animate-pulse`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{v.channelName}</p>
                      <p className="truncate text-xs text-gray-400">{v.title}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-red-400">↗</span>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* グループ管理 */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">グループ管理</h2>
            <p className="text-xs text-gray-400">キーワードが概要欄に含まれると自動でそのグループに分類されます。複数ある場合はカンマ区切り（例: Crazy Raccoon,CrazyRaccoon,CR）</p>
          </div>
          <button
            onClick={() => { setShowNewGroup((v) => !v); setNewGroupStatus(""); }}
            className="flex-shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
          >
            {showNewGroup ? "キャンセル" : "+ 新規作成"}
          </button>
        </div>

        {showNewGroup && (
          <form onSubmit={handleCreateGroup} className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              {newGroupParentId ? (
                <>
                  <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[11px] font-bold text-violet-700">サブグループ</span>
                  <span className="text-xs text-violet-700 font-medium">
                    {groups.find(g => g.id === newGroupParentId)?.name ?? ""}
                    <span className="mx-1 text-violet-400">›</span>
                    {newGroupName || <span className="text-violet-400">（グループ名）</span>}
                  </span>
                </>
              ) : (
                <p className="text-xs font-semibold text-violet-700">新しいグループ</p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {/* 親グループ: 先頭に配置 */}
              <div className="rounded-lg border border-violet-100 bg-white px-3 py-2.5">
                <label className="mb-1 block text-xs font-medium text-violet-700">サブグループにする場合：親グループを選択</label>
                <select
                  value={newGroupParentId}
                  onChange={(e) => setNewGroupParentId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none"
                >
                  <option value="">なし（トップレベルグループ）</option>
                  {groups.filter(g => !g.parent_group_id).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">グループ名 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={newGroupParentId ? "1期生" : "Crazy Raccoon"}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">アイコン画像URL（任意）</label>
                <div className="flex items-center gap-2">
                  {newGroupIconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={newGroupIconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                  )}
                  <input
                    type="url"
                    value={newGroupIconUrl}
                    onChange={(e) => setNewGroupIconUrl(e.target.value)}
                    placeholder="https://example.com/icon.png"
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">キーワード（カンマ区切りで複数指定可）</label>
                <input
                  type="text"
                  value={newGroupKeywords}
                  onChange={(e) => setNewGroupKeywords(e.target.value)}
                  placeholder="Crazy Raccoon,CrazyRaccoon,CR,クレイジーラクーン"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">カテゴリ</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["vtuber", "esports", "indie", "other"] as GroupCategory[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewGroupCategory(cat)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${newGroupCategory === cat ? "bg-violet-600 text-white" : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300"}`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">カラー</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewGroupColor(c)}
                        className={`h-6 w-6 rounded-full transition-transform ${newGroupColor === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label className="flex cursor-pointer items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 hover:border-gray-400">
                      <input
                        type="color"
                        value={newGroupColor}
                        onChange={(e) => setNewGroupColor(e.target.value)}
                        className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      自由
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  作成
                </button>
                {newGroupStatus && <span className="text-sm text-gray-500">{newGroupStatus}</span>}
              </div>
            </div>
          </form>
        )}

        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">グループがありません。「+ 新規作成」で追加してください。</p>
        ) : (() => {
          const topLevelGroups = groups.filter(g => !g.parent_group_id);
          const childrenByParent = new Map<string, Group[]>();
          for (const g of groups) {
            if (g.parent_group_id) {
              const arr = childrenByParent.get(g.parent_group_id) ?? [];
              arr.push(g);
              childrenByParent.set(g.parent_group_id, arr);
            }
          }

          function GroupRow({ g, siblings, isChild }: { g: Group; siblings: Group[]; isChild: boolean }) {
            const idx = siblings.indexOf(g);
            return (
              <div className={`rounded-lg border px-4 py-3 ${isChild ? "border-violet-100 bg-violet-50/50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveGroup(g.id, "up")}
                      disabled={idx === 0}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"
                    >▲</button>
                    <button
                      onClick={() => handleMoveGroup(g.id, "down")}
                      disabled={idx === siblings.length - 1}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"
                    >▼</button>
                  </div>
                  {isChild && <span className="text-gray-300 text-xs">└</span>}
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="flex-1 text-sm font-medium text-gray-900">{g.name}</span>
                  {isChild && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-500">サブ</span>}
                  <span className="text-xs text-gray-400">{g.category ? CATEGORY_LABELS[g.category] : ""}</span>
                  {editingGroupId !== g.id && (
                    <button
                      onClick={() => { setEditingGroupId(g.id); setEditKeywords(g.keywords ?? ""); setEditGroupIconUrl(g.icon_url ?? ""); setEditGroupColor(g.color ?? ""); setEditGroupParentId(g.parent_group_id ?? ""); }}
                      className="text-xs text-violet-500 hover:underline"
                    >
                      編集
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteGroup(g.id, g.name)}
                    className="text-xs text-gray-300 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
                {editingGroupId === g.id ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {GROUP_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditGroupColor(c)}
                          className={`h-6 w-6 rounded-full transition-transform ${editGroupColor === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <label className="flex cursor-pointer items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 hover:border-gray-400">
                        <input
                          type="color"
                          value={editGroupColor || "#8b5cf6"}
                          onChange={(e) => setEditGroupColor(e.target.value)}
                          className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        自由
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {editGroupIconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={editGroupIconUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                      )}
                      <input
                        type="url"
                        value={editGroupIconUrl}
                        onChange={(e) => setEditGroupIconUrl(e.target.value)}
                        placeholder="アイコン画像URL"
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        placeholder="キーワード1,キーワード2,略称"
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="shrink-0 text-[10px] text-gray-400">親グループ</label>
                      <select
                        value={editGroupParentId}
                        onChange={(e) => setEditGroupParentId(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-violet-500 focus:outline-none"
                      >
                        <option value="">なし</option>
                        {groups.filter(pg => !pg.parent_group_id && pg.id !== g.id).map(pg => (
                          <option key={pg.id} value={pg.id}>{pg.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveKeywords(g.id)}
                        disabled={keywordSaving}
                        className="flex-shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                      >
                        {keywordSaving ? "保存中..." : "保存"}
                      </button>
                      <button
                        onClick={() => setEditingGroupId(null)}
                        className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 pl-5 flex items-center gap-2">
                    {g.icon_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.icon_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                    )}
                    {g.keywords && <p className="text-xs text-gray-400">{g.keywords}</p>}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-2">
              {topLevelGroups.map((g) => {
                const children = childrenByParent.get(g.id) ?? [];
                return (
                  <div key={g.id}>
                    {GroupRow({ g, siblings: topLevelGroups, isChild: false })}
                    {children.length > 0 && (
                      <div className="ml-6 mt-1 flex flex-col gap-1 border-l-2 border-violet-100 pl-3">
                        {children.map((child) => (
                          <div key={child.id}>
                            {GroupRow({ g: child, siblings: children, isChild: true })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* チャンネル追加 */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">チャンネル追加</h2>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => { setAddMode("single"); setBulkRows([]); setBulkText(""); }}
              className={`px-3 py-1.5 transition-colors ${addMode === "single" ? "bg-violet-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              単件
            </button>
            <button
              onClick={() => { setAddMode("bulk"); setPreview(null); setCandidates(null); setSearchError(""); }}
              className={`px-3 py-1.5 transition-colors ${addMode === "bulk" ? "bg-violet-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              一括
            </button>
          </div>
        </div>

        {addMode === "single" ? (
          <>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={addUrl}
                onChange={(e) => { setAddUrl(e.target.value); setPreview(null); setCandidates(null); setSearchError(""); }}
                placeholder="YouTube URL / @ハンドル / twitch.tv/... / チャンネル名"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!addUrl.trim() || searching}
                className="flex-shrink-0 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40"
              >
                {searching ? "検索中..." : "検索"}
              </button>
            </form>

            {searchError && <p className="mt-2 text-sm text-red-500">{searchError}</p>}

            {nameSearchPending && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="text-xs text-amber-700">「{addUrl}」を名前検索します。YouTube Search APIを使用するため <strong>100ユニット</strong> 消費します。</span>
                <button
                  onClick={handleNameSearch}
                  className="flex-shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-400"
                >
                  検索する
                </button>
                <button
                  onClick={() => setNameSearchPending(false)}
                  className="flex-shrink-0 text-xs text-amber-500 hover:text-amber-700"
                >
                  キャンセル
                </button>
              </div>
            )}

            {candidates && candidates.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400">「{addUrl}」の検索結果 — 追加するチャンネルを選択</p>
                {candidates.map((c) => (
                  <button
                    key={c.channelId}
                    onClick={() => handleSelectCandidate(c.channelId)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50"
                  >
                    {c.iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.iconUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="truncate text-xs text-gray-400">{c.description}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-violet-500">選択 →</span>
                  </button>
                ))}
              </div>
            )}
            {candidates && candidates.length === 0 && (
              <p className="mt-2 text-sm text-gray-400">チャンネルが見つかりませんでした。</p>
            )}

            {preview && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                {preview.alreadyExists && (
                  <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600">
                    このチャンネルはすでに登録済みです。グループのみ更新できます。
                  </p>
                )}
                <div className="mb-4 flex items-center gap-3">
                  {preview.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.iconUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{preview.name}</p>
                      <PlatformBadge platform={preview.platform} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{preview.description}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-xs text-gray-500">
                    グループ
                    {preview.detectedGroupId && selectedGroupId === preview.detectedGroupId && (
                      <span className="ml-2 text-violet-500">（概要欄から自動検出）</span>
                    )}
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">未分類</option>
                    {groups.filter(g => !g.parent_group_id).map((pg) => {
                      const children = groups.filter(g => g.parent_group_id === pg.id);
                      return children.length > 0 ? (
                        <optgroup key={pg.id} label={pg.name}>
                          {children.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </optgroup>
                      ) : (
                        <option key={pg.id} value={pg.id}>{pg.name}</option>
                      );
                    })}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-xs text-gray-500">
                    検索キーワード
                    <span className="ml-1 text-gray-400">（カンマ区切りで複数指定可、任意）</span>
                  </label>
                  <input
                    type="text"
                    value={addKeywords}
                    onChange={(e) => setAddKeywords(e.target.value)}
                    placeholder="別名,英語名,略称"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                  >
                    {adding ? "処理中..." : preview.alreadyExists ? "グループを更新" : "登録"}
                  </button>
                  <button
                    onClick={() => { setPreview(null); setSearchError(""); setAddKeywords(""); }}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    キャンセル
                  </button>
                  {addStatus && <span className="text-sm text-gray-500">{addStatus}</span>}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mb-2 text-xs text-gray-400">1行に1つ（URL・動画URL・@ハンドル・チャンネル名）最大20件</p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"https://www.youtube.com/@hololive\nhttps://www.twitch.tv/ramuneshiranami\nhttps://www.youtube.com/watch?v=xxxx\nにじさんじ"}
              rows={6}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none resize-none font-mono"
            />
            <button
              onClick={handleBulkSearch}
              disabled={!bulkText.trim() || bulkSearching}
              className="mt-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40"
            >
              {bulkSearching ? "検索中..." : "一括検索"}
            </button>

            {bulkRows.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {bulkRows.map((row) => (
                    <div key={row.id} className={row.status === "error" ? "bg-red-50" : "bg-white"}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={row.status !== "found"}
                          onChange={(e) => setBulkRows((prev) => prev.map((r) => r.id === row.id ? { ...r, include: e.target.checked } : r))}
                          className="h-4 w-4 flex-shrink-0 accent-violet-600"
                        />
                        {row.status === "loading" && (
                          <span className="text-xs text-gray-400 animate-pulse">検索中... {row.input}</span>
                        )}
                        {row.status === "error" && (
                          <>
                            <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{row.input}</span>
                            <span className="text-xs text-red-500">{row.error}</span>
                          </>
                        )}
                        {row.status === "found" && row.preview && (
                          <>
                            {row.preview.iconUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={row.preview.iconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-sm font-medium text-gray-900">{row.preview.name}</p>
                                <PlatformBadge platform={row.platform ?? row.preview.platform} />
                              </div>
                              <p className="text-xs text-gray-400">{row.preview.alreadyExists ? "登録済" : "新規"}</p>
                            </div>
                            <select
                              value={row.selectedGroupId}
                              onChange={(e) => setBulkRows((prev) => prev.map((r) => r.id === row.id ? { ...r, selectedGroupId: e.target.value } : r))}
                              className="flex-shrink-0 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 focus:border-violet-400 focus:outline-none"
                            >
                              <option value="">未分類</option>
                              {groups.filter(g => !g.parent_group_id).map((pg) => {
                                const children = groups.filter(g => g.parent_group_id === pg.id);
                                return children.length > 0 ? (
                                  <optgroup key={pg.id} label={pg.name}>
                                    {children.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                  </optgroup>
                                ) : (
                                  <option key={pg.id} value={pg.id}>{pg.name}</option>
                                );
                              })}
                            </select>
                            {row.addStatus === "adding" && <span className="text-xs text-gray-400">登録中...</span>}
                            {row.addStatus === "added" && <span className="text-xs text-green-600">✓</span>}
                            {row.addStatus === "failed" && <span className="text-xs text-red-500" title={row.addError}>✕</span>}
                          </>
                        )}
                      </div>
                      {row.status === "found" && !row.addStatus && (
                        <div className="flex items-center gap-1.5 border-t border-gray-50 px-3 py-1.5">
                          <span className="shrink-0 text-[10px] text-gray-400">キーワード</span>
                          <input
                            type="text"
                            value={row.keywords}
                            onChange={(e) => setBulkRows((prev) => prev.map((r) => r.id === row.id ? { ...r, keywords: e.target.value } : r))}
                            placeholder="別名,英語名,略称（任意）"
                            className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700 placeholder-gray-300 focus:border-violet-400 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {bulkRows.some((r) => r.include && r.status === "found") && (
                  <button
                    onClick={handleBulkAdd}
                    disabled={bulkAdding}
                    className="mt-3 rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                  >
                    {bulkAdding ? "登録中..." : `チェック済みを登録 (${bulkRows.filter((r) => r.include && r.status === "found").length}件)`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* 登録チャンネル一覧 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          登録チャンネル
          <span className="ml-2 font-normal text-gray-400">({primaryChannels.length}件)</span>
          <span className="ml-3 text-xs font-normal text-gray-400">
            YouTube {ytCount}件 / Twitch {twitchCount}件
          </span>
        </h2>
        {channels.length === 0 ? (
          <p className="text-xs text-gray-500">チャンネルがありません</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {primaryChannels.map((ch) => {
              const g = ch.group_id ? groupMap.get(ch.group_id) : undefined;
              const linked = ch.linked_channel_id ? channelMap.get(ch.linked_channel_id) : undefined;
              const isEditing = editingChannelId === ch.channel_id;

              return (
                <div key={ch.channel_id}>
                  {/* メイン行 */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
                    {/* アイコン */}
                    {ch.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ch.icon_url} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <div
                        className="h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: ch.color ?? g?.color ?? "#9ca3af" }}
                      >
                        {ch.name[0]}
                      </div>
                    )}

                    {/* カラーピッカー */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setColorPickerChannelId(
                          colorPickerChannelId === ch.channel_id ? null : ch.channel_id
                        )}
                        className="h-4 w-4 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200 transition-transform hover:scale-110"
                        style={{ backgroundColor: ch.color ?? g?.color ?? "#e5e7eb" }}
                        title="チャンネルカラー"
                      />
                      {colorPickerChannelId === ch.channel_id && (
                        <div className="absolute left-0 top-6 z-30 w-44 rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl">
                          <p className="mb-1.5 text-[10px] font-semibold text-gray-400">チャンネルカラー</p>
                          <div className="grid grid-cols-6 gap-1">
                            {CHANNEL_COLORS.map((c) => (
                              <button
                                key={c}
                                onClick={() => handleChannelColor(ch.channel_id, c)}
                                className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${ch.color === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "border-gray-200"}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                            <label className="col-span-2 flex cursor-pointer items-center gap-1 rounded border border-gray-200 px-1 text-[10px] text-gray-500 hover:border-gray-400">
                              <input
                                type="color"
                                value={ch.color ?? "#6b7280"}
                                onChange={(e) => handleChannelColor(ch.channel_id, e.target.value)}
                                className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                              />
                              自由
                            </label>
                          </div>
                          <button
                            onClick={() => handleChannelColor(ch.channel_id, null)}
                            className="mt-1.5 w-full rounded text-[10px] text-gray-400 hover:text-gray-600"
                          >
                            リセット
                          </button>
                        </div>
                      )}
                    </div>

                    {/* グループドット */}
                    {g && (
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                    )}

                    {/* 名前・プラットフォーム */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium text-gray-800">{ch.name}</p>
                        <PlatformBadge platform={ch.platform} />
                        {linked && (
                          <span className="truncate text-[10px] text-gray-400">
                            ⟷ {linked.name}
                            <PlatformBadge platform={linked.platform} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* グループ変更 */}
                    <select
                      value={ch.group_id ?? ""}
                      onChange={(e) => handleChannelGroup(ch.channel_id, e.target.value)}
                      className="basis-full sm:basis-auto flex-shrink-0 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 focus:border-violet-400 focus:outline-none"
                    >
                      <option value="">未分類</option>
                      {groups.filter(g => !g.parent_group_id).map((pg) => {
                        const children = groups.filter(g => g.parent_group_id === pg.id);
                        return children.length > 0 ? (
                          <optgroup key={pg.id} label={pg.name}>
                            {children.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </optgroup>
                        ) : (
                          <option key={pg.id} value={pg.id}>{pg.name}</option>
                        );
                      })}
                    </select>

                    {/* 編集・削除 */}
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingChannelId(null);
                          setEditLinkUrl("");
                          setEditLinkPreview(null);
                          setEditLinkError("");
                        } else {
                          setEditingChannelId(ch.channel_id);
                          setEditLinkUrl("");
                          setEditLinkPreview(null);
                          setEditLinkError("");
                          setEditChannelKeywords(ch.keywords ?? "");
                        }
                      }}
                      className={`flex-shrink-0 rounded px-2 py-0.5 text-xs transition-colors ${isEditing ? "bg-gray-100 text-gray-600" : "text-violet-500 hover:text-violet-700"}`}
                    >
                      {isEditing ? "閉じる" : "編集"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(ch.channel_id)}
                      className="flex-shrink-0 rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 border border-gray-200 hover:border-red-200"
                      title="削除"
                    >
                      削除
                    </button>
                  </div>

                  {/* 編集パネル */}
                  {isEditing && (() => {
                    // YouTube側・Twitch側を正規化して常に同じ順で表示
                    const ytCh = ch.platform === "twitch" ? linked : ch;
                    const twCh = ch.platform === "twitch" ? ch : linked;

                    function ChannelCard({ c, label, showUnlink }: { c: ChannelRow | undefined; label: string; showUnlink: boolean }) {
                      if (!c) {
                        return (
                          <div className="flex-1">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-400">{label}</p>
                            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs text-gray-400">
                              未設定
                            </div>
                          </div>
                        );
                      }
                      const isYt = !c.platform || c.platform === "youtube";
                      const externalUrl = isYt
                        ? (c.custom_url ? `https://www.youtube.com/${c.custom_url}` : `https://www.youtube.com/channel/${c.channel_id}`)
                        : `https://www.twitch.tv/${c.custom_url}`;
                      return (
                        <div className="flex-1">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-400">{label}</p>
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 space-y-2">
                            <div className="flex items-center gap-2">
                              {c.icon_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={c.icon_url} alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                              ) : (
                                <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                                  {c.name[0]}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-900">{c.name}</p>
                                {c.custom_url && (
                                  <p className="truncate text-[11px] text-gray-400">
                                    {isYt ? c.custom_url : `twitch.tv/${c.custom_url}`}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <a
                                href={`/channel/${c.channel_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 rounded border border-gray-200 py-1 text-center text-[10px] text-gray-500 hover:border-violet-300 hover:text-violet-600"
                              >
                                チャンネルページ ↗
                              </a>
                              <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-1 rounded border py-1 text-center text-[10px] ${isYt ? "border-red-200 text-red-500 hover:bg-red-50" : "border-purple-200 text-purple-500 hover:bg-purple-50"}`}
                              >
                                {isYt ? "YouTube ↗" : "Twitch ↗"}
                              </a>
                            </div>
                            {showUnlink && (
                              <button
                                onClick={() => handleUnlink(ch.channel_id)}
                                className="w-full rounded border border-red-200 py-1 text-center text-[10px] text-red-400 hover:bg-red-50 hover:text-red-600"
                              >
                                この連携を解除
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="mb-2 ml-0 sm:ml-9 rounded-xl border border-violet-100 bg-violet-50 p-3 space-y-3">
                        {/* キーワード編集 */}
                        <div>
                          <p className="mb-1 text-xs text-gray-500">
                            検索キーワード
                            <span className="ml-1 text-gray-400">（カンマ区切りで複数指定可、検索バーで使用）</span>
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editChannelKeywords}
                              onChange={(e) => setEditChannelKeywords(e.target.value)}
                              placeholder="別名,英語名,略称"
                              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveChannelKeywords(ch.channel_id); } }}
                            />
                            <button
                              onClick={() => handleSaveChannelKeywords(ch.channel_id)}
                              disabled={channelKeywordSaving}
                              className="flex-shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                            >
                              {channelKeywordSaving ? "保存中..." : "保存"}
                            </button>
                          </div>
                          {ch.keywords && (
                            <p className="mt-1 text-[10px] text-gray-400">現在: {ch.keywords}</p>
                          )}
                        </div>

                        {/* YouTube / Twitch カード */}
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                          <ChannelCard c={ytCh} label="YouTube" showUnlink={!!linked} />
                          <div className="flex items-center justify-center sm:pt-7">
                            <span className="text-gray-300 text-sm">⟷</span>
                          </div>
                          <ChannelCard c={twCh} label="Twitch" showUnlink={!!linked} />
                        </div>

                        {/* 紐付け入力 */}
                        <div>
                          <p className="mb-1.5 text-xs text-gray-500">
                            {ch.platform === "twitch" ? "YouTube URL または @ハンドル" : "Twitch URL"} で{linked ? "変更" : "紐付け"}
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editLinkUrl}
                              onChange={(e) => { setEditLinkUrl(e.target.value); setEditLinkPreview(null); setEditLinkError(""); }}
                              placeholder={ch.platform === "twitch" ? "https://www.youtube.com/@..." : "https://www.twitch.tv/..."}
                              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEditLinkSearch(); } }}
                            />
                            <button
                              onClick={handleEditLinkSearch}
                              disabled={!editLinkUrl.trim() || editLinkSearching}
                              className="flex-shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                            >
                              {editLinkSearching ? "検索中..." : "検索"}
                            </button>
                          </div>

                          {editLinkError && <p className="mt-1.5 text-xs text-red-500">{editLinkError}</p>}

                          {editLinkPreview && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2">
                              {editLinkPreview.iconUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={editLinkPreview.iconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-semibold text-gray-900">{editLinkPreview.name}</p>
                                  <PlatformBadge platform={editLinkPreview.platform} />
                                </div>
                                {!editLinkPreview.alreadyExists && (
                                  <p className="text-[10px] text-amber-500">未登録 — 紐付け時に自動登録されます</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleSaveLink(ch.channel_id)}
                                disabled={editLinkSaving}
                                className="flex-shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                              >
                                {editLinkSaving ? "保存中..." : linked ? "変更して紐付け" : "紐付け"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 要望・質問 */}
      <AdminFeedbackSection
        feedbackList={feedbackList}
        feedbackLoading={feedbackLoading}
        onRefresh={loadFeedback}
        onDelete={async (id) => {
          await fetch("/api/feedback", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
          setFeedbackList((prev) => prev.filter((f) => f.id !== id));
        }}
      />

    </div>
  );
}
