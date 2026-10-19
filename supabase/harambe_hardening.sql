-- Security hardening for the leaderboard (migration "harambe_hardening"). Backwards compatible with the shipped client.
-- 1) search_path locked to '' and all objects schema-qualified. 2) No direct table reads for clients (RPC only).
-- 3) authenticated role loses EXECUTE (the game only uses anon). 4) Server-side abuse caps that don't depend on the client token:
--    global inserts per minute/hour, rows per token, rows per name per day, total table size, plausibility of score vs stage.
create index if not exists harambe_scores_created_idx on public.harambe_scores (created_at desc);
create index if not exists harambe_scores_name_idx on public.harambe_scores (lower(name), created_at desc);
create index if not exists harambe_scores_distinct_idx on public.harambe_scores (lower(name), score desc, created_at asc) where not hidden;
create index if not exists harambe_wallets_created_idx on public.harambe_wallets (created_at desc);

-- Clients read only through top_scores(); no bulk/paginated scraping of the table.
revoke select on public.harambe_scores from anon, authenticated;
drop policy if exists harambe_scores_read on public.harambe_scores;

create or replace function public.submit_score(p_name text, p_score int, p_stage int, p_won boolean, p_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_name text := pg_catalog.btrim(coalesce(p_name,'')); v_hash text; v_id bigint; v_rank int;
begin
  if v_name !~ '^[A-Za-z0-9 _.-]{3,12}$' then raise exception 'bad name'; end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then raise exception 'bad score'; end if;
  if p_stage is null or p_stage < 1 or p_stage > 5 then raise exception 'bad stage'; end if;
  if p_token is null or pg_catalog.char_length(p_token) < 16 or pg_catalog.char_length(p_token) > 64 then raise exception 'bad token'; end if;
  -- cheap plausibility: real runs score a few tens of thousands; allow generous headroom per stage reached, and a win only counts at stage 5
  if p_score > 100000 * p_stage then raise exception 'bad score'; end if;
  if coalesce(p_won,false) and p_stage <> 5 then raise exception 'bad stage'; end if;
  v_hash := pg_catalog.md5(p_token);
  if exists (select 1 from public.harambe_scores where client_hash = v_hash and created_at > now() - interval '15 seconds') then raise exception 'slow down'; end if;
  if (select pg_catalog.count(*) from public.harambe_scores where client_hash = v_hash and created_at > now() - interval '1 hour') >= 20 then raise exception 'rate limit'; end if;
  -- server-side caps that clearing the client token does not bypass
  if (select pg_catalog.count(*) from public.harambe_scores where client_hash = v_hash) >= 200 then raise exception 'rate limit'; end if;
  if (select pg_catalog.count(*) from public.harambe_scores where pg_catalog.lower(name) = pg_catalog.lower(v_name) and created_at > now() - interval '1 day') >= 30 then raise exception 'rate limit'; end if;
  if (select pg_catalog.count(*) from public.harambe_scores where created_at > now() - interval '1 minute') >= 60 then raise exception 'busy'; end if;
  if (select pg_catalog.count(*) from public.harambe_scores where created_at > now() - interval '1 hour') >= 600 then raise exception 'busy'; end if;
  if (select pg_catalog.count(*) from public.harambe_scores) >= 50000 then raise exception 'busy'; end if;
  insert into public.harambe_scores(name, score, stage, won, client_hash) values (v_name, p_score, p_stage::smallint, coalesce(p_won,false), v_hash) returning id into v_id;
  select pg_catalog.count(*)+1 into v_rank from (select distinct on (pg_catalog.lower(name)) score from public.harambe_scores where not hidden order by pg_catalog.lower(name), score desc) b where b.score > p_score;
  return pg_catalog.json_build_object('id', v_id, 'rank', v_rank);
end $$;

create or replace function public.top_scores(p_limit int default 10)
returns table(id bigint, name text, score int, stage smallint, won boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, t.score, t.stage, t.won, t.created_at from (
    select distinct on (pg_catalog.lower(s.name)) s.id, s.name, s.score, s.stage, s.won, s.created_at from public.harambe_scores s where not s.hidden order by pg_catalog.lower(s.name), s.score desc, s.created_at asc
  ) t order by t.score desc, t.created_at asc limit least(greatest(coalesce(p_limit,10),1),50);
$$;

create or replace function public.set_wallet(p_token text, p_name text, p_wallet text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_name text := pg_catalog.btrim(coalesce(p_name,'')); v_w text := pg_catalog.btrim(coalesce(p_wallet,'')); v_hash text;
begin
  if p_token is null or pg_catalog.char_length(p_token) < 16 or pg_catalog.char_length(p_token) > 64 then raise exception 'bad token'; end if;
  v_hash := pg_catalog.md5(p_token);
  if v_name !~ '^[A-Za-z0-9 _.-]{3,12}$' then raise exception 'bad name'; end if;
  if exists (select 1 from public.harambe_wallets where client_token_hash = v_hash and last_seen > now() - interval '10 seconds') then raise exception 'slow down'; end if;
  if v_w = '' then delete from public.harambe_wallets where client_token_hash = v_hash; return pg_catalog.json_build_object('ok', true, 'removed', true); end if;
  if v_w !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'bad wallet'; end if;
  -- caps for brand-new rows (updates of an existing token are exempt)
  if not exists (select 1 from public.harambe_wallets where client_token_hash = v_hash) then
    if (select pg_catalog.count(*) from public.harambe_wallets where created_at > now() - interval '1 minute') >= 20 then raise exception 'busy'; end if;
    if (select pg_catalog.count(*) from public.harambe_wallets where created_at > now() - interval '1 hour') >= 200 then raise exception 'busy'; end if;
    if (select pg_catalog.count(*) from public.harambe_wallets) >= 20000 then raise exception 'busy'; end if;
  end if;
  insert into public.harambe_wallets(name, wallet, client_token_hash) values (v_name, v_w, v_hash)
    on conflict (client_token_hash) do update set name = excluded.name, wallet = excluded.wallet, last_seen = now();
  return pg_catalog.json_build_object('ok', true);
end $$;

revoke execute on function public.submit_score(text,int,int,boolean,text) from public, anon, authenticated;
revoke execute on function public.top_scores(int) from public, anon, authenticated;
revoke execute on function public.set_wallet(text,text,text) from public, anon, authenticated;
grant execute on function public.submit_score(text,int,int,boolean,text) to anon;
grant execute on function public.top_scores(int) to anon;
grant execute on function public.set_wallet(text,text,text) to anon;
