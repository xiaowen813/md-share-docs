-- ============================================================
-- MD Share 数据库结构（GitHub 登录 + 管理员权限版）
-- 使用方法：Supabase 控制台 → SQL Editor → 粘贴本文件 → Run
-- 权限模型：
--   · 所有人可以阅读（公开共享）
--   · 第一个登录的 GitHub 用户自动成为管理员
--   · 管理员可以添加/移除授权用户
--   · 管理员和授权用户可以新建/编辑/上传/排序/移动/删除
--   · 未登录或未授权的用户只能阅读
-- ============================================================

-- ------------------------------------------------------------
-- 授权用户表（admin 可读）
-- github_username: GitHub 用户名（授权标识）
-- ------------------------------------------------------------
create table if not exists public.authorized_users (
  id              uuid primary key default gen_random_uuid(),
  github_username text unique not null,
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 文件夹表（公开可读，创建走 RPC）
-- ------------------------------------------------------------
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.folders enable row level security;
drop policy if exists "folders_public_read" on public.folders;
create policy "folders_public_read" on public.folders
  for select using (true);

-- ------------------------------------------------------------
-- 文档表（folder_id 为空 = 根目录）
-- doc_type: md | latex | typst；sort_order: 文件夹内手动排序
-- ------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  content_md    text not null default '',
  folder_id     uuid references public.folders(id) on delete set null,
  doc_type      text not null default 'md' check (doc_type in ('md', 'latex', 'typst')),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 老表升级（幂等）：去掉密码列，补齐新列
alter table public.documents add column if not exists folder_id uuid references public.folders(id) on delete set null;
alter table public.documents add column if not exists doc_type text not null default 'md';
alter table public.documents add column if not exists sort_order integer not null default 0;
alter table public.documents drop column if exists password_hash;
create index if not exists documents_folder_idx on public.documents (folder_id);
create index if not exists documents_folder_sort_idx on public.documents (folder_id, sort_order);

alter table public.documents enable row level security;
drop policy if exists "documents_public_read" on public.documents;
create policy "documents_public_read" on public.documents
  for select using (true);

-- ------------------------------------------------------------
-- 历史版本表（公开可读，写入只走 RPC）
-- ------------------------------------------------------------
create table if not exists public.document_versions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  title       text not null,
  content_md  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists document_versions_doc_idx
  on public.document_versions (document_id, created_at desc);
alter table public.document_versions enable row level security;
drop policy if exists "document_versions_public_read" on public.document_versions;
create policy "document_versions_public_read" on public.document_versions
  for select using (true);

-- ============================================================
-- 权限函数
-- ============================================================

-- 当前用户角色：admin | editor | anonymous
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then 'anonymous'
    when exists (
      select 1 from public.authorized_users
      where github_username = coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name', '')
        and is_admin
    ) then 'admin'
    when exists (
      select 1 from public.authorized_users
      where github_username = coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name', '')
    ) then 'editor'
    else 'anonymous'
  end;
$$;

-- 首用户自动成为管理员（仅当表为空时）
create or replace function public.ensure_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if exists (select 1 from public.authorized_users) then
    return false;
  end if;
  v_name := coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name', '');
  if v_name = '' then
    return false;
  end if;
  insert into public.authorized_users (github_username, is_admin)
  values (v_name, true)
  on conflict (github_username) do nothing;
  return true;
end;
$$;

-- 内部：要求 editor/admin，否则拒绝
create or replace function public.require_editor()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'editor') then
    raise exception '无权限：需要管理员授权';
  end if;
end;
$$;

-- 添加授权用户（仅 admin）
create or replace function public.add_authorized_user(p_github_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception '无权限：仅管理员可添加用户';
  end if;
  if p_github_username is null or btrim(p_github_username) = '' then
    raise exception '请输入 GitHub 用户名';
  end if;
  insert into public.authorized_users (github_username)
  values (lower(btrim(p_github_username)))
  on conflict (github_username) do nothing;
  return true;
end;
$$;

-- 移除授权用户（仅 admin）
create or replace function public.remove_authorized_user(p_github_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception '无权限：仅管理员可移除用户';
  end if;
  delete from public.authorized_users
  where github_username = lower(btrim(p_github_username))
    and is_admin = false;
  return true;
end;
$$;

-- 授权用户表 RLS：仅 admin 可读
alter table public.authorized_users enable row level security;
drop policy if exists "authorized_users_admin_read" on public.authorized_users;
create policy "authorized_users_admin_read" on public.authorized_users
  for select using (public.current_user_role() = 'admin');

-- ============================================================
-- 写操作（全部要求 editor/admin，不使用密码）
-- ============================================================

-- 创建文件夹
create or replace function public.create_folder(p_name text)
returns public.folders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folder public.folders;
begin
  perform public.require_editor();
  if p_name is null or btrim(p_name) = '' then
    raise exception '文件夹名称不能为空';
  end if;
  insert into public.folders (name) values (btrim(p_name)) returning * into v_folder;
  return v_folder;
end;
$$;

-- 清理旧的带密码版本函数
drop function if exists public.create_document(text, text, text, text, uuid, text);
drop function if exists public.create_document(text, text, text, text, uuid);
drop function if exists public.create_document(text, text, text, text);
drop function if exists public.update_document(uuid, text, text, text);
drop function if exists public.delete_document(uuid, text);
drop function if exists public.restore_document_version(uuid, uuid, text);
drop function if exists public.verify_document_password(uuid, text);
drop function if exists public.change_document_password(uuid, text, text);

-- 创建文档
create or replace function public.create_document(
  p_slug text,
  p_title text,
  p_content_md text default '',
  p_folder_id uuid default null,
  p_doc_type text default 'md'
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents;
begin
  perform public.require_editor();
  if p_slug is null or btrim(p_slug) = '' then
    raise exception 'slug 不能为空';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception '标题不能为空';
  end if;
  if p_folder_id is not null and not exists (select 1 from public.folders where id = p_folder_id) then
    raise exception '文件夹不存在';
  end if;
  if p_doc_type is null or p_doc_type not in ('md', 'latex', 'typst') then
    raise exception '文件类型无效';
  end if;
  insert into public.documents (slug, title, content_md, folder_id, doc_type)
  values (lower(btrim(p_slug)), btrim(p_title), coalesce(p_content_md, ''), p_folder_id, p_doc_type)
  returning * into v_doc;
  return v_doc;
end;
$$;

-- 更新文档（保存前自动把旧内容存为历史版本）
create or replace function public.update_document(
  p_id uuid,
  p_content_md text,
  p_title text default null
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents;
  v_new_title text;
  v_new_content text;
begin
  perform public.require_editor();
  select * into v_doc from public.documents where id = p_id for update;
  if not found then
    raise exception '文档不存在';
  end if;
  v_new_title   := coalesce(nullif(btrim(p_title), ''), v_doc.title);
  v_new_content := coalesce(p_content_md, v_doc.content_md);
  if v_doc.title is distinct from v_new_title
     or v_doc.content_md is distinct from v_new_content then
    insert into public.document_versions (document_id, title, content_md)
    values (v_doc.id, v_doc.title, v_doc.content_md);
  end if;
  update public.documents
  set content_md = v_new_content, title = v_new_title, updated_at = now()
  where id = p_id
  returning * into v_doc;
  return v_doc;
end;
$$;

-- 恢复历史版本
create or replace function public.restore_document_version(
  p_id uuid,
  p_version_id uuid
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents;
  v_ver public.document_versions;
begin
  perform public.require_editor();
  select * into v_doc from public.documents where id = p_id for update;
  if not found then
    raise exception '文档不存在';
  end if;
  select * into v_ver from public.document_versions
  where id = p_version_id and document_id = p_id;
  if not found then
    raise exception '版本不存在';
  end if;
  insert into public.document_versions (document_id, title, content_md)
  values (v_doc.id, v_doc.title, v_doc.content_md);
  update public.documents
  set content_md = v_ver.content_md, title = v_ver.title, updated_at = now()
  where id = p_id
  returning * into v_doc;
  return v_doc;
end;
$$;

-- 删除文档
create or replace function public.delete_document(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  perform public.require_editor();
  delete from public.documents where id = p_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception '文档不存在';
  end if;
  return true;
end;
$$;

-- 手动排序
create or replace function public.reorder_documents(p_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  i int := 0;
  v_id uuid;
begin
  perform public.require_editor();
  foreach v_id in array p_ids loop
    update public.documents set sort_order = i where id = v_id;
    i := i + 1;
  end loop;
  return true;
end;
$$;

-- 移动文档到文件夹
create or replace function public.move_document(p_doc_id uuid, p_folder_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_editor();
  if p_folder_id is not null and not exists (select 1 from public.folders where id = p_folder_id) then
    raise exception '文件夹不存在';
  end if;
  update public.documents
  set folder_id = p_folder_id, sort_order = 0
  where id = p_doc_id;
  if not found then
    raise exception '文档不存在';
  end if;
  return true;
end;
$$;

-- ============================================================
-- 授权
-- ============================================================
-- 角色查询：匿名也可调用（前端判断登录态用）
grant execute on function public.current_user_role() to anon, authenticated;
-- 首用户管理员：登录后调用
grant execute on function public.ensure_admin() to authenticated;
-- 管理员管理用户
grant execute on function public.add_authorized_user(text) to authenticated;
grant execute on function public.remove_authorized_user(text) to authenticated;
-- 写操作：仅登录用户（函数内部再校验角色）
grant execute on function public.create_folder(text) to authenticated;
grant execute on function public.create_document(text, text, text, uuid, text) to authenticated;
grant execute on function public.update_document(uuid, text, text) to authenticated;
grant execute on function public.restore_document_version(uuid, uuid) to authenticated;
grant execute on function public.delete_document(uuid) to authenticated;
grant execute on function public.reorder_documents(uuid[]) to authenticated;
grant execute on function public.move_document(uuid, uuid) to authenticated;
revoke execute on function public.create_folder(text) from anon;
revoke execute on function public.create_document(text, text, text, uuid, text) from anon;
revoke execute on function public.update_document(uuid, text, text) from anon;
revoke execute on function public.restore_document_version(uuid, uuid) from anon;
revoke execute on function public.delete_document(uuid) from anon;
revoke execute on function public.reorder_documents(uuid[]) from anon;
revoke execute on function public.move_document(uuid, uuid) from anon;
