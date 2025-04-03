-- First check if tables exist and drop them if needed
-- Uncomment these if you want to reset your database tables
-- drop table if exists public.home_members cascade;
-- drop table if exists public.homes cascade;
-- drop table if exists public.user_profiles cascade;

-- Create tables only if they don't exist already
-- User Profiles Table - Basic user information
create table if not exists public.user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null unique,
  full_name text not null,
  email text not null,
  profile_image_url text,
  phone_number text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Homes Table - Represents shared living spaces (groups)
create table if not exists public.homes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invitation_code text not null unique,  -- Code for easy joining
  street_address text not null,
  unit text,
  city text not null,
  state_province text not null,
  zip_postal_code text not null,
  country text not null,
  monthly_rent decimal(10,2) not null,
  security_deposit decimal(10,2) not null,
  lease_start_date date,
  lease_end_date date,
  created_by uuid references auth.users(id) not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Home Members Table - Users who are part of a home
create table if not exists public.home_members (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid references public.homes(id) not null,
  user_id uuid references auth.users(id) not null,
  role text not null, -- 'owner', 'member'
  rent_contribution decimal(10,2),
  move_in_date date,
  move_out_date date,
  joined_at timestamp with time zone default now(),
  constraint unique_home_member unique (home_id, user_id)
);

-- Function to generate random invitation code
create or replace function generate_invitation_code() 
returns text as $$
declare
  chars text[] := '{A,B,C,D,E,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z,2,3,4,5,6,7,8,9}';
  result text := '';
  i integer := 0;
begin
  for i in 1..6 loop
    result := result || chars[1+random()*(array_length(chars, 1)-1)];
  end loop;
  return result;
end;
$$ language plpgsql;

-- Trigger to automatically generate invitation code for new homes
create or replace function set_invitation_code()
returns trigger as $$
declare
  code text;
  code_exists boolean;
begin
  loop
    code := generate_invitation_code();
    select exists(select 1 from public.homes where invitation_code = code) into code_exists;
    exit when not code_exists;
  end loop;
  
  new.invitation_code := code;
  return new;
end;
$$ language plpgsql;

-- Only create trigger if it doesn't exist already
drop trigger if exists homes_generate_invitation_code on public.homes;
create trigger homes_generate_invitation_code
before insert on public.homes
for each row 
when (new.invitation_code is null)
execute function set_invitation_code();

-- Row Level Security Policies
alter table public.user_profiles enable row level security;
alter table public.homes enable row level security;
alter table public.home_members enable row level security;

-- Policies for user_profiles - Drop first to avoid duplicates
drop policy if exists "Users can view their own profile" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;
drop policy if exists "Users can insert their own profile" on public.user_profiles;
drop policy if exists "Anyone can insert user profile" on public.user_profiles;

-- Create policies
create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);
  
create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);

-- Create a more permissive policy for inserting profiles
create policy "Anyone can insert user profile" 
  on public.user_profiles for insert 
  with check (true);

-- Trigger to set user_id from auth if null
drop function if exists set_user_id_from_auth() cascade;
create function set_user_id_from_auth()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql;

-- Drop and recreate trigger
drop trigger if exists set_user_id_before_insert on public.user_profiles;
create trigger set_user_id_before_insert
before insert on public.user_profiles
for each row execute function set_user_id_from_auth();

-- First drop all existing policies for the homes table
drop policy if exists "Users can view homes they belong to" on public.homes;
drop policy if exists "Users can create homes" on public.homes;
drop policy if exists "Anyone can create homes" on public.homes;
drop policy if exists "View homes created by user" on public.homes;
drop policy if exists "View homes as member" on public.homes;
drop policy if exists "Update own homes" on public.homes;
drop policy if exists "Delete own homes" on public.homes;
drop policy if exists "Users can view any home they're associated with" on public.homes;

-- Drop the problematic policy causing infinite recursion
drop policy if exists "View homes as member" on public.homes;

-- Drop and recreate home view policies
drop policy if exists "View homes created by user" on public.homes;
drop policy if exists "Special view created homes" on public.homes;

-- Create one simple policy for viewing homes
create policy "Users can view any home they're associated with"
  on public.homes
  for select
  using (
    -- Either they created the home
    created_by = auth.uid()
    OR
    -- Or they are a member of the home
    EXISTS (
      select 1 from public.home_members
      where home_members.home_id = id
      and home_members.user_id = auth.uid()
    )
  );

-- Allow any authenticated user to create homes
create policy "Anyone can create homes"
  on public.homes 
  for insert
  with check (auth.uid() IS NOT NULL);

-- Allow owners to update homes they created
create policy "Update own homes"
  on public.homes 
  for update
  using (created_by = auth.uid());

-- Allow owners to delete homes they created
create policy "Delete own homes"
  on public.homes 
  for delete
  using (created_by = auth.uid());

-- Policies for home_members - drop first
drop policy if exists "Users can view members in their homes" on public.home_members;
drop policy if exists "Users can add themselves to homes" on public.home_members;
drop policy if exists "Users can update own membership" on public.home_members;
drop policy if exists "View home members" on public.home_members;
drop policy if exists "View home members simple" on public.home_members;
drop policy if exists "Home owners can view all members" on public.home_members;
drop policy if exists "Insert home membership" on public.home_members;

-- Create a much simpler policy that avoids recursion
-- This policy only checks user_id directly without complex EXISTS clauses
create policy "View home members simple" 
  on public.home_members for select
  using (auth.uid() = user_id);

-- Separate policy for admin/owner access that avoids joins
create policy "Home owners can view all members"
  on public.home_members for select
  using (
    EXISTS (
      select 1 from public.homes
      where id = home_id AND created_by = auth.uid()
    )
  );

-- Replace the insert policy with a simpler version
create policy "Insert home membership"
  on public.home_members for insert
  with check (
    auth.uid() = user_id
    OR
    EXISTS (
      select 1 from public.homes
      where id = home_id AND created_by = auth.uid()
    )
  );

-- Add a policy for updating home_members
create policy "Users can update own membership"
  on public.home_members for update
  using (auth.uid() = user_id);

-- Trigger to update timestamps
drop function if exists public.handle_updated_at() cascade;
create function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop and recreate triggers
drop trigger if exists handle_updated_at on public.user_profiles;
drop trigger if exists handle_updated_at on public.homes;

create trigger handle_updated_at
before update on public.user_profiles
for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at
before update on public.homes
for each row execute procedure public.handle_updated_at();

-- Function to insert homes that bypasses policy issues
drop function if exists insert_home cascade;
create or replace function insert_home(
  name text,
  street_address text,
  unit text,
  city text,
  state_province text,
  zip_postal_code text,
  country text,
  monthly_rent numeric,
  security_deposit numeric,
  lease_start_date date,
  created_by uuid,
  invitation_code text
) returns json as $$
declare
  result json;
  inserted_id uuid;
begin
  insert into public.homes (
    name, street_address, unit, city, state_province, 
    zip_postal_code, country, monthly_rent, security_deposit, 
    lease_start_date, created_by, invitation_code
  ) values (
    name, street_address, unit, city, state_province, 
    zip_postal_code, country, monthly_rent, security_deposit, 
    lease_start_date, created_by, invitation_code
  )
  returning id into inserted_id;
  
  select json_build_object(
    'success', true,
    'home_id', inserted_id
  ) into result;
  
  return result;
exception when others then
  return json_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
revoke all on function insert_home from public;
grant execute on function insert_home to authenticated;

-- Enhance the insert_home_member function to check for duplicates
create or replace function insert_home_member(
  home_id uuid,
  user_id uuid,
  role text,
  rent_contribution decimal(10,2),
  move_in_date date
) returns json as $$
declare
  result json;
  inserted_id uuid;
  existing_member uuid;
  owner_matches boolean;
begin
  -- Check if this is a duplicate entry
  select id into existing_member from public.home_members
  where home_members.home_id = insert_home_member.home_id
  and home_members.user_id = insert_home_member.user_id;
  
  -- Check if home creator matches the user (for debugging)
  select created_by = insert_home_member.user_id into owner_matches
  from public.homes where id = insert_home_member.home_id;
  
  -- If record already exists, return it
  if existing_member is not null then
    select json_build_object(
      'success', true,
      'member_id', existing_member,
      'home_id', insert_home_member.home_id,
      'user_id', insert_home_member.user_id,
      'already_exists', true
    ) into result;
    return result;
  end if;
  
  -- Otherwise insert the new record
  insert into public.home_members (
    home_id, user_id, role, rent_contribution, move_in_date
  ) values (
    home_id, user_id, role, rent_contribution, move_in_date
  )
  returning id into inserted_id;
  
  select json_build_object(
    'success', true,
    'member_id', inserted_id,
    'home_id', insert_home_member.home_id,
    'user_id', insert_home_member.user_id,
    'owner_match', owner_matches
  ) into result;
  
  return result;
exception when others then
  return json_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'owner_match', owner_matches
  );
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function insert_home_member to authenticated;
