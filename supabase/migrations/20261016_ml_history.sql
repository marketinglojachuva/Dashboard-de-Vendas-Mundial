-- Run in your Supabase project's SQL Editor before enabling cloud mode.
begin;
create table if not exists public.ml_imports (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  filename text not null,
  record jsonb not null,
  revision integer not null default 1 check (revision>0),
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  unique (user_id,filename),
  check(record ? 'lines' and jsonb_typeof(record->'lines')='array'),
  check(record->>'id'=id),
  check(record->>'filename'=filename)
);
alter table public.ml_imports enable row level security;
revoke all on public.ml_imports from anon, public, authenticated;
grant select,insert,update,delete on public.ml_imports to authenticated;
drop policy if exists ml_read_own on public.ml_imports;
create policy ml_read_own on public.ml_imports for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists ml_insert_own on public.ml_imports;
create policy ml_insert_own on public.ml_imports for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists ml_update_own on public.ml_imports;
create policy ml_update_own on public.ml_imports for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists ml_delete_own on public.ml_imports;
create policy ml_delete_own on public.ml_imports for delete to authenticated using ((select auth.uid())=user_id);
create or replace function public.ml_touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists ml_updated_at on public.ml_imports;
create trigger ml_updated_at before update on public.ml_imports for each row execute function public.ml_touch_updated_at();
insert into storage.buckets (id,name,public,file_size_limit) values ('ml-spreadsheets','ml-spreadsheets',false,52428800) on conflict(id) do update set public=false, file_size_limit=52428800;
drop policy if exists ml_files_read on storage.objects;
create policy ml_files_read on storage.objects for select to authenticated using (bucket_id='ml-spreadsheets' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists ml_files_insert on storage.objects;
create policy ml_files_insert on storage.objects for insert to authenticated with check (bucket_id='ml-spreadsheets' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists ml_files_delete on storage.objects;
create policy ml_files_delete on storage.objects for delete to authenticated using (bucket_id='ml-spreadsheets' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
