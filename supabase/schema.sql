-- ============================================================
-- MD Share 数据库结构
-- 使用方法：Supabase 控制台 → SQL Editor → 粘贴本文件 → Run
-- 说明：所有“写”操作只能通过 RPC 函数完成，函数内服务端校验密码，
--       客户端（即使拿到 anon key）无法绕过密码直接改数据。
--
-- 注意（重要）：
--   Supabase 的 pgcrypto 扩展安装在 extensions schema 里，
--   所以所有函数必须能访问 extensions 目录：
--   1) 函数统一使用 set search_path = public, extensions
--   2) crypt / gen_salt 显式写为 extensions.crypt / extensions.gen_salt
--   否则会出现 “function crypt(text, text) does not exist” 错误。
-- ============================================================

-- bcrypt 密码哈希（pgcrypto 在 Supabase 中默认可用，这句是幂等的）
create extension if not exists pgcrypto;

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
-- ------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  content_md    text not null default '',
  password_hash text not null,
  folder_id     uuid references public.folders(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 老表升级时补充 folder_id 列（幂等）
alter table public.documents add column if not exists folder_id uuid references public.folders(id) on delete set null;
create index if not exists documents_folder_idx on public.documents (folder_id);

alter table public.documents enable row level security;

drop policy if exists "documents_public_read" on public.documents;
create policy "documents_public_read" on public.documents
  for select using (true);

-- 注意：没有创建任何 insert/update/delete 策略 => 客户端直接写表一律被 RLS 拒绝。
-- 写操作只能走下面的 SECURITY DEFINER 函数（内部校验密码）。

-- ------------------------------------------------------------
-- 历史版本表（每次“保存前”的旧内容快照，恢复前也会插入一条）
-- 只读公开：任何人都能看版本列表；写入只允许通过 RPC 函数
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

-- ------------------------------------------------------------
-- 0) 创建文件夹
-- ------------------------------------------------------------
create or replace function public.create_folder(p_name text)
returns public.folders
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_folder public.folders;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception '文件夹名称不能为空';
  end if;
  insert into public.folders (name)
  values (btrim(p_name))
  returning * into v_folder;
  return v_folder;
end;
$$;

-- ------------------------------------------------------------
-- 1) 创建文档（设置编辑密码，可选放进文件夹）
-- ------------------------------------------------------------
-- 清理旧的 4 参数版本，避免函数重载混淆
drop function if exists public.create_document(text, text, text, text);

create or replace function public.create_document(
  p_slug text,
  p_title text,
  p_password text,
  p_content_md text default '',
  p_folder_id uuid default null
)
returns public.documents
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_doc public.documents;
begin
  if p_slug is null or btrim(p_slug) = '' then
    raise exception 'slug 不能为空';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception '标题不能为空';
  end if;
  if p_password is null or length(p_password) < 4 then
    raise exception '编辑密码至少 4 位';
  end if;
  if p_folder_id is not null and not exists (select 1 from public.folders where id = p_folder_id) then
    raise exception '文件夹不存在';
  end if;

  insert into public.documents (slug, title, content_md, password_hash, folder_id)
  values (
    lower(btrim(p_slug)),
    btrim(p_title),
    coalesce(p_content_md, ''),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    p_folder_id
  )
  returning * into v_doc;

  return v_doc;
end;
$$;

-- ------------------------------------------------------------
-- 2) 校验编辑密码（解锁前端编辑界面用）
-- ------------------------------------------------------------
create or replace function public.verify_document_password(p_id uuid, p_password text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.documents
    where id = p_id
      and password_hash = extensions.crypt(p_password, password_hash)
  );
$$;

-- ------------------------------------------------------------
-- 3) 更新文档（必须携带正确密码；保存前自动把旧内容存为历史版本）
-- ------------------------------------------------------------
create or replace function public.update_document(
  p_id uuid,
  p_password text,
  p_content_md text,
  p_title text default null
)
returns public.documents
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_doc public.documents;
  v_new_title text;
  v_new_content text;
begin
  -- 锁行并校验密码
  select * into v_doc from public.documents where id = p_id for update;
  if not found or v_doc.password_hash <> extensions.crypt(p_password, v_doc.password_hash) then
    raise exception '密码不正确';
  end if;

  v_new_title   := coalesce(nullif(btrim(p_title), ''), v_doc.title);
  v_new_content := coalesce(p_content_md, v_doc.content_md);

  -- 内容或标题有变化时，把当前版本存入历史表
  if v_doc.title is distinct from v_new_title
     or v_doc.content_md is distinct from v_new_content then
    insert into public.document_versions (document_id, title, content_md)
    values (v_doc.id, v_doc.title, v_doc.content_md);
  end if;

  -- 应用更新
  update public.documents
  set content_md = v_new_content,
      title      = v_new_title,
      updated_at = now()
  where id = p_id
  returning * into v_doc;

  return v_doc;
end;
$$;

-- ------------------------------------------------------------
-- 4) 修改编辑密码（必须携带正确旧密码）
-- ------------------------------------------------------------
create or replace function public.change_document_password(
  p_id uuid,
  p_old_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_doc public.documents;
begin
  if p_new_password is null or length(p_new_password) < 4 then
    raise exception '新密码至少 4 位';
  end if;

  select * into v_doc from public.documents where id = p_id;
  if not found or v_doc.password_hash <> extensions.crypt(p_old_password, v_doc.password_hash) then
    raise exception '旧密码不正确';
  end if;

  update public.documents
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
  where id = p_id;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- 5) 恢复历史版本（必须携带正确密码；恢复前把当前内容存入历史）
-- ------------------------------------------------------------
create or replace function public.restore_document_version(
  p_id uuid,
  p_version_id uuid,
  p_password text
)
returns public.documents
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_doc public.documents;
  v_ver public.document_versions;
begin
  select * into v_doc from public.documents where id = p_id for update;
  if not found or v_doc.password_hash <> extensions.crypt(p_password, v_doc.password_hash) then
    raise exception '密码不正确';
  end if;

  select * into v_ver from public.document_versions
  where id = p_version_id and document_id = p_id;
  if not found then
    raise exception '版本不存在';
  end if;

  -- 恢复前把当前内容存为历史，避免丢失
  insert into public.document_versions (document_id, title, content_md)
  values (v_doc.id, v_doc.title, v_doc.content_md);

  update public.documents
  set content_md = v_ver.content_md,
      title      = v_ver.title,
      updated_at = now()
  where id = p_id
  returning * into v_doc;

  return v_doc;
end;
$$;

-- ------------------------------------------------------------
-- 6) 删除文档（必须携带正确密码；历史版本随外键级联删除）
-- ------------------------------------------------------------
create or replace function public.delete_document(p_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_deleted int;
begin
  delete from public.documents
  where id = p_id
    and password_hash = extensions.crypt(p_password, password_hash);
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception '密码不正确';
  end if;
  return true;
end;
$$;

-- 显式授权给匿名/登录角色（匿名角色只能读和调用函数，不能写表）
grant execute on function public.create_folder(text) to anon, authenticated;
grant execute on function public.create_document(text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.verify_document_password(uuid, text) to anon, authenticated;
grant execute on function public.update_document(uuid, text, text, text) to anon, authenticated;
grant execute on function public.change_document_password(uuid, text, text) to anon, authenticated;
grant execute on function public.restore_document_version(uuid, uuid, text) to anon, authenticated;
grant execute on function public.delete_document(uuid, text) to anon, authenticated;
