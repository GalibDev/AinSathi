-- AinSathi: tenant isolation, transactional serials, immutable audit history.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 120),
  address text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id), user_id uuid not null references public.profiles(id),
  role text not null check(role in ('owner','admin','lawyer','assistant','viewer')),
  display_name text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(organization_id,user_id)
);
create index member_user_idx on public.organization_members(user_id,organization_id);
create table public.organization_serial_counters (
  organization_id uuid primary key references public.organizations(id), last_serial bigint not null default 0 check(last_serial >= 0)
);
create table public.clients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  full_name text not null check(length(trim(full_name)) between 2 and 150), phone text not null check(phone ~ '^(\+?88)?01[3-9][0-9]{8}$'),
  alternative_phone text not null default '', address text not null default '', notes text not null default '', archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create unique index clients_unique_phone on public.clients(organization_id,regexp_replace(phone,'^(\+?88)','','g')) where archived_at is null;
create index clients_org_name on public.clients(organization_id,full_name);
create table public.cases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), serial_number bigint not null,
  court_case_number text not null check(length(trim(court_case_number)) between 1 and 100), case_year integer not null check(case_year between 1900 and 2200),
  title text not null check(length(trim(title)) between 2 and 200), case_type text not null check(length(case_type) between 1 and 50),
  court_name text not null check(length(trim(court_name)) between 2 and 150), court_location text not null default '',
  received_date date not null, status text not null default 'running' check(status in ('running','pending','closed')),
  closed_date date, closure_result text not null default '', client_id uuid not null,
  plaintiff text not null default '', defendant text not null default '', contact_phone text not null default '',
  next_hearing_date date, notes text not null default '', archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,client_id) references public.clients(organization_id,id), unique(organization_id,id), unique(organization_id,serial_number),
  check((status='closed' and closed_date is not null and length(trim(closure_result))>0) or (status<>'closed' and closed_date is null)),
  check(closed_date is null or closed_date >= received_date)
);
create index cases_org_status_date on public.cases(organization_id,status,received_date desc);
create index cases_org_hearing on public.cases(organization_id,next_hearing_date) where archived_at is null;
create index cases_org_client on public.cases(organization_id,client_id);
create table public.case_assignments (
  organization_id uuid not null, case_id uuid not null, user_id uuid not null,
  created_at timestamptz not null default now(), primary key(organization_id,case_id,user_id),
  foreign key(organization_id,case_id) references public.cases(organization_id,id),
  foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id)
);
create table public.case_parties (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, case_id uuid not null,
  party_type text not null check(party_type in ('plaintiff','defendant','other')), full_name text not null, phone text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,case_id) references public.cases(organization_id,id)
);
create table public.hearings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, case_id uuid not null,
  hearing_date date not null, hearing_time time, court_name text not null, purpose text not null check(length(trim(purpose))>0),
  outcome text not null default '', notes text not null default '', reminder_days integer not null default 1 check(reminder_days between 0 and 30),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,case_id) references public.cases(organization_id,id)
);
create index hearings_org_date on public.hearings(organization_id,hearing_date,hearing_time);
create index hearings_case_date on public.hearings(case_id,hearing_date);
create table public.case_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, case_id uuid not null,
  name text not null, storage_path text not null unique, mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check(size_bytes between 1 and 10485760), uploaded_by uuid not null default auth.uid() references public.profiles(id),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,case_id) references public.cases(organization_id,id),
  check(split_part(storage_path,'/',1)=organization_id::text and split_part(storage_path,'/',2)=case_id::text)
);
create index documents_org_case on public.case_documents(organization_id,case_id);
create table public.case_notes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, case_id uuid not null, body text not null check(length(trim(body))>0),
  author_id uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,case_id) references public.cases(organization_id,id)
);
create table public.case_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, case_id uuid not null, actor_id uuid references public.profiles(id),
  action text not null, closure_date date, outcome text, created_at timestamptz not null default now(),
  foreign key(organization_id,case_id) references public.cases(organization_id,id)
);
create index events_case_date on public.case_events(organization_id,case_id,created_at desc);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, user_id uuid not null, title text not null,
  case_id uuid, read_at timestamptz, created_at timestamptz not null default now(),
  foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id),
  foreign key(organization_id,case_id) references public.cases(organization_id,id)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), actor_id uuid,
  action text not null, entity_type text not null, entity_id text not null, created_at timestamptz not null default now()
);
create index audit_org_date on public.audit_logs(organization_id,created_at desc);
create table public.invitations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  email text not null check(length(email)<255 and email like '%@%'), role text not null check(role in ('admin','lawyer','assistant','viewer')),
  token uuid not null default gen_random_uuid() unique, invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now()+interval '7 days', accepted_at timestamptz, created_at timestamptz not null default now()
);

create function private.member_role(org uuid) returns text language sql stable security definer set search_path='' as $$
  select role from public.organization_members where organization_id=org and user_id=(select auth.uid())
$$;
create function private.can_edit(org uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(private.member_role(org) in ('owner','admin','lawyer','assistant'),false)
$$;
create function private.can_manage(org uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(private.member_role(org) in ('owner','admin'),false)
$$;
revoke all on function private.member_role(uuid),private.can_edit(uuid),private.can_manage(uuid) from public;
grant execute on function private.member_role(uuid),private.can_edit(uuid),private.can_manage(uuid) to authenticated;

create function private.touch_record() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id is distinct from old.id then raise exception 'Record ID is immutable'; end if;
  if to_jsonb(new)->>'organization_id' is distinct from to_jsonb(old)->>'organization_id' then raise exception 'Organization is immutable'; end if;
  if to_jsonb(new)->>'case_id' is distinct from to_jsonb(old)->>'case_id' then raise exception 'Case reference is immutable'; end if;
  if to_jsonb(new)->>'author_id' is distinct from to_jsonb(old)->>'author_id' or to_jsonb(new)->>'uploaded_by' is distinct from to_jsonb(old)->>'uploaded_by' then raise exception 'Author is immutable'; end if;
  new.created_at:=old.created_at; new.updated_at:=now(); return new;
end $$;
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_profile();
create function private.case_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare allocated bigint;
begin
  if not private.can_edit(new.organization_id) then raise exception 'Permission denied' using errcode='42501'; end if;
  if tg_op='INSERT' then
    insert into public.organization_serial_counters(organization_id,last_serial) values(new.organization_id,1)
    on conflict(organization_id) do update set last_serial=public.organization_serial_counters.last_serial+1 returning last_serial into allocated;
    new.serial_number:=allocated;
  elsif new.serial_number is distinct from old.serial_number then raise exception 'Serial number is immutable'; end if;
  if new.status<>'closed' then new.closed_date:=null; new.closure_result:=''; end if;
  return new;
end $$;
create trigger cases_serial_guard before insert or update on public.cases for each row execute function private.case_guard();
create function private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid; entity text; cid uuid; activity text;
begin
  org:=(to_jsonb(new)->>'organization_id')::uuid;
  if org is null then org:=new.id; end if;
  entity:=coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id');
  activity:=lower(tg_op);
  if tg_table_name='cases' then
    cid:=new.id;
    if tg_op='UPDATE' and new.status is distinct from old.status then activity:='status:'||new.status; end if;
  elsif to_jsonb(new) ? 'case_id' then cid:=(to_jsonb(new)->>'case_id')::uuid; end if;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id) values(org,auth.uid(),activity,tg_table_name,entity);
  if cid is not null then
    insert into public.case_events(organization_id,case_id,actor_id,action,closure_date,outcome)
    values(org,cid,auth.uid(),tg_table_name||':'||activity,
      case when tg_table_name='cases' then (to_jsonb(new)->>'closed_date')::date else null end,
      case when tg_table_name='cases' then to_jsonb(new)->>'closure_result' else null end);
  end if;
  return new;
end $$;
do $$ declare tbl text; begin
  foreach tbl in array array['organizations','clients','cases','case_parties','hearings','case_documents','case_notes'] loop
    execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch_record()',tbl);
    execute format('create trigger audit_change after insert or update on public.%I for each row execute function private.audit_record()',tbl);
  end loop;
  create trigger member_audit after insert or update on public.organization_members for each row execute function private.audit_record();
end $$;

create function public.create_chamber(chamber_name text, member_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if length(trim(member_name))<2 then raise exception 'Member name required'; end if;
  insert into public.profiles(id,full_name) values(auth.uid(),trim(member_name)) on conflict(id) do nothing;
  insert into public.organizations(name) values(trim(chamber_name)) returning id into org;
  insert into public.organization_members(organization_id,user_id,role,display_name) values(org,auth.uid(),'owner',trim(member_name));
  return org;
end $$;
create function public.invite_member(org uuid, recipient_email text, member_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not private.can_manage(org) or (private.member_role(org)<>'owner' and member_role='admin') then raise exception 'Permission denied' using errcode='42501'; end if;
  insert into public.invitations(organization_id,email,role,invited_by) values(org,lower(trim(recipient_email)),member_role,auth.uid()) returning token into result;
  return result;
end $$;
create function public.accept_invitation(invite_token uuid, member_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.invitations; user_email text;
begin
  select email into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  select * into invitation from public.invitations where token=invite_token and accepted_at is null and expires_at>now() for update;
  if user_email is null or invitation.id is null or lower(user_email)<>invitation.email then raise exception 'Invitation invalid or email not verified' using errcode='42501'; end if;
  insert into public.organization_members(organization_id,user_id,role,display_name) values(invitation.organization_id,auth.uid(),invitation.role,member_name)
  on conflict(organization_id,user_id) do nothing;
  update public.invitations set accepted_at=now() where id=invitation.id; return invitation.organization_id;
end $$;
create function public.set_member_role(org uuid, member uuid, new_role text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.organizations where id=org for update;
  if private.member_role(org) is distinct from 'owner' or new_role not in ('owner','admin','lawyer','assistant','viewer') then raise exception 'Permission denied' using errcode='42501'; end if;
  if exists(select 1 from public.organization_members where organization_id=org and user_id=member and role='owner') and new_role<>'owner'
    and (select count(*) from public.organization_members where organization_id=org and role='owner')<=1 then raise exception 'Cannot remove last owner'; end if;
  update public.organization_members set role=new_role,updated_at=now() where organization_id=org and user_id=member;
end $$;
-- Read-time dates keep a past hearing from remaining "next" without a scheduler.
create view private.current_cases with (security_invoker=true) as
  select (jsonb_populate_record(null::public.cases,to_jsonb(c)||jsonb_build_object('next_hearing_date',
    (select min(h.hearing_date) from public.hearings h where h.organization_id=c.organization_id and h.case_id=c.id
    and h.hearing_date >= (now() at time zone 'Asia/Dhaka')::date)))).*
  from public.cases c;
grant select on private.current_cases to authenticated;
create function public.get_case(org uuid, case_id uuid) returns setof public.cases language sql stable security invoker set search_path='' as $$
  select * from private.current_cases where organization_id=org and id=case_id and archived_at is null
$$;
create function public.search_cases(org uuid, query text default '', type_filter text default '', status_filter text default '', court_filter text default '', lawyer_filter uuid default null, date_from date default null, date_to date default null, hearing_from date default null, hearing_to date default null, page_number integer default 0, sort_order text default 'newest')
returns setof public.cases language sql stable security invoker set search_path='' as $$
  select c.* from private.current_cases c join public.clients cl on c.client_id=cl.id and c.organization_id=cl.organization_id
  where c.organization_id=org and c.archived_at is null
  and (query='' or concat_ws(' ',c.serial_number,c.court_case_number,c.title,c.plaintiff,c.defendant,c.contact_phone,cl.full_name,cl.phone) ilike '%'||query||'%')
  and (type_filter='' or c.case_type=type_filter) and (status_filter='' or c.status=status_filter)
  and (court_filter='' or c.court_name ilike '%'||court_filter||'%')
  and (lawyer_filter is null or exists(select 1 from public.case_assignments a where a.organization_id=org and a.case_id=c.id and a.user_id=lawyer_filter))
  and (date_from is null or c.received_date>=date_from) and (date_to is null or c.received_date<=date_to)
  and (hearing_from is null or c.next_hearing_date>=hearing_from) and (hearing_to is null or c.next_hearing_date<=hearing_to)
  order by case when sort_order='oldest' then c.serial_number end asc,case when sort_order='hearing' then c.next_hearing_date end asc nulls last,c.serial_number desc
  limit 20 offset greatest(0,least(page_number,100000))*20
$$;
create function public.chamber_report(org uuid, date_from date default null, date_to date default null) returns jsonb language sql stable security invoker set search_path='' as $$
  with scoped as(select * from public.cases where organization_id=org and archived_at is null and (date_from is null or received_date>=date_from) and (date_to is null or received_date<=date_to)),
  stats as(select count(*) total,count(*) filter(where status='running') running,count(*) filter(where status='pending') pending,count(*) filter(where status='closed') closed from scoped)
  select jsonb_build_object('stats',(select to_jsonb(s) from stats s),
  'by_type',coalesce((select jsonb_agg(t) from(select case_type label,count(*) count from scoped group by case_type)t),'[]'::jsonb),
  'by_court',coalesce((select jsonb_agg(t) from(select court_name label,count(*) count from scoped group by court_name)t),'[]'::jsonb),
  'by_lawyer',coalesce((select jsonb_agg(t) from(select m.display_name label,count(*) count from public.case_assignments a join scoped c on c.id=a.case_id join public.organization_members m on m.organization_id=a.organization_id and m.user_id=a.user_id group by m.display_name)t),'[]'::jsonb),
  'closed_in_range',(select count(*) from public.cases where organization_id=org and archived_at is null and status='closed' and (date_from is null or closed_date>=date_from) and (date_to is null or closed_date<=date_to)))
$$;
create function private.sync_next_hearing() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.cases set next_hearing_date=(select min(hearing_date) from public.hearings where case_id=new.case_id and hearing_date>=(now() at time zone 'Asia/Dhaka')::date) where id=new.case_id and organization_id=new.organization_id;
  insert into public.notifications(organization_id,user_id,title,case_id)
  select new.organization_id,user_id,'শুনানির তথ্য হালনাগাদ করা হয়েছে',new.case_id from public.organization_members where organization_id=new.organization_id;
  return new;
end $$;
create trigger hearing_updates after insert or update on public.hearings for each row execute function private.sync_next_hearing();

create function private.document_metadata_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from storage.objects where bucket_id='case-documents' and name=new.storage_path) then raise exception 'Uploaded object missing'; end if;
  return new;
end $$;
create trigger document_object_check before insert on public.case_documents for each row execute function private.document_metadata_guard();

create function private.assignment_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.case_events(organization_id,case_id,actor_id,action) values(new.organization_id,new.case_id,auth.uid(),'case_assignments:insert');
  insert into public.notifications(organization_id,user_id,case_id,title) values(new.organization_id,new.user_id,new.case_id,'আপনাকে একটি মামলার দায়িত্ব দেওয়া হয়েছে');
  return new;
end $$;
create trigger assignment_added after insert on public.case_assignments for each row execute function private.assignment_event();

-- Explicit table grants: append-only histories and no hard-delete routes.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.organizations,public.profiles,public.organization_members,public.clients,public.cases,public.case_assignments,public.case_parties,public.hearings,public.case_documents,public.case_notes,public.case_events,public.notifications,public.audit_logs,public.invitations to authenticated;
grant insert,update on public.clients,public.cases,public.case_parties,public.hearings,public.case_notes to authenticated;
grant insert,delete on public.case_assignments to authenticated;
grant update(name,address) on public.organizations to authenticated;
grant update(full_name,updated_at) on public.profiles to authenticated;
grant insert on public.case_documents to authenticated;
grant update(archived_at) on public.case_documents to authenticated;
grant update(read_at) on public.notifications to authenticated;
do $$ declare tbl text; begin
  foreach tbl in array array['organizations','profiles','organization_members','organization_serial_counters','clients','cases','case_assignments','case_parties','hearings','case_documents','case_notes','case_events','notifications','audit_logs','invitations'] loop
    execute format('alter table public.%I enable row level security',tbl);
  end loop;
  foreach tbl in array array['clients','cases','case_assignments','case_parties','hearings','case_documents','case_notes'] loop
    execute format('create policy member_read on public.%I for select to authenticated using(private.member_role(organization_id) is not null)',tbl);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check(private.can_edit(organization_id))',tbl);
    execute format('create policy editor_update on public.%I for update to authenticated using(private.can_edit(organization_id)) with check(private.can_edit(organization_id))',tbl);
  end loop;
end $$;
create policy assignment_delete on public.case_assignments for delete to authenticated using(private.can_edit(organization_id));
create policy document_author on public.case_documents as restrictive for insert to authenticated with check(uploaded_by=auth.uid());
create policy note_author on public.case_notes as restrictive for insert to authenticated with check(author_id=auth.uid());
create policy organization_read on public.organizations for select to authenticated using(private.member_role(id) is not null);
create policy organization_update on public.organizations for update to authenticated using(private.can_manage(id)) with check(private.can_manage(id));
create policy members_read on public.organization_members for select to authenticated using(private.member_role(organization_id) is not null);
create policy profiles_self on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy history_read on public.case_events for select to authenticated using(private.member_role(organization_id) is not null);
create policy audit_read on public.audit_logs for select to authenticated using(private.can_manage(organization_id));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and private.member_role(organization_id) is not null);
create policy notifications_update on public.notifications for update to authenticated using(user_id=auth.uid() and private.member_role(organization_id) is not null) with check(user_id=auth.uid());
create policy invitations_read on public.invitations for select to authenticated using(private.can_manage(organization_id));
revoke execute on all functions in schema public from public,anon;
grant execute on function public.create_chamber(text,text),public.invite_member(uuid,text,text),public.accept_invitation(uuid,text),public.set_member_role(uuid,uuid,text),public.get_case(uuid,uuid),public.search_cases(uuid,text,text,text,text,uuid,date,date,date,date,integer,text),public.chamber_report(uuid,date,date) to authenticated;

-- Supabase Storage: no public links, same tenant checks as database.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('case-documents','case-documents',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create function private.document_access(path text, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.cases c where c.organization_id::text=split_part(path,'/',1) and c.id::text=split_part(path,'/',2)
  and c.archived_at is null and case when writing then private.can_edit(c.organization_id) else private.member_role(c.organization_id) is not null end)
$$;
revoke all on function private.document_access(text,boolean) from public;
grant execute on function private.document_access(text,boolean) to authenticated;
create policy private_documents_read on storage.objects for select to authenticated using(bucket_id='case-documents' and private.document_access(name,false));
-- Uploads only through the validating Edge Function using its server-side Storage client.
-- No authenticated INSERT policy: raw client uploads cannot bypass signature validation.
create policy private_documents_delete on storage.objects for delete to authenticated using(bucket_id='case-documents' and private.document_access(name,true));
