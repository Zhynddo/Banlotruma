-- =====================================================================
-- Bán Lộ Trừ Ma · Cập nhật 02 (28/11/2026)
-- Chạy MỘT lần trong Supabase → SQL Editor (sau update-01.sql).
-- Chạy lại cũng không sao.
--   1. Blog truyện ma: khách gửi bài không cần tài khoản, GM duyệt
--   2. Hồ sơ PC công khai: người chơi tự bật, ai cũng xem được
--   3. Người chơi tự tải ảnh chân dung cho nhân vật của mình
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Blog truyện ma
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default extensions.gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 200),
  body         text not null check (char_length(body) between 1 and 60000),
  author_name  text not null default 'Người giấu tên' check (char_length(author_name) between 1 and 80),
  contact      text check (char_length(contact) <= 200),          -- chỉ GM thấy
  status       text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  ip_hash      text,                                               -- chỉ để chặn spam, chỉ GM thấy
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists posts_status_idx on public.posts (status, published_at desc);

alter table public.posts enable row level security;

-- Ai cũng đọc bài đã duyệt, nhưng chỉ thấy các cột công khai
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (status = 'published');
revoke all on public.posts from anon, authenticated;
grant select (id, title, body, author_name, status, created_at, published_at) on public.posts to anon, authenticated;

-- Gửi bài: qua hàm này, không ghi thẳng vào bảng
create or replace function public.submit_post(p_title text, p_body text, p_author text default null, p_contact text default null, p_trap text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  hdr  jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  ip   text  := split_part(coalesce(hdr ->> 'cf-connecting-ip', hdr ->> 'x-real-ip', hdr ->> 'x-forwarded-for', ''), ',', 1);
  h    text  := case when ip = '' then null else encode(extensions.digest('bltm:' || ip, 'sha256'), 'hex') end;
  new_id uuid;
begin
  -- Ô bẫy: người thật không thấy ô này, máy spam thì hay điền
  if coalesce(p_trap, '') <> '' then
    return extensions.gen_random_uuid();
  end if;
  if char_length(trim(coalesce(p_title, ''))) = 0 or char_length(trim(coalesce(p_body, ''))) < 20 then
    raise exception 'Bài cần có tên và nội dung (ít nhất vài câu)' using errcode = '22023';
  end if;
  if h is not null and (select count(*) from public.posts where ip_hash = h and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Em gửi hơi nhiều bài rồi, đợi một tiếng rồi gửi tiếp nha' using errcode = '22023';
  end if;
  if (select count(*) from public.posts where status = 'pending') >= 300 then
    raise exception 'Hàng chờ duyệt đang đầy, thử lại sau nha' using errcode = '22023';
  end if;
  insert into public.posts (title, body, author_name, contact, ip_hash)
  values (trim(p_title), trim(p_body), coalesce(nullif(trim(p_author), ''), 'Người giấu tên'), nullif(trim(p_contact), ''), h)
  returning id into new_id;
  return new_id;
end $$;

-- GM xem hàng chờ (kèm liên hệ) và duyệt bài
create or replace function public.gm_posts(p_status text default 'pending')
returns setof public.posts
language sql stable security definer
set search_path = ''
as $$
  select * from public.posts
  where public.is_gm() and (p_status is null or status = p_status)
  order by created_at desc
  limit 300
$$;

create or replace function public.moderate_post(p_id uuid, p_status text, p_title text default null, p_body text default null, p_author text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_gm() then
    raise exception 'Chỉ GM mới duyệt bài được' using errcode = '42501';
  end if;
  if p_status = 'deleted' then
    delete from public.posts where id = p_id;
    return;
  end if;
  update public.posts
     set status       = p_status,
         title        = coalesce(nullif(trim(p_title), ''), title),
         body         = coalesce(nullif(trim(p_body), ''), body),
         author_name  = coalesce(nullif(trim(p_author), ''), author_name),
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_id;
  if not found then
    raise exception 'Không tìm thấy bài' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.submit_post(text, text, text, text, text) from public;
revoke all on function public.gm_posts(text) from public;
revoke all on function public.moderate_post(uuid, text, text, text, text) from public;
grant execute on function public.submit_post(text, text, text, text, text) to anon, authenticated;
grant execute on function public.gm_posts(text) to authenticated;
grant execute on function public.moderate_post(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Hồ sơ PC công khai (người chơi bật ô "cong_khai" trong phiếu)
-- ---------------------------------------------------------------------
create or replace function public.public_characters()
returns table (id uuid, name text, data jsonb, player text, updated_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.data, p.display_name, c.updated_at
  from public.characters c
  join public.profiles p on p.id = c.owner_id
  where c.data ->> 'cong_khai' = 'true'
  order by c.updated_at desc
  limit 500
$$;
revoke all on function public.public_characters() from public;
grant execute on function public.public_characters() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Ảnh chân dung: người chơi tải vào media/chan-dung/<mã người chơi>/...
-- ---------------------------------------------------------------------
drop policy if exists "bltm player portrait insert" on storage.objects;
create policy "bltm player portrait insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'chan-dung'
              and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "bltm player portrait delete" on storage.objects;
create policy "bltm player portrait delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'chan-dung'
         and (storage.foldername(name))[2] = auth.uid()::text);
