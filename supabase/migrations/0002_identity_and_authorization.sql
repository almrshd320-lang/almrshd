-- =============================================================================
-- 0002 — Identity & authorization: profiles, roles, permissions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users. Staff only; customers never authenticate.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  phone         text,
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Staff/admin profiles. Customers are intentionally NOT users of this system.';

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- roles / permissions / role_permissions / user_roles
-- Permissions are data, not code: adding a role never requires a redeploy.
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
  key            text primary key check (key ~ '^[a-z_]{3,32}$'),
  name_ar        text not null,
  name_en        text not null,
  description_ar text,
  rank           smallint not null default 0,   -- higher = broader authority
  created_at     timestamptz not null default now()
);

create table if not exists public.permissions (
  key            text primary key check (key ~ '^[a-z_]{3,48}$'),
  name_ar        text not null,
  description_ar text,
  created_at     timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_key       text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.user_roles (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role_key   text not null references public.roles(key) on delete restrict,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

create index if not exists idx_user_roles_role on public.user_roles(role_key);

-- -----------------------------------------------------------------------------
-- Authorization helpers.
--
-- SECURITY DEFINER + a pinned search_path: these are called from RLS policies,
-- so they must not be shadowed by a caller-controlled search_path.
-- STABLE lets the planner cache the result within a statement.
-- -----------------------------------------------------------------------------

create or replace function public.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid()
      and rp.permission_key = p_permission_key
      and pr.is_active
  );
$$;

comment on function public.has_permission is
  'True when the current authenticated user holds the permission through any active role.';

create or replace function public.has_role(p_role_key text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role_key = p_role_key
      and pr.is_active
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid() and pr.is_active
  );
$$;

comment on function public.is_staff is
  'True for any authenticated user with at least one role and an active profile.';

-- Returns the caller''s permission set. Used by the admin UI to hide controls the
-- user cannot use — the server still re-checks every one of them.
create or replace function public.my_permissions()
returns table (permission_key text)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select distinct rp.permission_key
  from public.user_roles ur
  join public.role_permissions rp on rp.role_key = ur.role_key
  join public.profiles pr on pr.id = ur.user_id
  where ur.user_id = auth.uid() and pr.is_active;
$$;

-- -----------------------------------------------------------------------------
-- New auth users get a profile row automatically, with NO roles.
-- Access is granted deliberately, never by signing up.
-- -----------------------------------------------------------------------------
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();
