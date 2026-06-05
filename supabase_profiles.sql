create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles
  add column if not exists login_id text,
  add column if not exists login_email text,
  add column if not exists nickname text,
  add column if not exists best_score integer,
  add column if not exists created_at timestamptz;

update public.profiles p
set
  login_email = coalesce(p.login_email, u.email),
  login_id = coalesce(p.login_id, split_part(u.email, '@', 1)),
  nickname = coalesce(p.nickname, split_part(u.email, '@', 1))
from auth.users u
where p.id = u.id;

update public.profiles
set login_id = coalesce(login_id, split_part(login_email, '@', 1), id::text)
where login_id is null;

update public.profiles
set login_email = coalesce(login_email, login_id || '@tetris.co.kr')
where login_email is null;

update public.profiles
set nickname = coalesce(nickname, login_id)
where nickname is null;

update public.profiles
set best_score = coalesce(best_score, 0);

update public.profiles
set created_at = coalesce(created_at, now());

alter table public.profiles
  alter column login_id set not null,
  alter column login_email set not null,
  alter column nickname set not null,
  alter column best_score set default 0,
  alter column best_score set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create unique index if not exists profiles_login_id_unique
on public.profiles (login_id);

create unique index if not exists profiles_login_email_unique
on public.profiles (login_email);

create unique index if not exists profiles_nickname_unique
on public.profiles (nickname);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_login_id text;
  derived_login_email text;
begin
  derived_login_id := split_part(coalesce(new.email, new.id::text), '@', 1);
  derived_login_email := coalesce(new.email, derived_login_id || '@tetris.co.kr');

  insert into public.profiles (
    id,
    login_id,
    login_email,
    nickname,
    best_score
  )
  values (
    new.id,
    derived_login_id,
    derived_login_email,
    derived_login_id,
    0
  )
  on conflict (id) do update
  set
    login_id = excluded.login_id,
    login_email = excluded.login_email,
    nickname = excluded.nickname;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.get_login_profile(target_login_id text)
returns table (
  login_id text,
  login_email text
)
language sql
security definer
set search_path = public
as $$
  select p.login_id, p.login_email
  from public.profiles p
  where p.login_id = target_login_id
  limit 1;
$$;

grant execute on function public.get_login_profile(text) to anon, authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

notify pgrst, 'reload schema';
