-- =====================================================================
-- Bán Lộ Trừ Ma · database (Supabase / Postgres)
-- Chạy file này một lần trong Supabase → SQL Editor.
--
-- Hai vùng dữ liệu:
--   1. Kho nội dung (entries): ai cũng đọc và tìm được, chỉ GM sửa.
--   2. Phiếu nhân vật (characters): người chơi sửa phiếu của mình,
--      GM sửa được mọi phiếu.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated;

-- ---------------------------------------------------------------------
-- Chuẩn hoá chữ để tìm không dấu: "Hàn Thủ" → "han thu", "Đạo" → "dao"
-- Bản offline trong app dùng đúng quy tắc này (xem README).
-- ---------------------------------------------------------------------
create or replace function public.f_norm(t text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary,
         replace(replace(coalesce(t, ''), 'đ', 'd'), 'Đ', 'D')))
$$;

-- ---------------------------------------------------------------------
-- Người dùng và vai trò
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role         text not null default 'player' check (role in ('gm', 'player')),
  created_at   timestamptz not null default now()
);

-- Tự tạo profile khi có người đăng ký
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_gm()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'gm')
$$;

-- ---------------------------------------------------------------------
-- Kho nội dung: một bảng chung cho mọi loại
-- id ổn định dạng  <loại>.<slug>  ví dụ  spell.han-thu, can.can-dong
-- Phần riêng của từng loại nằm trong cột data (jsonb).
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id         text primary key check (id ~ '^[a-z]+\.[a-z0-9-]+$'),
  type       text not null check (type in
               ('spell', 'rite', 'can', 'item', 'rule', 'npc', 'monster', 'place', 'lore')),
  name       text not null,
  summary    text,
  body       text,
  tags       text[] not null default '{}',
  data       jsonb  not null default '{}',
  status     text   not null default 'published' check (status in ('draft', 'published')),
  source     text,
  rev        integer not null default 1,
  search     tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (split_part(id, '.', 1) = type)
);

create index if not exists entries_search_idx  on public.entries using gin (search);
create index if not exists entries_name_trgm   on public.entries using gin (public.f_norm(name) extensions.gin_trgm_ops);
create index if not exists entries_type_idx    on public.entries (type);
create index if not exists entries_updated_idx on public.entries (updated_at);

create or replace function public.entries_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search :=
       setweight(to_tsvector('simple', public.f_norm(new.name)), 'A')
    || setweight(to_tsvector('simple', public.f_norm(array_to_string(new.tags, ' '))), 'B')
    || setweight(to_tsvector('simple', public.f_norm(
         coalesce(new.summary, '') || ' ' || coalesce(new.body, '') || ' ' || new.data::text)), 'C');
  if tg_op = 'UPDATE' then
    if (new.name, new.summary, new.body, new.tags, new.data, new.status)
       is distinct from (old.name, old.summary, old.body, old.tags, old.data, old.status) then
      new.rev := old.rev + 1;
      new.updated_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists entries_bw on public.entries;
create trigger entries_bw before insert or update on public.entries
  for each row execute function public.entries_before_write();

-- Ghi lại mục bị xoá, để gói offline biết mà xoá theo
create table if not exists public.entry_deletions (
  id         text primary key,
  deleted_at timestamptz not null default now()
);

create or replace function public.entries_after_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.entry_deletions (id) values (old.id)
  on conflict (id) do update set deleted_at = now();
  return old;
end $$;

drop trigger if exists entries_ad on public.entries;
create trigger entries_ad after delete on public.entries
  for each row execute function public.entries_after_delete();

-- Mục đang đăng mà chuyển về nháp: báo cho máy người chơi xoá đi
create or replace function public.entries_after_unpublish()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.status = 'published' and new.status = 'draft' then
    insert into public.entry_deletions (id) values (new.id)
    on conflict (id) do update set deleted_at = now();
  end if;
  return new;
end $$;

drop trigger if exists entries_au on public.entries;
create trigger entries_au after update of status on public.entries
  for each row execute function public.entries_after_unpublish();

-- Liên kết giữa các mục: NPC biết phép nào, vong ở cõi nào...
create table if not exists public.entry_links (
  from_id text not null references public.entries (id) on delete cascade,
  to_id   text not null references public.entries (id) on delete cascade,
  rel     text not null,          -- ví dụ: 'biet_phep', 'o_coi', 'mang_phap_bao'
  primary key (from_id, to_id, rel)
);

-- Hình vẽ: file nằm trong Storage, bảng này giữ thông tin
create table if not exists public.media (
  id         uuid primary key default extensions.gen_random_uuid(),
  entry_id   text references public.entries (id) on delete cascade,
  path       text not null,       -- đường dẫn trong bucket 'media'
  kind       text not null default 'art' check (kind in ('art', 'thumb', 'token', 'map')),
  alt        text,
  credit     text,                -- tác giả hình
  width      integer,
  height     integer,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

-- Các gói offline đã đóng (gói chữ, gói hình theo mục)
create table if not exists public.packs (
  id        text primary key,     -- ví dụ: 'core-text', 'art-monster'
  kind      text not null check (kind in ('text', 'media')),
  version   integer not null default 1,
  file_path text not null,        -- đường dẫn trong bucket 'packs'
  bytes     bigint,
  built_at  timestamptz not null default now(),
  notes     text
);

-- ---------------------------------------------------------------------
-- Tìm kiếm online. Gõ có dấu hay không dấu đều được, gõ dở chữ cũng ra.
--   select * from search_entries('han thu');
--   select * from search_entries('vong', array['spell']);
-- ---------------------------------------------------------------------
create or replace function public.search_entries(q text, types text[] default null, lim integer default 30)
returns table (id text, type text, name text, summary text, rank real)
language sql stable
set search_path = ''
as $$
  with norm as (select public.f_norm(q) as nq),
  tq as (
    select to_tsquery('simple', string_agg(w || ':*', ' & ')) as tsq
    from norm, regexp_split_to_table(regexp_replace(nq, '[^a-z0-9 ]', ' ', 'g'), '\s+') as w
    where w <> ''
  )
  select e.id, e.type, e.name, e.summary,
         (coalesce(ts_rank(e.search, tq.tsq), 0)
          + extensions.similarity(public.f_norm(e.name), norm.nq)
          + case when public.f_norm(e.name) = norm.nq then 3
                 when public.f_norm(e.name) like norm.nq || '%' then 1.5
                 when public.f_norm(e.name) like '%' || norm.nq || '%' then 1
                 else 0 end)::real as rank
  from public.entries e, tq, norm
  where (types is null or e.type = any (types))
    and (e.status = 'published' or public.is_gm())
    and (e.search @@ tq.tsq or extensions.similarity(public.f_norm(e.name), norm.nq) > 0.3)
  order by rank desc, e.name
  limit lim
$$;

-- Lấy những gì đổi từ một mốc thời gian (để cập nhật gói offline)
create or replace function public.changes_since(since timestamptz)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'now',     now(),
    'changed', coalesce((select jsonb_agg(to_jsonb(e) - 'search')
                         from public.entries e
                         where e.updated_at > since
                           and (e.status = 'published' or public.is_gm())), '[]'::jsonb),
    'deleted', coalesce((select jsonb_agg(d.id)
                         from public.entry_deletions d
                         where d.deleted_at > since), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------
-- Phiếu nhân vật
-- rev tăng mỗi lần lưu. Lưu qua save_character() để không ghi đè
-- lên bản người khác vừa sửa (quan trọng khi sửa offline rồi đồng bộ).
-- ---------------------------------------------------------------------
create table if not exists public.characters (
  id         uuid primary key default extensions.gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name       text not null default 'Nhân vật mới',
  data       jsonb not null default '{}',
  rev        integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_owner_idx on public.characters (owner_id);

create or replace function public.characters_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rev := old.rev + 1;
  new.updated_at := now();
  if new.owner_id is distinct from old.owner_id and not public.is_gm() then
    raise exception 'Chỉ GM mới chuyển được chủ của phiếu';
  end if;
  return new;
end $$;

drop trigger if exists characters_bu on public.characters;
create trigger characters_bu before update on public.characters
  for each row execute function public.characters_before_update();

-- Lưu phiếu có kiểm tra phiên bản.
-- expected_rev = rev lúc mở phiếu. Nếu ai đó đã lưu trước thì báo xung đột.
create or replace function public.save_character(char_id uuid, new_name text, new_data jsonb, expected_rev integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  r integer;
begin
  update public.characters
     set name = coalesce(new_name, name), data = new_data
   where id = char_id and rev = expected_rev
  returning rev into r;
  if r is null then
    if exists (select 1 from public.characters where id = char_id) then
      raise exception 'conflict: phiếu đã được sửa ở nơi khác' using errcode = '40001';
    else
      raise exception 'not found' using errcode = 'P0002';
    end if;
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Quyền (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.entries         enable row level security;
alter table public.entry_deletions enable row level security;
alter table public.entry_links     enable row level security;
alter table public.media           enable row level security;
alter table public.packs           enable row level security;
alter table public.characters      enable row level security;

-- profiles: xem của mình (GM xem hết); chỉ được đổi tên hiển thị
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_gm());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_gm_all on public.profiles;
create policy profiles_gm_all on public.profiles for all
  using (public.is_gm()) with check (public.is_gm());
revoke update on public.profiles from anon, authenticated;
grant  update (display_name) on public.profiles to authenticated;

-- Kho nội dung: ai cũng đọc bản đã đăng, chỉ GM ghi
drop policy if exists entries_read on public.entries;
create policy entries_read on public.entries for select
  using (status = 'published' or public.is_gm());
drop policy if exists entries_gm_write on public.entries;
create policy entries_gm_write on public.entries for all
  using (public.is_gm()) with check (public.is_gm());

drop policy if exists deletions_read on public.entry_deletions;
create policy deletions_read on public.entry_deletions for select using (true);

drop policy if exists links_read on public.entry_links;
create policy links_read on public.entry_links for select using (true);
drop policy if exists links_gm_write on public.entry_links;
create policy links_gm_write on public.entry_links for all
  using (public.is_gm()) with check (public.is_gm());

drop policy if exists media_read on public.media;
create policy media_read on public.media for select using (true);
drop policy if exists media_gm_write on public.media;
create policy media_gm_write on public.media for all
  using (public.is_gm()) with check (public.is_gm());

drop policy if exists packs_read on public.packs;
create policy packs_read on public.packs for select using (true);
drop policy if exists packs_gm_write on public.packs;
create policy packs_gm_write on public.packs for all
  using (public.is_gm()) with check (public.is_gm());

-- Phiếu nhân vật: chủ phiếu và GM
drop policy if exists characters_read on public.characters;
create policy characters_read on public.characters for select
  using (owner_id = auth.uid() or public.is_gm());
drop policy if exists characters_insert on public.characters;
create policy characters_insert on public.characters for insert
  with check (owner_id = auth.uid() or public.is_gm());
drop policy if exists characters_update on public.characters;
create policy characters_update on public.characters for update
  using (owner_id = auth.uid() or public.is_gm())
  with check (owner_id = auth.uid() or public.is_gm());
drop policy if exists characters_delete on public.characters;
create policy characters_delete on public.characters for delete
  using (owner_id = auth.uid() or public.is_gm());

grant execute on function public.search_entries(text, text[], integer) to anon, authenticated;
grant execute on function public.changes_since(timestamptz)          to anon, authenticated;
grant execute on function public.save_character(uuid, text, jsonb, integer) to authenticated;
