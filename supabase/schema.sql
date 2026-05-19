-- ============================================================
-- VTracker スキーマ定義
-- Supabase SQL Editor に貼り付けて実行してください
-- ============================================================

-- channels
create table if not exists channels (
  channel_id        text primary key,
  name              text        not null,
  description       text        not null default '',
  icon_url          text        not null default '',
  custom_url        text        not null default '',
  published_at      timestamptz not null,
  subscriber_count  bigint      not null default 0,
  view_count        bigint      not null default 0,
  video_count       bigint      not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- videos
create table if not exists videos (
  video_id              text primary key,
  channel_id            text        not null references channels(channel_id) on delete cascade,
  title                 text        not null,
  description           text        not null default '',
  thumbnail_url         text        not null default '',
  live_chat_id          text,
  start_time            timestamptz,
  end_time              timestamptz,
  scheduled_start_time  timestamptz,
  status                text        not null default 'none'
                          check (status in ('live', 'upcoming', 'none')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists videos_channel_id_idx on videos(channel_id);
create index if not exists videos_status_idx     on videos(status);

-- superchats
create table if not exists superchats (
  id                  text primary key,
  video_id            text        not null references videos(video_id) on delete cascade,
  author_channel_id   text        not null,
  author_name         text        not null,
  amount              integer     not null,
  currency            text        not null default 'JPY',
  comment             text        not null default '',
  tier                integer     not null default 1,
  published_at        timestamptz not null,
  created_at          timestamptz not null default now()
);

create index if not exists superchats_video_id_idx    on superchats(video_id);
create index if not exists superchats_published_at_idx on superchats(published_at desc);

-- updated_at を自動更新するトリガー
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger channels_updated_at
  before update on channels
  for each row execute function update_updated_at();

create or replace trigger videos_updated_at
  before update on videos
  for each row execute function update_updated_at();

-- RLS（Row Level Security）: サービスロールキーで書き込み、公開読み取り
alter table channels   enable row level security;
alter table videos     enable row level security;
alter table superchats enable row level security;

-- 読み取りは全員OK（ダッシュボード表示用）
create policy "public read channels"   on channels   for select using (true);
create policy "public read videos"     on videos     for select using (true);
create policy "public read superchats" on superchats for select using (true);

-- 書き込みはサービスロールのみ（RLSはservice_roleをバイパスするので定義不要だが明示）

-- ============================================================
-- live_graph_points  ライブ中の同接・再生数を5秒おきに記録
-- ============================================================
create table if not exists live_graph_points (
  id                  bigserial   primary key,
  video_id            text        not null references videos(video_id) on delete cascade,
  recorded_at         timestamptz not null default now(),
  concurrent_viewers  integer     not null default 0,
  view_count          bigint      not null default 0,
  like_count          bigint      not null default 0
);

create index if not exists lgp_video_id_idx on live_graph_points(video_id, recorded_at);

alter table live_graph_points enable row level security;
create policy "public read live_graph_points" on live_graph_points for select using (true);

grant all on public.live_graph_points to service_role;
grant usage, select on public.live_graph_points_id_seq to service_role;

-- ============================================================
-- channel_stats_history  登録者数推移を1時間おきに記録
-- ============================================================
create table if not exists channel_stats_history (
  id               bigserial   primary key,
  channel_id       text        not null references channels(channel_id) on delete cascade,
  subscriber_count bigint      not null default 0,
  view_count       bigint      not null default 0,
  recorded_at      timestamptz not null default now()
);

create index if not exists csh_channel_id_idx on channel_stats_history(channel_id, recorded_at);

alter table channel_stats_history enable row level security;
create policy "public read channel_stats_history" on channel_stats_history for select using (true);

grant all on public.channel_stats_history to service_role;
grant usage, select on public.channel_stats_history_id_seq to service_role;

-- ============================================================
-- groups  グループ（事務所・箱・チーム）
-- ============================================================
create table if not exists groups (
  id               text        primary key,  -- e.g. "nijisanji", "vspo"
  name             text        not null,     -- e.g. "にじさんじ"
  color            text        not null default '#8b5cf6',
  parent_group_id  text        references groups(id) on delete set null,
  icon_url         text,
  keywords         text,       -- カンマ区切りキーワード（自動分類用）
  category         text        default 'vtuber',  -- vtuber/esports/indie/other
  created_at       timestamptz not null default now()
);

alter table groups enable row level security;
create policy "public read groups" on groups for select using (true);
grant all on public.groups to service_role;
grant select on public.groups to anon;

-- channels に group_id カラムを追加
alter table channels add column if not exists group_id text references groups(id) on delete set null;

-- ============================================================
-- api_usage_daily  YouTube API 使用量トラッキング
-- ============================================================
create table if not exists api_usage_daily (
  date                 date    primary key default current_date,
  units_used           integer not null default 0,
  units_used_key2      integer not null default 0,
  units_used_key3      integer not null default 0,
  units_used_key4      integer not null default 0,
  units_used_key5      integer not null default 0,
  units_used_key6      integer not null default 0,
  calls_count          integer not null default 0,
  twitch_calls_count   integer not null default 0,
  quota_exceeded_key1  boolean not null default false,
  quota_exceeded_key2  boolean not null default false,
  quota_exceeded_key3  boolean not null default false,
  quota_exceeded_key4  boolean not null default false,
  quota_exceeded_key5  boolean not null default false,
  quota_exceeded_key6  boolean not null default false
);

alter table api_usage_daily enable row level security;
grant all on public.api_usage_daily to service_role;
