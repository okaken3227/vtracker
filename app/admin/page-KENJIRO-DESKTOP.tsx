"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Group, GroupCategory } from "@/lib/types";

type ChannelRow = {
  channel_id: string;
  name: string;
  group_id: string | null;
  color: string | null;
  platform?: string;
  linked_channel_id?: string | null;
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
  include: boolean;
  addStatus?: "adding" | "added" | "failed";
  addError?: string;
};

const GROUP_COLORS = [
  "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981",
  "#ef4444", "#ec4899", "#3b82f6", "#84cc16",
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

export default function AdminPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollStatus, setPollStatus] = useState("");
  const [findLiveStatus, setFindLiveStatus] = useState("");
  const [findLiveResults, setFindLiveResults] = useState<{ videoId: string; channelId: string; channelName: string; title: string; platform?: string; url?: string }[] | null>(null);
  const [findLiveLogs, setFindLiveLogs] = useState<{ id: number; type: string; text: string }[]>([]);
  const [findLiveStreaming, setFindLiveStreaming] = useState(false);
  const [reclassifyStatus, setReclassifyStatus] = useState("");
  const [channelsPollStatus, setChannelsPollStatus] = useState("");
  const [pollingChannelId, setPollingChannelId] = useState<string | null>(null);
  const [colorPickerChannelId, setColorPickerChannelId] = useState<string | null>(null);
  const [apiUsage, setApiUsage] = useState<{ unitsUsed: number; callsCount: number; quotaLimit: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // グループ作成
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupKeywords, setNewGroupKeywords] = useState("");
  const [newGroupCategory, setNewGroupCategory] = useState<GroupCategory>("vtuber");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [newGroupIconUrl, setNewGroupIconUrl] = useState("");
  const [newGroupSlug, setNewGroupSlug] = useState("");
  const [newGroupStatus, setNewGroupStatus] = useState("");

  // グループ編集
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editKeywords, setEditKeywords] = useState("");
  const [editIconUrl, setEditIconUrl] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editColor, setEditColor] = useState(GROUP_COLORS[0]);
  const [groupSaving, setGroupSaving] = useState(false);

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

  // 別プラットフォーム連携
  const [linkedUrl, setLinkedUrl] = useState("");
  const [linkedPreview, setLinkedPreview] = useState<ChannelPreview | null>(null);
  const [linkedSearching, setLinkedSearching] = useState(false);

  // チャンネル編集・削除
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // チャンネル追加 - 一括
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSearching, setBulkSearching] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [findLiveLogs]);

  const loadApiUsage = useCallback(async () => {
    const res = await fetch("/api/admin/api-usage").then((r) => r.json()).catch(() => null);
    if (res) setApiUsage(res);
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
  }, [loadApiUsage]);

  useEffect(() => { load(); }, [load]);

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
        keywords: newGroupKeywords.trim() || undefined,
        category: newGroupCategory,
        color: newGroupColor,
        icon_url: newGroupIconUrl.trim() || undefined,
        slug: newGroupSlug.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewGroupStatus("✓ 作成しました");
      setNewGroupName("");
      setNewGroupKeywords("");
      setNewGroupCategory("vtuber");
      setNewGroupColor(GROUP_COLORS[0]);
      setNewGroupIconUrl("");
      setNewGroupSlug("");
      setShowNewGroup(false);

      // グループを再取得
      const gRes = await fetch("/api/admin/groups").then((r) => r.json());
      const updatedGroups: Group[] = Array.isArray(gRes) ? gRes : [];
      setGroups(updatedGroups);

      // プレビューが表示中かつ未分類なら再検出
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

  async function handleSaveGroup(groupId: string) {
    setGroupSaving(true);
    await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: groupId,
        keywords: editKeywords.trim() || null,
        icon_url: editIconUrl.trim() || null,
        slug: editSlug.trim() || null,
        color: editColor || null,
      }),
    });
    setGroupSaving(false);
    setEditingGroupId(null);
    await load();
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

  function looksLikeYoutubeRef(input: string): boolean {
    const t = input.trim();
    return t.startsWith("http") || t.startsWith("@") || /^UC[\w-]{20,}$/.test(t);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!addUrl.trim()) return;
    setSearchError("");
    setPreview(null);
    setCandidates(null);
    setAddStatus("");

    // URL/ハンドル/ID 以外は名前検索（100ユニット）なので確認を挟む
    if (!looksLikeYoutubeRef(addUrl)) {
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

  async function handleLinkedSearch() {
    if (!linkedUrl.trim()) return;
    setLinkedSearching(true);
    setLinkedPreview(null);
    const result = await fetchPreview(linkedUrl.trim());
    setLinkedSearching(false);
    if (result.preview) setLinkedPreview(result.preview);
  }

  async function handleDeleteChannel(channelId: string) {
    setDeletingId(channelId);
    await fetch("/api/admin/channels", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
    setDeletingId(null);
    setDeleteConfirmId(null);
    await load();
  }

  async function handleSetLinkedChannel(channelId: string, linkedChannelId: string | null) {
    await fetch("/api/admin/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, linkedChannelId: linkedChannelId ?? "" }),
    });
    setChannels((prev) =>
      prev.map((c) => c.channel_id === channelId ? { ...c, linked_channel_id: linkedChannelId } : c)
    );
    setEditingChannelId(null);
    await load();
  }

  async function handleBulkSearch() {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20);
    if (!lines.length) return;
    const nameLines = lines.filter((l) => !looksLikeYoutubeRef(l));
    if (nameLines.length > 0) {
      const cost = nameLines.length * 100;
      if (!confirm(`${nameLines.length}件が名前検索になります（Search API: ${cost}ユニット消費）。続けますか？\n\n該当:\n${nameLines.join("\n")}`)) return;
    }
    setBulkSearching(true);
    setBulkRows(lines.map((input, i) => ({ id: i, input, status: "loading", selectedGroupId: "", include: true })));

    const results = await Promise.all(
      lines.map(async (input, i): Promise<BulkRow> => {
        const result = await fetchPreview(input);
        if (result.error) {
          return { id: i, input, status: "error", error: result.error, selectedGroupId: "", include: false };
        }
        if (result.candidates) {
          if (result.candidates.length === 0) {
            return { id: i, input, status: "error", error: "見つかりません", selectedGroupId: "", include: false };
          }
          const c = result.candidates[0];
          return {
            id: i, input, status: "found",
            preview: { channelId: c.channelId, name: c.name, iconUrl: c.iconUrl, description: c.description, detectedGroupId: null, alreadyExists: false, existingGroupId: null },
            selectedGroupId: "",
            include: true,
          };
        }
        const p = result.preview!;
        return { id: i, input, status: "found", preview: p, selectedGroupId: p.existingGroupId ?? p.detectedGroupId ?? "", include: true };
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
        const res = await fetch("/api/admin/channels", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: p.channelId, groupId: row.selectedGroupId || null }),
        });
        const data = await res.json();
        ok = res.ok;
        if (!ok) errMsg = data.error ?? "エラー";
      } else {
        const res = await fetch("/api/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: `https://www.youtube.com/channel/${p.channelId}`, groupId: row.selectedGroupId || undefined }),
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

    let mainChannelId: string | null = preview.channelId;
    let ok = false;
    let errMsg = "";

    if (preview.alreadyExists) {
      const res = await fetch("/api/admin/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: preview.channelId, groupId: selectedGroupId || null }),
      });
      const data = await res.json();
      ok = res.ok;
      if (!res.ok) errMsg = data.error ?? "エラー";
    } else {
      const crawlUrl = preview.platform === "twitch"
        ? addUrl.trim()
        : `https://www.youtube.com/channel/${preview.channelId}`;
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl, groupId: selectedGroupId || undefined }),
      });
      const data = await res.json();
      ok = res.ok;
      mainChannelId = data.channelId ?? preview.channelId;
      if (!res.ok) errMsg = data.error ?? "エラー";
    }

    // 別プラットフォームチャンネルも登録して紐付け
    let linkedChannelId: string | null = null;
    if (ok && linkedPreview && mainChannelId) {
      if (linkedPreview.alreadyExists) {
        linkedChannelId = linkedPreview.channelId;
      } else {
        const crawlUrl = linkedPreview.platform === "twitch"
          ? linkedUrl.trim()
          : `https://www.youtube.com/channel/${linkedPreview.channelId}`;
        const res = await fetch("/api/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: crawlUrl, groupId: selectedGroupId || undefined }),
        });
        const data = await res.json();
        if (res.ok) linkedChannelId = data.channelId ?? linkedPreview.channelId;
      }

      if (linkedChannelId) {
        await fetch("/api/admin/channels", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: mainChannelId, linkedChannelId }),
        });
      }
    }

    setAdding(false);
    if (ok) {
      setAddStatus(linkedChannelId ? "✓ 両方のチャンネルを登録・連携しました" : "✓ 完了しました");
      setAddUrl("");
      setPreview(null);
      setSelectedGroupId("");
      setLinkedUrl("");
      setLinkedPreview(null);
      await load();
    } else {
      setAddStatus(`エラー: ${errMsg}`);
    }
    setTimeout(() => setAddStatus(""), 4000);
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

  async function handleChannelColor(channelId: string, color: string) {
    setChannels((prev) =>
      prev.map((c) => c.channel_id === channelId ? { ...c, color } : c)
    );
    await fetch("/api/admin/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, color }),
    });
  }

  async function handleFindLive() {
    setFindLiveStatus("スキャン中...");
    setFindLiveResults(null);
    setFindLiveLogs([]);
    setFindLiveStreaming(true);

    let logId = 0;
    const addLog = (type: string, text: string) =>
      setFindLiveLogs((prev) => [...prev, { id: logId++, type, text }]);

    try {
      const res = await fetch("/api/admin/find-live/stream", { method: "POST" });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const data = JSON.parse(line.slice(6));
            switch (data.type) {
              case "info":      addLog("info", data.message); break;
              case "phase":     addLog("phase", data.message); break;
              case "rss":       addLog("rss", `${data.channel}を確認  ${data.count}件の動画`); break;
              case "rss_error": addLog("rss_error", `${data.channel}  取得失敗`); break;
              case "api_batch": addLog("api", `API確認中  バッチ ${data.batch}/${data.total}  (${data.count}件)`); break;
              case "live_known": addLog("live", `LIVE中  ${data.channel}`); break;
              case "live_new":   addLog("live_new", `LIVE発見！  ${data.channel}  —  ${data.title}`); break;
              case "no_live":    addLog("no_live", data.message); break;
              case "error":      addLog("error", data.message); break;
              case "done":
                addLog("done", `ライブ確認終了  ${data.found > 0 ? `${data.found}件のLIVEを検出` : "ライブなし"}`);
                if (data.apiCalls > 0) {
                  addLog("api_stat", `API ${data.apiCalls}回  ${data.apiUnits}ユニット消費`);
                }
                setFindLiveStatus(`✓ ${data.found}件がライブ中`);
                setFindLiveResults(data.lives ?? []);
                loadApiUsage();
                break;
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      addLog("error", String(err));
      setFindLiveStatus("エラーが発生しました");
    } finally {
      setFindLiveStreaming(false);
    }
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

  async function handlePollAllChannels() {
    setChannelsPollStatus("取得中...");
    const res = await fetch("/api/poll/channels", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setChannelsPollStatus(`✓ ${data.updated}件更新しました`);
      await load();
    } else {
      setChannelsPollStatus(`エラー: ${data.error}`);
    }
    setTimeout(() => setChannelsPollStatus(""), 5000);
  }

  async function handlePollChannel(channelId: string) {
    setPollingChannelId(channelId);
    const res = await fetch("/api/poll/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
    setPollingChannelId(null);
    if (res.ok) await load();
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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
          <p className="text-sm text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const usageRatio = apiUsage ? apiUsage.unitsUsed / apiUsage.quotaLimit : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">

      {/* ページヘッダー */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">管理</h1>
          {apiUsage && (
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-2 w-40 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${usageRatio > 0.8 ? "bg-red-500" : usageRatio > 0.5 ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, usageRatio * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-gray-500">
                {apiUsage.unitsUsed.toLocaleString()}<span className="text-gray-300"> / </span>{apiUsage.quotaLimit.toLocaleString()}
                <span className="ml-1.5 text-gray-400">units</span>
              </span>
              <button onClick={loadApiUsage} className="text-gray-300 transition-colors hover:text-violet-500">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* アクションボタン群 */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={handlePollVideos} color="cyan" label="RSS動画を検索" />
            <ActionButton onClick={handleFindLive} color="red" label="ライブ確認" />
            <ActionButton onClick={handleReclassify} color="amber" label="未分類を再分類" />
            <ActionButton onClick={handlePollAllChannels} disabled={!!channelsPollStatus} color="green"
              label={channelsPollStatus || "登録者数を一括取得"} />
            <button
              onClick={() => setShowHelp((v) => !v)}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-400 transition-all hover:border-gray-300 hover:text-gray-600"
            >
              {showHelp ? "閉じる" : "仕組み?"}
            </button>
          </div>
          {(pollStatus || findLiveStatus || reclassifyStatus) && (
            <p className="text-xs text-gray-400">{reclassifyStatus || pollStatus || findLiveStatus}</p>
          )}
          {showHelp && (
            <div className="mt-1 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-5 text-xs text-gray-600 shadow-sm">
              {[
                { color: "text-gray-700", title: "↻ 今すぐ更新（ヘッダー）", api: "/api/poll/live", body: "ライブ中動画の同時視聴者数・スパチャを取得。5秒ごとに自動実行中。" },
                { color: "text-cyan-700", title: "RSS動画を検索", api: "/api/poll/videos", body: "全チャンネルのRSSとplaylistItemsから新着ライブ・配信予定を検出してDBに登録。" },
                { color: "text-red-700", title: "ライブ確認", api: "/api/admin/find-live", body: "RSS動画を検索と同じ処理をして、ライブ中の動画を画面に一覧表示する。" },
                { color: "text-amber-700", title: "未分類を再分類", api: "/api/admin/reclassify", body: "group_id = null のチャンネルをキーワードで自動分類。マッチしなければ個人勢グループに入れる。" },
              ].map((item) => (
                <div key={item.api}>
                  <p className={`mb-1 font-semibold ${item.color}`}>{item.title}</p>
                  <p className="mb-0.5 font-mono text-[10px] text-gray-400">{item.api}</p>
                  <p className="text-gray-500">{item.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ライブ確認結果 */}
      {findLiveResults !== null && (
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-red-50 to-white ring-1 ring-red-100">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <h2 className="text-sm font-semibold text-red-700">
                {findLiveResults.length === 0 ? "ライブ中のチャンネルはありません" : `ライブ中 ${findLiveResults.length}件`}
              </h2>
            </div>
            <button onClick={() => setFindLiveResults(null)} className="text-xs text-red-300 transition-colors hover:text-red-500">閉じる</button>
          </div>
          {findLiveResults.length > 0 && (
            <div className="flex flex-col divide-y divide-red-100">
              {findLiveResults.map((v) => (
                <a key={v.videoId}
                  href={v.url ?? `https://www.youtube.com/watch?v=${v.videoId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white/60 px-5 py-3 transition-colors hover:bg-red-50/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-gray-900">{v.channelName}</p>
                      {v.platform === "twitch" && (
                        <span className="flex-shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Twitch</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-400">{v.title}</p>
                  </div>
                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-red-300" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ライブ確認ログ */}
      {findLiveLogs.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-gray-950 shadow-sm ring-1 ring-white/10">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-medium text-gray-400">ライブ確認ログ</span>
              {findLiveStreaming && (
                <span className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  スキャン中
                </span>
              )}
            </div>
            <button onClick={() => setFindLiveLogs([])} className="rounded-full p-1 text-gray-600 transition-colors hover:text-gray-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div ref={logRef} className="max-h-72 overflow-y-auto p-3 font-mono text-xs">
            {findLiveLogs.map((entry) => (
              <LiveLogLine key={entry.id} type={entry.type} text={entry.text} />
            ))}
            {findLiveStreaming && (
              <div className="mt-0.5 flex items-center gap-2 text-gray-600">
                <span className="animate-pulse">▸</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* グループ管理 */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">グループ管理</h2>
            <p className="mt-0.5 text-xs text-gray-400">キーワードが概要欄に含まれると自動分類されます</p>
          </div>
          <button
            onClick={() => { setShowNewGroup((v) => !v); setNewGroupStatus(""); }}
            className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-violet-500"
          >
            {showNewGroup ? "キャンセル" : "+ 新規作成"}
          </button>
        </div>

        {showNewGroup && (
          <form onSubmit={handleCreateGroup} className="mx-6 mb-5 rounded-xl bg-violet-50 p-4 ring-1 ring-violet-100">
            <p className="mb-3 text-xs font-semibold text-violet-700">新しいグループ</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">グループ名 <span className="text-red-400">*</span></label>
                <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Crazy Raccoon" required
                  className="w-full rounded-xl border-0 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-300 shadow-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">キーワード（カンマ区切り）</label>
                <input type="text" value={newGroupKeywords} onChange={(e) => setNewGroupKeywords(e.target.value)}
                  placeholder="Crazy Raccoon,CrazyRaccoon,CR"
                  className="w-full rounded-xl border-0 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-300 shadow-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">アイコンURL</label>
                  <div className="flex items-center gap-2">
                    {newGroupIconUrl && <img src={newGroupIconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />}
                    <input type="url" value={newGroupIconUrl} onChange={(e) => setNewGroupIconUrl(e.target.value)} placeholder="https://..."
                      className="min-w-0 flex-1 rounded-xl border-0 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-300 shadow-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">スラッグ</label>
                  <input type="text" value={newGroupSlug} onChange={(e) => setNewGroupSlug(e.target.value)} placeholder="nijisanji"
                    className="w-full rounded-xl border-0 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-300 shadow-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">カテゴリ</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["vtuber", "esports", "indie", "other"] as GroupCategory[]).map((cat) => (
                      <button key={cat} type="button" onClick={() => setNewGroupCategory(cat)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${newGroupCategory === cat ? "bg-violet-600 text-white shadow-sm" : "bg-white text-gray-500 ring-1 ring-gray-200 hover:ring-violet-300"}`}>
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">カラー</label>
                  <div className="flex flex-wrap gap-1.5">
                    {GROUP_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setNewGroupColor(c)}
                        className={`h-6 w-6 rounded-full transition-transform ${newGroupColor === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : "hover:scale-110"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-500">作成</button>
                {newGroupStatus && <span className="text-xs text-gray-500">{newGroupStatus}</span>}
              </div>
            </div>
          </form>
        )}

        {groups.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-gray-400">グループがありません。「+ 新規作成」で追加してください。</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {groups.map((g) => (
              <div key={g.id} className="px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.icon_url && <img src={g.icon_url} alt={g.name} className="h-6 w-6 flex-shrink-0 rounded-full object-cover" />}
                  <span className="flex-1 text-sm font-medium text-gray-900">{g.name}</span>
                  {g.category && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{CATEGORY_LABELS[g.category]}</span>
                  )}
                  {editingGroupId !== g.id && (
                    <button onClick={() => { setEditingGroupId(g.id); setEditKeywords(g.keywords ?? ""); setEditIconUrl(g.icon_url ?? ""); setEditSlug(g.slug ?? ""); setEditColor(g.color ?? GROUP_COLORS[0]); }}
                      className="rounded-full px-3 py-1 text-xs font-medium text-violet-500 transition-colors hover:bg-violet-50">
                      編集
                    </button>
                  )}
                  <button onClick={() => handleDeleteGroup(g.id, g.name)}
                    className="rounded-full p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </div>
                {editingGroupId === g.id ? (
                  <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-gray-50 p-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">アイコンURL</label>
                      <div className="flex items-center gap-2">
                        {editIconUrl && <img src={editIconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />}
                        <input type="url" value={editIconUrl} onChange={(e) => setEditIconUrl(e.target.value)} placeholder="https://..."
                          className="min-w-0 flex-1 rounded-lg border-0 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-300 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">スラッグ</label>
                      <input type="text" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} placeholder="nijisanji"
                        className="w-full rounded-lg border-0 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-300 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">カラー</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {GROUP_COLORS.map((c) => (
                          <button key={c} type="button" onClick={() => setEditColor(c)}
                            className={`h-6 w-6 rounded-full transition-transform ${editColor === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : "hover:scale-110"}`}
                            style={{ backgroundColor: c }} />
                        ))}
                        <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)}
                          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" title="カスタムカラー" />
                        <span className="font-mono text-[10px] text-gray-400">{editColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">キーワード（カンマ区切り）</label>
                      <input autoFocus type="text" value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} placeholder="キーワード1,キーワード2"
                        className="w-full rounded-lg border-0 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-300 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSaveGroup(g.id)} disabled={groupSaving}
                        className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-violet-500 disabled:opacity-40">
                        {groupSaving ? "保存中..." : "保存"}
                      </button>
                      <button onClick={() => setEditingGroupId(null)} className="text-xs text-gray-400 hover:text-gray-600">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-3 pl-4">
                    {g.slug && <span className="font-mono text-[10px] text-violet-400">/{g.slug}</span>}
                    {g.keywords && <span className="text-[10px] text-gray-400">{g.keywords}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* チャンネル追加 */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-base font-semibold text-gray-900">チャンネル追加</h2>
          <div className="flex overflow-hidden rounded-full bg-gray-100 p-0.5 text-xs font-medium">
            <button onClick={() => { setAddMode("single"); setBulkRows([]); setBulkText(""); }}
              className={`rounded-full px-3.5 py-1.5 transition-all ${addMode === "single" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              単件
            </button>
            <button onClick={() => { setAddMode("bulk"); setPreview(null); setCandidates(null); setSearchError(""); }}
              className={`rounded-full px-3.5 py-1.5 transition-all ${addMode === "bulk" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              一括
            </button>
          </div>
        </div>

        <div className="px-6 pb-6">
          {addMode === "single" ? (
            <>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input type="text" value={addUrl}
                  onChange={(e) => { setAddUrl(e.target.value); setPreview(null); setCandidates(null); setSearchError(""); }}
                  placeholder="URL・@ハンドル・動画URL・チャンネル名"
                  className="min-w-0 flex-1 rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <button type="submit" disabled={!addUrl.trim() || searching}
                  className="flex-shrink-0 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-500 disabled:opacity-40">
                  {searching ? "検索中..." : "検索"}
                </button>
              </form>

              {searchError && <p className="mt-2 text-sm text-red-500">{searchError}</p>}

              {nameSearchPending && (
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                  <span className="flex-1 text-xs text-amber-700">「{addUrl}」の名前検索 — <strong>100ユニット</strong> 消費します</span>
                  <button onClick={handleNameSearch} className="flex-shrink-0 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-400">検索する</button>
                  <button onClick={() => setNameSearchPending(false)} className="flex-shrink-0 text-xs text-amber-400 hover:text-amber-600">キャンセル</button>
                </div>
              )}

              {candidates && candidates.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-gray-400">「{addUrl}」の検索結果</p>
                  {candidates.map((c) => (
                    <button key={c.channelId} onClick={() => handleSelectCandidate(c.channelId)}
                      className="flex w-full items-center gap-3 rounded-xl bg-gray-50 p-3 text-left ring-1 ring-gray-100 transition-all hover:bg-violet-50 hover:ring-violet-200">
                      {c.iconUrl && <img src={c.iconUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        <p className="truncate text-xs text-gray-400">{c.description}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs text-violet-400">選択 →</span>
                    </button>
                  ))}
                </div>
              )}
              {candidates && candidates.length === 0 && <p className="mt-2 text-sm text-gray-400">チャンネルが見つかりませんでした。</p>}

              {preview && (
                <div className="mt-4 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
                  {preview.alreadyExists && (
                    <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600 ring-1 ring-amber-100">
                      すでに登録済みです。グループのみ更新できます（YouTube API不使用）。
                    </p>
                  )}
                  <div className="mb-4 flex items-center gap-3">
                    {preview.iconUrl && <img src={preview.iconUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover shadow-sm" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{preview.name}</p>
                        {preview.platform === "twitch" && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">Twitch</span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{preview.description}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs text-gray-500">
                      グループ
                      {preview.detectedGroupId && selectedGroupId === preview.detectedGroupId && (
                        <span className="ml-2 text-violet-400">（自動検出）</span>
                      )}
                    </label>
                    <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full rounded-xl border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400">
                      <option value="">未分類</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  {/* 別プラットフォームも一緒に登録 */}
                  {!preview.alreadyExists && (
                    <div className="mb-4 border-t border-gray-100 pt-4">
                      <p className="mb-2 text-xs font-medium text-gray-500">
                        {preview.platform === "twitch" ? "YouTube チャンネルも一緒に登録（任意）" : "Twitch も一緒に登録（任意）"}
                      </p>
                      {linkedPreview ? (
                        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-200">
                          {linkedPreview.iconUrl && <img src={linkedPreview.iconUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />}
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-800">{linkedPreview.name}</span>
                            {linkedPreview.platform === "twitch" && (
                              <span className="ml-2 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Twitch</span>
                            )}
                            {linkedPreview.alreadyExists && (
                              <span className="ml-2 text-[10px] text-amber-500">登録済み — 紐付けのみ</span>
                            )}
                          </div>
                          <button onClick={() => { setLinkedPreview(null); setLinkedUrl(""); }} className="text-xs text-gray-300 hover:text-red-400">✕</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={linkedUrl}
                            onChange={(e) => { setLinkedUrl(e.target.value); }}
                            placeholder={preview.platform === "twitch" ? "https://www.youtube.com/..." : "https://www.twitch.tv/..."}
                            className="min-w-0 flex-1 rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-gray-200 focus:outline-none focus:ring-violet-400"
                          />
                          <button
                            onClick={handleLinkedSearch}
                            disabled={!linkedUrl.trim() || linkedSearching}
                            className="flex-shrink-0 rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-gray-700"
                          >
                            {linkedSearching ? "..." : "検索"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button onClick={handleAdd} disabled={adding}
                      className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-500 disabled:opacity-40">
                      {adding ? "処理中..." : preview.alreadyExists ? "グループを更新" : linkedPreview ? "両方を登録・連携" : "登録"}
                    </button>
                    <button onClick={() => { setPreview(null); setSearchError(""); setLinkedUrl(""); setLinkedPreview(null); }} className="text-sm text-gray-400 hover:text-gray-600">キャンセル</button>
                    {addStatus && <span className="text-xs text-gray-500">{addStatus}</span>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-400">1行に1つ（URL・@ハンドル・チャンネル名）最大20件</p>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                placeholder={"https://www.youtube.com/@hololive\nhttps://www.youtube.com/watch?v=xxxx\nにじさんじ"}
                rows={6}
                className="w-full resize-none rounded-xl border-0 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-300 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
              <button onClick={handleBulkSearch} disabled={!bulkText.trim() || bulkSearching}
                className="mt-2 rounded-full bg-gray-800 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-700 disabled:opacity-40">
                {bulkSearching ? "検索中..." : "一括検索"}
              </button>

              {bulkRows.length > 0 && (
                <div className="mt-4">
                  <div className="overflow-hidden rounded-xl ring-1 ring-gray-100">
                    {bulkRows.map((row) => (
                      <div key={row.id} className={`flex items-center gap-3 px-4 py-2.5 ${row.status === "error" ? "bg-red-50" : "bg-white"} border-b border-gray-50 last:border-0`}>
                        <input type="checkbox" checked={row.include} disabled={row.status !== "found"}
                          onChange={(e) => setBulkRows((prev) => prev.map((r) => r.id === row.id ? { ...r, include: e.target.checked } : r))}
                          className="h-4 w-4 flex-shrink-0 accent-violet-600" />
                        {row.status === "loading" && <span className="animate-pulse text-xs text-gray-400">検索中... {row.input}</span>}
                        {row.status === "error" && (
                          <>
                            <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{row.input}</span>
                            <span className="text-xs text-red-400">{row.error}</span>
                          </>
                        )}
                        {row.status === "found" && row.preview && (
                          <>
                            {row.preview.iconUrl && <img src={row.preview.iconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-900">{row.preview.name}</p>
                              <p className="text-[10px] text-gray-400">{row.preview.alreadyExists ? "登録済" : "新規"}</p>
                            </div>
                            <select value={row.selectedGroupId}
                              onChange={(e) => setBulkRows((prev) => prev.map((r) => r.id === row.id ? { ...r, selectedGroupId: e.target.value } : r))}
                              className="flex-shrink-0 rounded-lg border-0 bg-gray-50 px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-200 focus:outline-none focus:ring-violet-400">
                              <option value="">未分類</option>
                              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            {row.addStatus === "adding" && <span className="text-xs text-gray-400">登録中...</span>}
                            {row.addStatus === "added" && <span className="text-xs text-emerald-500">✓</span>}
                            {row.addStatus === "failed" && <span className="text-xs text-red-400" title={row.addError}>✕</span>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {bulkRows.some((r) => r.include && r.status === "found") && (
                    <button onClick={handleBulkAdd} disabled={bulkAdding}
                      className="mt-3 rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-500 disabled:opacity-40">
                      {bulkAdding ? "登録中..." : `チェック済みを登録 (${bulkRows.filter((r) => r.include && r.status === "found").length}件)`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 登録チャンネル一覧 */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="px-6 py-5">
          <h2 className="text-base font-semibold text-gray-900">
            登録チャンネル
            <span className="ml-2 text-sm font-normal text-gray-400">{channels.length}件</span>
          </h2>
        </div>
        {channels.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-gray-400">チャンネルがありません</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {channels.map((ch) => {
              const g = ch.group_id ? groupMap.get(ch.group_id) : undefined;
              const isPolling = pollingChannelId === ch.channel_id;
              const isEditing = editingChannelId === ch.channel_id;
              const linkedCh = ch.linked_channel_id ? channels.find((c) => c.channel_id === ch.linked_channel_id) : undefined;
              return (
                <div key={ch.channel_id}>
                  <div className="flex items-center gap-3 px-6 py-2.5 transition-colors hover:bg-gray-50/50">
                    <button
                      onClick={() => setColorPickerChannelId(ch.channel_id)}
                      title="チャンネルカラーを変更"
                      className={`h-4 w-4 flex-shrink-0 rounded-full ring-offset-1 transition-all hover:scale-125 ${colorPickerChannelId === ch.channel_id ? "ring-2 ring-violet-400 scale-125" : "ring-1 ring-gray-300"}`}
                      style={{ backgroundColor: ch.color ?? g?.color ?? "#e5e7eb" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-800">{ch.name}</p>
                      <div className="flex items-center gap-1.5">
                        {ch.platform === "twitch" ? (
                          <span className="text-[10px] font-medium text-purple-500">Twitch</span>
                        ) : (
                          <span className="text-[10px] font-medium text-red-400">YouTube</span>
                        )}
                        {linkedCh && (
                          <span className="text-[10px] text-gray-400">
                            → {linkedCh.name}
                            <span className={`ml-1 ${linkedCh.platform === "twitch" ? "text-purple-400" : "text-red-300"}`}>
                              ({linkedCh.platform === "twitch" ? "Twitch" : "YouTube"})
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <select value={ch.group_id ?? ""} onChange={(e) => handleChannelGroup(ch.channel_id, e.target.value)}
                      className="flex-shrink-0 rounded-lg border-0 bg-gray-50 px-2 py-1 text-xs text-gray-600 ring-1 ring-gray-200 focus:outline-none focus:ring-violet-400">
                      <option value="">未分類</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button onClick={() => handlePollChannel(ch.channel_id)} disabled={isPolling || !!pollingChannelId}
                      title="登録者数を今すぐ取得"
                      className={`flex-shrink-0 rounded-full p-1.5 transition-colors ${isPolling ? "animate-spin text-emerald-500" : "text-gray-300 hover:bg-gray-100 hover:text-emerald-500"} disabled:opacity-30`}>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                    </button>
                    {/* 編集ボタン */}
                    <button
                      onClick={() => setEditingChannelId(isEditing ? null : ch.channel_id)}
                      title="チャンネルを編集"
                      className={`flex-shrink-0 rounded-full p-1.5 transition-colors ${isEditing ? "bg-violet-100 text-violet-600" : "text-gray-300 hover:bg-gray-100 hover:text-violet-500"}`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                    </button>
                    {/* 削除ボタン */}
                    <button
                      onClick={() => setDeleteConfirmId(ch.channel_id)}
                      title="チャンネルを削除"
                      className="flex-shrink-0 rounded-full p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </button>
                  </div>

                  {/* インライン編集パネル */}
                  {isEditing && (
                    <div className="mx-6 mb-3 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
                      <p className="mb-2 text-xs font-medium text-gray-500">別プラットフォームと連携</p>
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={ch.linked_channel_id ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleSetLinkedChannel(ch.channel_id, val || null);
                          }}
                          className="flex-1 rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-800 ring-1 ring-gray-200 focus:outline-none focus:ring-violet-400"
                        >
                          <option value="">連携なし</option>
                          {channels
                            .filter((c) => c.channel_id !== ch.channel_id && c.platform !== ch.platform)
                            .map((c) => (
                              <option key={c.channel_id} value={c.channel_id}>
                                {c.name} ({c.platform === "twitch" ? "Twitch" : "YouTube"})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => setEditingChannelId(null)}
                          className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600"
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      {/* チャンネル削除 確認ダイアログ */}
      {deleteConfirmId && (() => {
        const ch = channels.find((c) => c.channel_id === deleteConfirmId);
        if (!ch) return null;
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={() => setDeleteConfirmId(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-80 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                      <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{ch.name}</p>
                      <p className="text-xs text-gray-400">を削除しますか？</p>
                    </div>
                  </div>
                  <p className="mb-5 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-600">
                    このチャンネルに紐づく動画・グラフデータ・スパチャも<strong>すべて削除</strong>されます。この操作は取り消せません。
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteChannel(ch.channel_id)}
                      disabled={deletingId === ch.channel_id}
                      className="flex-1 rounded-full bg-red-500 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      {deletingId === ch.channel_id ? "削除中..." : "削除する"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 rounded-full border border-gray-200 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* チャンネルカラー モーダル */}
      {colorPickerChannelId && (() => {
        const ch = channels.find((c) => c.channel_id === colorPickerChannelId);
        if (!ch) return null;
        const g = ch.group_id ? groupMap.get(ch.group_id) : undefined;
        const currentColor = ch.color ?? g?.color ?? "#8b5cf6";
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={() => setColorPickerChannelId(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-72 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100" onClick={(e) => e.stopPropagation()}>
                {/* ヘッダー */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="h-5 w-5 rounded-full ring-1 ring-gray-200" style={{ backgroundColor: currentColor }} />
                    <p className="text-sm font-semibold text-gray-800 truncate max-w-[160px]">{ch.name}</p>
                  </div>
                  <button onClick={() => setColorPickerChannelId(null)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </div>

                <div className="p-5">
                  {/* プリセット */}
                  <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">プリセット</p>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {[...GROUP_COLORS, "#1d4ed8", "#0f172a", "#be185d", "#047857"].map((c) => (
                      <button
                        key={c}
                        onClick={() => handleChannelColor(ch.channel_id, c)}
                        className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${ch.color === c ? "ring-2 ring-offset-2 ring-gray-500 scale-110" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  {/* カスタム */}
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">カスタム</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => handleChannelColor(ch.channel_id, e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                    />
                    <span className="font-mono text-xs text-gray-500">{ch.color ?? "グループカラーを使用中"}</span>
                  </div>

                  {/* リセット */}
                  {ch.color && (
                    <button
                      onClick={() => { handleChannelColor(ch.channel_id, ""); setColorPickerChannelId(null); }}
                      className="mt-4 w-full rounded-xl border border-red-100 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-50"
                    >
                      グループカラーに戻す
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

function LiveLogLine({ type, text }: { type: string; text: string }) {
  if (type === "live_new") {
    return (
      <div className="my-1 flex items-center gap-2.5 rounded-lg bg-red-950/60 px-2.5 py-2 ring-1 ring-red-500/25">
        <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-red-500" />
        <span className="flex-1 font-medium text-red-200">{text}</span>
      </div>
    );
  }
  if (type === "live") {
    return (
      <div className="flex items-center gap-2.5 py-0.5">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500/70" />
        <span className="text-red-400">{text}</span>
      </div>
    );
  }
  if (type === "no_live") {
    return (
      <div className="flex items-center gap-2 py-1 text-gray-500">
        <span className="h-px flex-1 bg-gray-800" />
        <span>{text}</span>
        <span className="h-px flex-1 bg-gray-800" />
      </div>
    );
  }
  if (type === "done") {
    return (
      <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span className="font-semibold text-emerald-300">{text}</span>
      </div>
    );
  }
  if (type === "phase") {
    return (
      <div className="my-0.5 flex items-center gap-2 py-1 text-violet-400">
        <span className="h-px w-3 flex-shrink-0 rounded bg-violet-500/40" />
        <span>{text}</span>
      </div>
    );
  }
  if (type === "rss") {
    return (
      <div className="flex items-center gap-2 py-[1px] text-emerald-500">
        <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span className="text-gray-300">{text.split("を確認")[0]}</span>
        <span className="text-emerald-600">を確認</span>
        <span className="ml-auto text-[10px] text-gray-600">{text.split("  ")[1]}</span>
      </div>
    );
  }
  if (type === "rss_error") {
    return (
      <div className="flex items-center gap-2 py-[1px] text-red-500">
        <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        <span>{text}</span>
      </div>
    );
  }
  if (type === "api") {
    return (
      <div className="flex items-center gap-2 py-[1px] text-sky-500">
        <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        <span>{text}</span>
      </div>
    );
  }
  if (type === "api_stat") {
    return (
      <div className="flex items-center gap-1.5 py-0.5 text-gray-600">
        <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
        <span>{text}</span>
      </div>
    );
  }
  if (type === "error") {
    return (
      <div className="flex items-center gap-2 py-0.5 text-red-400">
        <span className="flex-shrink-0">!</span>
        <span>{text}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 py-[1px] text-gray-500">
      <span className="flex-shrink-0 text-gray-700">▸</span>
      <span>{text}</span>
    </div>
  );
}

function ActionButton({ onClick, color, label, disabled }: { onClick: () => void; color: "cyan" | "red" | "amber" | "green"; label: string; disabled?: boolean }) {
  const styles = {
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200 hover:bg-cyan-100",
    red: "bg-red-50 text-red-600 ring-red-200 hover:bg-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition-colors disabled:opacity-50 ${styles[color]}`}>
      {label}
    </button>
  );
}
