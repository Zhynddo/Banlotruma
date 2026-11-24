-- =====================================================================
-- Bán Lộ Trừ Ma · kho file (Supabase Storage)
-- Chạy sau schema.sql. Tạo 2 bucket công khai, chỉ GM được tải lên.
--   media : hình vẽ (art, thumb, token, map)
--   packs : gói offline đã đóng (core-text.json, art-*.zip ...)
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true), ('packs', 'packs', true)
on conflict (id) do nothing;

drop policy if exists "bltm public read" on storage.objects;
create policy "bltm public read" on storage.objects for select
  using (bucket_id in ('media', 'packs'));

drop policy if exists "bltm gm insert" on storage.objects;
create policy "bltm gm insert" on storage.objects for insert
  with check (bucket_id in ('media', 'packs') and public.is_gm());

drop policy if exists "bltm gm update" on storage.objects;
create policy "bltm gm update" on storage.objects for update
  using (bucket_id in ('media', 'packs') and public.is_gm());

drop policy if exists "bltm gm delete" on storage.objects;
create policy "bltm gm delete" on storage.objects for delete
  using (bucket_id in ('media', 'packs') and public.is_gm());
