"use client";

import { useEffect, useState, useCallback } from "react";
import type { Group, GroupCategory } from "@/lib/types";

type ChannelRow = { channel_id: string; name: string; group_id: string | null };

type ChannelPreview = {
  channelId: string;
  name: string;
  iconUrl: string;
  description: string;
  detectedGroupId: string | null;
  alreadyExists: boolean;
  existingGroupId: string | null;
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
  const [findLiveResults, setFindLiveResults] = useState<{ videoId: string; channelId: string; channelName: string; title: string }[] | null>(null);
  const [reclassifyStatus, setReclassifyStatus] = useState("");
  const [apiUsage, setApiUsage] = useState<{ unitsUsed: number; callsCount: number; quotaLimit: number } | null>(null);

  // グループ作成
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupKeywords, setNewGroupKeywords] = useState("");
  const [newGroupCategory, setNewGroupCategory] = useState<GroupCategory>("vtuber");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [newGroupStatus, setNewGroupStatus] = useState("");

  // グループキーワード編集
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editKeywords, setEditKeywords] = useState("");
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
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewGroupStatus("✓ 作成しました");
      setNewGroupName("");
      setNewGroupKeywords("");
      setNewGroupCategory("vtuber");
      setNewGroupColor(GROUP_COLORS[0]);
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

  async function handleSaveKeywords(groupId: string) {
    setKeywordSaving(true);
    await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: groupId, keywords: editKeywords.trim() || null }),
    });
    setKeywordSaving(false);
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
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://www.youtube.com/channel/${preview.channelId}`,
          groupId: selectedGroupId || undefined,
        }),
      });
      const data = await res.json();
      ok = res.ok;
      if (!res.ok) errMsg = data.error ?? "エラー";
    }

    setAdding(false);
    if (ok) {
      setAddStatus("✓ 完了しました");
      setAddUrl("");
      setPreview(null);
      setSelectedGroupId("");
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

  async function handleFindLive() {
    setFindLiveStatus("RSSスキャン中...");
    setFindLiveResults(null);
    const res = await fetch("/api/admin/find-live", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setFindLiveStatus(`✓ ${data.found ?? 0}件がライブ中`);
      setFindLiveResults(data.lives ?? []);
    } else {
      setFindLiveStatus(`エラー: ${data.error}`);
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

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">管理画面</h1>
          {apiUsage && (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${apiUsage.unitsUsed / apiUsage.quotaLimit > 0.8 ? "bg-red-500" : apiUsage.unitsUsed / apiUsage.quotaLimit > 0.5 ? "bg-amber-400" : "bg-green-500"}`}
                  style={{ width: `${Math.min(100, (apiUsage.unitsUsed / apiUsage.quotaLimit) * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {apiUsage.unitsUsed.toLocaleString()} / {apiUsage.quotaLimit.toLocaleString()} units
                <span className="ml-1 text-gray-400">（{apiUsage.callsCount}回）</span>
              </span>
              <button onClick={loadApiUsage} className="text-xs text-gray-300 hover:text-gray-500">↻</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handlePollVideos}
            className="rounded-lg border border-cyan-400 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-600 transition-colors hover:bg-cyan-100">
            RSS動画を今すぐ検索
          </button>
          <button onClick={handleFindLive}
            className="rounded-lg border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100">
            ライブ確認（RSS）
          </button>
          <button onClick={handleReclassify}
            className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100">
            未分類を一括再分類
          </button>
          {(pollStatus || findLiveStatus || reclassifyStatus) && (
            <span className="text-xs text-gray-500">{reclassifyStatus || pollStatus || findLiveStatus}</span>
          )}
        </div>
      </div>

      {/* ライブ確認結果 */}
      {findLiveResults !== null && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-red-700">
              {findLiveResults.length === 0 ? "現在ライブ中のチャンネルはありません" : `ライブ中 ${findLiveResults.length}件`}
            </h2>
            <button onClick={() => setFindLiveResults(null)} className="text-xs text-red-400 hover:text-red-600">閉じる</button>
          </div>
          {findLiveResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {findLiveResults.map((v) => (
                <a
                  key={v.videoId}
                  href={`https://www.youtube.com/watch?v=${v.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-red-200 bg-white px-4 py-2.5 hover:bg-red-50 transition-colors"
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500 animate-pulse" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{v.channelName}</p>
                    <p className="truncate text-xs text-gray-400">{v.title}</p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-red-400">↗</span>
                </a>
              ))}
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

        {/* 新規グループ作成フォーム */}
        {showNewGroup && (
          <form onSubmit={handleCreateGroup} className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <p className="mb-3 text-xs font-semibold text-violet-700">新しいグループ</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">グループ名 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Crazy Raccoon"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                  required
                />
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
                  <div className="flex flex-wrap gap-1.5">
                    {GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewGroupColor(c)}
                        className={`h-6 w-6 rounded-full transition-transform ${newGroupColor === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
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

        {/* 既存グループ一覧 */}
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">グループがありません。「+ 新規作成」で追加してください。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <div key={g.id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="flex-1 text-sm font-medium text-gray-900">{g.name}</span>
                  <span className="text-xs text-gray-400">{g.category ? CATEGORY_LABELS[g.category] : ""}</span>
                  {editingGroupId !== g.id && (
                    <button
                      onClick={() => { setEditingGroupId(g.id); setEditKeywords(g.keywords ?? ""); }}
                      className="text-xs text-violet-500 hover:underline"
                    >
                      {g.keywords ? "キーワード編集" : "+ キーワード追加"}
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
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      placeholder="キーワード1,キーワード2,略称"
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none"
                    />
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
                ) : g.keywords ? (
                  <p className="mt-1 pl-5 text-xs text-gray-400">{g.keywords}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
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
                placeholder="URL・@ハンドル・動画URL・チャンネル名"
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

            {/* 名前検索の確認 */}
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

            {/* 名前検索の候補リスト */}
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
                    このチャンネルはすでに登録済みです。グループのみ更新できます（YouTube API不使用）。
                  </p>
                )}
                <div className="mb-4 flex items-center gap-3">
                  {preview.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.iconUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{preview.name}</p>
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
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
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
                    onClick={() => { setPreview(null); setSearchError(""); }}
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
              placeholder={"https://www.youtube.com/@hololive\nhttps://www.youtube.com/watch?v=xxxx\nにじさんじ"}
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
                    <div key={row.id} className={`flex items-center gap-3 px-3 py-2.5 ${row.status === "error" ? "bg-red-50" : "bg-white"}`}>
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
                            <p className="truncate text-sm font-medium text-gray-900">{row.preview.name}</p>
                            <p className="text-xs text-gray-400">{row.preview.alreadyExists ? "登録済" : "新規"}</p>
                          </div>
                          <select
                            value={row.selectedGroupId}
                            onChange={(e) => setBulkRows((prev) => prev.map((r) => r.id === row.id ? { ...r, selectedGroupId: e.target.value } : r))}
                            className="flex-shrink-0 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 focus:border-violet-400 focus:outline-none"
                          >
                            <option value="">未分類</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                          {row.addStatus === "adding" && <span className="text-xs text-gray-400">登録中...</span>}
                          {row.addStatus === "added" && <span className="text-xs text-green-600">✓</span>}
                          {row.addStatus === "failed" && <span className="text-xs text-red-500" title={row.addError}>✕</span>}
                        </>
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
          <span className="ml-2 font-normal text-gray-400">({channels.length}件)</span>
        </h2>
        {channels.length === 0 ? (
          <p className="text-xs text-gray-500">チャンネルがありません</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {channels.map((ch) => {
              const g = ch.group_id ? groupMap.get(ch.group_id) : undefined;
              return (
                <div key={ch.channel_id} className="flex items-center gap-2 py-1.5">
                  {g && (
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                  )}
                  <p className="min-w-0 flex-1 truncate text-xs text-gray-800">{ch.name}</p>
                  <select
                    value={ch.group_id ?? ""}
                    onChange={(e) => handleChannelGroup(ch.channel_id, e.target.value)}
                    className="flex-shrink-0 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 focus:border-violet-400 focus:outline-none"
                  >
                    <option value="">未分類</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
