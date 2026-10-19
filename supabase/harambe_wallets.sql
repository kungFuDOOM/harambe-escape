-- Private optional SOL wallets for possible future rewards. Applied as migration "harambe_wallets".
-- RLS is on and there are NO policies and NO grants for anon/authenticated: the table is unreadable and unwritable from the client.
-- The only write path is set_wallet() (SECURITY DEFINER). top_scores()/submit_score() never touch this table.
create table public.harambe_wallets (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[A-Za-z0-9 _.-]{3,12}$'),
  wallet text not null check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  client_token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.harambe_wallets enable row level security;
revoke all on public.harambe_wallets from anon, authenticated;

-- set_wallet(token, name, wallet): upsert one wallet per client token; empty wallet removes it. 1 call per 10s per token.
create or replace function public.set_wallet(p_token text, p_name text, p_wallet text)
returns json language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name,'')); v_w text := btrim(coalesce(p_wallet,'')); v_hash text;
begin
  if p_token is null or char_length(p_token) < 16 or char_length(p_token) > 64 then raise exception 'bad token'; end if;
  v_hash := md5(p_token);
  if v_name !~ '^[A-Za-z0-9 _.-]{3,12}$' then raise exception 'bad name'; end if;
  if exists (select 1 from harambe_wallets where client_token_hash = v_hash and last_seen > now() - interval '10 seconds') then raise exception 'slow down'; end if;
  if v_w = '' then delete from harambe_wallets where client_token_hash = v_hash; return json_build_object('ok', true, 'removed', true); end if;
  if v_w !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'bad wallet'; end if;
  insert into harambe_wallets(name, wallet, client_token_hash) values (v_name, v_w, v_hash)
    on conflict (client_token_hash) do update set name = excluded.name, wallet = excluded.wallet, last_seen = now();
  return json_build_object('ok', true);
end $$;
revoke execute on function public.set_wallet(text,text,text) from public;
grant execute on function public.set_wallet(text,text,text) to anon, authenticated;
