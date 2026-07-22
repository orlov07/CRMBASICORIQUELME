-- Execute este script uma vez no SQL Editor do projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.crmriq_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) > 0),
  telefone text,
  cidade text,
  tipo text,
  obs text,
  criado_em timestamptz not null default now()
);

create table if not exists public.crmriq_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) > 0),
  preco numeric(12,2) not null default 0 check (preco >= 0),
  criado_em timestamptz not null default now()
);

create table if not exists public.crmriq_pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.crmriq_clientes(id) on delete cascade,
  itens jsonb not null default '[]'::jsonb,
  status text not null default 'orcamento'
    check (status in ('orcamento', 'confirmado', 'producao', 'entregue')),
  data_entrega date,
  total numeric(12,2) not null default 0 check (total >= 0),
  criado_em timestamptz not null default now()
);

create index if not exists crmriq_clientes_nome_idx on public.crmriq_clientes(nome);
create index if not exists crmriq_produtos_nome_idx on public.crmriq_produtos(nome);
create index if not exists crmriq_pedidos_cliente_id_idx on public.crmriq_pedidos(cliente_id);
create index if not exists crmriq_pedidos_criado_em_idx on public.crmriq_pedidos(criado_em desc);

-- Somente os e-mails abaixo podem acessar os dados compartilhados do CRM.
alter table public.crmriq_clientes enable row level security;
alter table public.crmriq_produtos enable row level security;
alter table public.crmriq_pedidos enable row level security;

drop policy if exists "Usuarios autenticados acessam clientes" on public.crmriq_clientes;
drop policy if exists "Usuarios autenticados acessam produtos" on public.crmriq_produtos;
drop policy if exists "Usuarios autenticados acessam pedidos" on public.crmriq_pedidos;
drop policy if exists "E-mails autorizados acessam clientes" on public.crmriq_clientes;
drop policy if exists "E-mails autorizados acessam produtos" on public.crmriq_produtos;
drop policy if exists "E-mails autorizados acessam pedidos" on public.crmriq_pedidos;

create policy "E-mails autorizados acessam clientes"
  on public.crmriq_clientes for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'igoraguiarviana@gmail.com',
    'igor.vianaaidev@gmail.com',
    'techbilld@gmail.com'
  ))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'igoraguiarviana@gmail.com',
    'igor.vianaaidev@gmail.com',
    'techbilld@gmail.com'
  ));

create policy "E-mails autorizados acessam produtos"
  on public.crmriq_produtos for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'igoraguiarviana@gmail.com',
    'igor.vianaaidev@gmail.com',
    'techbilld@gmail.com'
  ))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'igoraguiarviana@gmail.com',
    'igor.vianaaidev@gmail.com',
    'techbilld@gmail.com'
  ));

create policy "E-mails autorizados acessam pedidos"
  on public.crmriq_pedidos for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'igoraguiarviana@gmail.com',
    'igor.vianaaidev@gmail.com',
    'techbilld@gmail.com'
  ))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'igoraguiarviana@gmail.com',
    'igor.vianaaidev@gmail.com',
    'techbilld@gmail.com'
  ));

-- Atualizacao em tempo real entre a web e o aplicativo desktop.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crmriq_clientes'
  ) then
    execute 'alter publication supabase_realtime add table public.crmriq_clientes';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crmriq_produtos'
  ) then
    execute 'alter publication supabase_realtime add table public.crmriq_produtos';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crmriq_pedidos'
  ) then
    execute 'alter publication supabase_realtime add table public.crmriq_pedidos';
  end if;
end $$;
