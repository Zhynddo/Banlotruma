-- =====================================================================
-- Bán Lộ Trừ Ma · Cập nhật 01 (27/11/2026)
-- Chạy MỘT lần trong Supabase → SQL Editor. Chạy lại cũng không sao.
--   1. GM xoá mục trong app được (trước đây bị chặn ở bảng entry_deletions)
--   2. Mục chuyển sang "nháp" sẽ tự biến mất khỏi máy người chơi
--   3. GM đồng bộ được cả mục nháp về máy mình
-- =====================================================================

-- 1. Ghi nhận mục bị xoá: chạy với quyền hệ thống để vượt qua khoá bảng
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

-- 2. Mục đang đăng mà chuyển về nháp: báo cho máy người chơi xoá đi
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

-- 3. Gói thay đổi: GM nhận cả mục nháp
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
