-- Backend for the global leaderboard (Supabase project "gauntlet-legends", table public.harambe_scores).
-- Applied as migration "harambe_scores". Public clients get: read of public columns, and two RPCs. No direct writes.
create table public.harambe_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 3 and 12 and name ~ '^[A-Za-z0-9 _.-]+$'),
  score integer not null check (score between 0 and 10000000),
  stage smallint not null check (stage between 1 and 5),
  won boolean not null default false,
  client_hash text not null,           -- md5 of a random per-browser token, for rate limiting; not readable by anon
  hidden boolean not null default false, -- moderation switch
  created_at timestamptz not null default now()
);
create index harambe_scores_score_idx on public.harambe_scores (score desc) where not hidden;
create index harambe_scores_client_idx on public.harambe_scores (client_hash, created_at desc);
alter table public.harambe_scores enable row level security;
create policy harambe_scores_read on public.harambe_scores for select to anon, authenticated using (not hidden);
revoke all on public.harambe_scores from anon, authenticated;
grant select (id, name, score, stage, won, created_at) on public.harambe_scores to anon, authenticated;

create or replace function public.submit_score(p_name text, p_score int, p_stage int, p_won boolean, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name,'')); v_hash text; v_id bigint; v_rank int;
begin
  if v_name !~ '^[A-Za-z0-9 _.-]{3,12}$' then raise exception 'bad name'; end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then raise exception 'bad score'; end if;
  if p_stage is null or p_stage < 1 or p_stage > 5 then raise exception 'bad stage'; end if;
  if p_token is null or char_length(p_token) < 16 or char_length(p_token) > 64 then raise exception 'bad token'; end if;
  v_hash := md5(p_token);
  if exists (select 1 from harambe_scores where client_hash = v_hash and created_at > now() - interval '15 seconds') then raise exception 'slow down'; end if;
  if (select count(*) from harambe_scores where client_hash = v_hash and created_at > now() - interval '1 hour') >= 20 then raise exception 'rate limit'; end if;
  insert into harambe_scores(name, score, stage, won, client_hash) values (v_name, p_score, p_stage::smallint, coalesce(p_won,false), v_hash) returning id into v_id;
  select count(*)+1 into v_rank from (select distinct on (lower(name)) score from harambe_scores where not hidden order by lower(name), score desc) b where b.score > p_score;
  return json_build_object('id', v_id, 'rank', v_rank);
end $$;

create or replace function public.top_scores(p_limit int default 10)
returns table(id bigint, name text, score int, stage smallint, won boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.score, t.stage, t.won, t.created_at from (
    select distinct on (lower(name)) id, name, score, stage, won, created_at from harambe_scores where not hidden order by lower(name), score desc, created_at asc
  ) t order by t.score desc, t.created_at asc limit least(greatest(coalesce(p_limit,10),1),50);
$$;

revoke execute on function public.submit_score(text,int,int,boolean,text) from public;
revoke execute on function public.top_scores(int) from public;
grant execute on function public.submit_score(text,int,int,boolean,text) to anon, authenticated;
grant execute on function public.top_scores(int) to anon, authenticated;
