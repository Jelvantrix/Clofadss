-- ============================================================================
-- Migration 0013: remove leftover permissive policies
--
-- Migration 0001 created `anon_all` and `authenticated_all` policies on every
-- table. Migrations 0002 and 0004 added stricter policies but never removed
-- those two policies. PostgreSQL combines permissive policies with OR, so any
-- signed-in patron still inherited full read/write access to orders, customers,
-- and every other table.
--
-- This migration removes those two policies everywhere and grants a single
-- owner-only policy on every public table. Storefront read policies, waitlist
-- inserts, analytics inserts, and the public RPCs remain unchanged.
-- ============================================================================

begin;

do $$
declare
  tbl text;
begin
  for tbl in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop policy if exists "anon_all" on public.%I', tbl);
    execute format('drop policy if exists "authenticated_all" on public.%I', tbl);
  end loop;
end $$;

-- One explicit, server-verified owner policy per table. The client can never
-- satisfy public.is_owner() without a confirmed Supabase session whose email
-- exists in public.admins with role = 'owner'.
do $$
declare
  tbl text;
begin
  for tbl in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop policy if exists owner_all on public.%I', tbl);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())',
      tbl
    );
  end loop;
end $$;

-- The storefront now creates orders through the authenticated server route
-- (`/api/commerce/checkout` -> service role), never through a public RPC.
-- A public SECURITY DEFINER order function lets anyone forge orders or adjust
-- stock directly with the anon key, so remove public execution entirely.
revoke execute on function public.place_order(jsonb) from anon, authenticated;
revoke execute on function public.submit_suggestion(jsonb) from anon, authenticated;
revoke execute on function public.vote_for_suggestion(text, text) from anon, authenticated;
grant execute on function public.place_order(jsonb) to service_role;
grant execute on function public.submit_suggestion(jsonb) to service_role;
grant execute on function public.vote_for_suggestion(text, text) to service_role;

-- Audit rows are written by the owner console or by service-role server code.
-- Anonymous callers must not be able to inject or flood the audit trail.
drop policy if exists public_insert on public."auditLog";

commit;
