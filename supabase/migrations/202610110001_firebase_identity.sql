-- Firebase Authentication + existing Supabase records. No Firebase paid functions.
-- Run AFTER 202610100001_initial.sql; keep existing UUIDs and case data intact.
begin;

-- A Firebase UID is a string, so map it to a separate internal UUID. Never
-- merge accounts by email or change existing Supabase record identifiers.
alter table public.profiles drop constraint if exists profiles_id_fkey;
create table if not exists private.firebase_identities (
  subject text primary key check(length(subject) between 1 and 128),
  profile_id uuid not null unique references public.profiles(id),
  created_at timestamptz not null default now()
);
revoke all on private.firebase_identities from public,anon,authenticated;

create or replace function private.firebase_identity_valid() returns boolean
language sql stable set search_path='' as $$
  select coalesce(auth.jwt()->>'iss'='https://securetoken.google.com/ainsathi'
    and auth.jwt()->>'aud'='ainsathi'
    and auth.jwt()->>'email_verified'='true'
    and length(auth.jwt()->>'sub') between 1 and 128, false)
$$;
create or replace function private.identity_valid() returns boolean
language sql stable set search_path='' as $$
  select private.firebase_identity_valid() or coalesce(
    auth.jwt()->>'iss'='https://nlokgndyjuajgyjjgwhw.supabase.co/auth/v1'
    and auth.jwt()->>'role'='authenticated',false)
$$;
create or replace function private.actor_id() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
  if private.firebase_identity_valid() then
    return (select profile_id from private.firebase_identities where subject=auth.jwt()->>'sub');
  elsif private.identity_valid() then return auth.uid();
  end if;
  return null;
end $$;
create or replace function private.verified_email() returns text
language plpgsql stable security definer set search_path='' as $$
begin
  if private.firebase_identity_valid() then return nullif(lower(auth.jwt()->>'email'),'');
  elsif private.identity_valid() then
    return (select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null);
  end if;
  return null;
end $$;

create or replace function public.sync_firebase_profile() returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not private.firebase_identity_valid() then
    raise exception 'Verified Firebase identity required' using errcode='42501';
  end if;
  -- Serialize first-time mapping creation without trusting any browser UUID.
  perform pg_advisory_xact_lock(hashtextextended('firebase:ainsathi:'||(auth.jwt()->>'sub'),0));
  select profile_id into result from private.firebase_identities where subject=auth.jwt()->>'sub';
  if result is null then
    insert into public.profiles(full_name) values(left(coalesce(auth.jwt()->>'name',''),150)) returning id into result;
    insert into private.firebase_identities(subject,profile_id) values(auth.jwt()->>'sub',result);
  end if;
  return result;
end $$;
alter table public.profiles alter column id set default gen_random_uuid();

-- Rebind only this application's functions to the mapped internal identity.
-- This preserves their original transactions, role checks and serial allocator.
do $$ declare f record; definition text; begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'
    and p.proname not in ('actor_id','verified_email','identity_valid','firebase_identity_valid','sync_firebase_profile')
    and pg_get_functiondef(p.oid) like '%auth.uid()%'
  loop
    definition:=replace(pg_get_functiondef(f.oid),'auth.uid()','private.actor_id()');
    definition:=replace(definition,
      'select email into user_email from auth.users where id=private.actor_id() and email_confirmed_at is not null;',
      'user_email := private.verified_email();');
    execute definition;
  end loop;
end $$;
alter table public.case_documents alter column uploaded_by set default private.actor_id();
alter table public.case_notes alter column author_id set default private.actor_id();

-- Firebase tokens without custom role claims arrive as Postgres anon. Allow
-- their existing operation policies ONLY behind the restrictive trusted-JWT
-- gate below. A public API key alone never passes this gate.
do $$ declare p record; q text; c text; begin
  for p in select * from pg_policies where schemaname='public'
    and tablename in ('organizations','profiles','organization_members','organization_serial_counters','clients','cases','case_assignments','case_parties','hearings','case_documents','case_notes','case_events','notifications','audit_logs','invitations')
    and policyname<>'trusted_identity'
  loop
    q:=replace(p.qual,'auth.uid()','private.actor_id()');
    c:=replace(p.with_check,'auth.uid()','private.actor_id()');
    execute format('alter policy %I on %I.%I to authenticated, anon%s%s',p.policyname,p.schemaname,p.tablename,
      case when q is null then '' else ' using ('||q||')' end,
      case when c is null then '' else ' with check ('||c||')' end);
  end loop;
  for p in select tablename from pg_tables where schemaname='public'
    and tablename in ('organizations','profiles','organization_members','organization_serial_counters','clients','cases','case_assignments','case_parties','hearings','case_documents','case_notes','case_events','notifications','audit_logs','invitations')
  loop
    execute format('drop policy if exists trusted_identity on public.%I',p.tablename);
    execute format('create policy trusted_identity on public.%I as restrictive to authenticated,anon using (private.identity_valid()) with check (private.identity_valid())',p.tablename);
  end loop;
end $$;

grant usage on schema private to anon;
grant select on public.organizations,public.profiles,public.organization_members,public.clients,public.cases,public.case_assignments,public.case_parties,public.hearings,public.case_documents,public.case_notes,public.case_events,public.notifications,public.audit_logs,public.invitations to anon;
grant insert,update on public.clients,public.cases,public.hearings,public.case_parties,public.case_notes to anon;
grant insert,delete on public.case_assignments to anon;
grant insert on public.case_documents to anon;
grant update(archived_at,updated_at) on public.case_documents to anon;
grant update(name,address,updated_at) on public.organizations to anon;
grant update(full_name,updated_at) on public.profiles to anon;
grant update(read_at) on public.notifications to anon;
grant select on private.current_cases to anon;

revoke all on function private.firebase_identity_valid(),private.identity_valid(),private.actor_id(),private.verified_email(),public.sync_firebase_profile() from public;
grant execute on function private.firebase_identity_valid(),private.identity_valid(),private.actor_id(),private.verified_email(),public.sync_firebase_profile() to anon,authenticated;
grant execute on function private.member_role(uuid),private.can_edit(uuid),private.can_manage(uuid) to anon;
grant execute on function public.create_chamber(text,text),public.invite_member(uuid,text,text),public.accept_invitation(uuid,text),public.set_member_role(uuid,uuid,text),public.get_case(uuid,uuid),public.search_cases(uuid,text,text,text,text,uuid,date,date,date,date,integer,text),public.chamber_report(uuid,date,date) to anon;

-- Existing private storage paths/policies remain; no raw browser upload policy.
do $$ declare p record; begin
  for p in select * from pg_policies where schemaname='storage' and tablename='objects'
    and policyname in ('private_documents_read','private_documents_delete')
  loop
    execute format('alter policy %I on storage.objects to authenticated,anon%s%s',p.policyname,
      case when p.qual is null then '' else ' using ('||replace(p.qual,'auth.uid()','private.actor_id()')||')' end,
      case when p.with_check is null then '' else ' with check ('||replace(p.with_check,'auth.uid()','private.actor_id()')||')' end);
  end loop;
end $$;
drop policy if exists trusted_case_identity on storage.objects;
create policy trusted_case_identity on storage.objects as restrictive to anon,authenticated
  using (bucket_id<>'case-documents' or private.identity_valid())
  with check (bucket_id<>'case-documents' or private.identity_valid());
grant usage on schema storage to anon;
grant select,delete on storage.objects to anon;
grant execute on function private.document_access(text,boolean) to anon;
commit;
