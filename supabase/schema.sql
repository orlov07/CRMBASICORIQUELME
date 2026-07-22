-- Execute no SQL Editor do Supabase. O script pode ser executado novamente.
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
  cliente_id uuid not null references public.crmriq_clientes(id) on delete restrict,
  itens jsonb not null default '[]'::jsonb,
  status text not null default 'orcamento'
    check (status in ('orcamento', 'confirmado', 'producao', 'entregue')),
  data_entrega date,
  total numeric(12,2) not null default 0 check (total >= 0),
  criado_em timestamptz not null default now()
);

-- Campos adicionados ao CRM operacional.
alter table public.crmriq_produtos add column if not exists estoque_atual integer not null default 0 check (estoque_atual >= 0);
alter table public.crmriq_produtos add column if not exists estoque_minimo integer not null default 0 check (estoque_minimo >= 0);
alter table public.crmriq_clientes add column if not exists limite_credito numeric(12,2) not null default 0 check (limite_credito >= 0);
alter table public.crmriq_clientes add column if not exists endereco text;
alter table public.crmriq_pedidos add column if not exists comprovante_path text;
alter table public.crmriq_pedidos add column if not exists forma_pagamento text;
alter table public.crmriq_pedidos add column if not exists desconto numeric(12,2) not null default 0 check (desconto >= 0);
alter table public.crmriq_pedidos add column if not exists frete numeric(12,2) not null default 0 check (frete >= 0);
alter table public.crmriq_pedidos add column if not exists observacao text;

-- Impede que apagar um cliente apague todos os seus pedidos em cascata.
alter table public.crmriq_pedidos drop constraint if exists crmriq_pedidos_cliente_id_fkey;
alter table public.crmriq_pedidos
  add constraint crmriq_pedidos_cliente_id_fkey
  foreign key (cliente_id) references public.crmriq_clientes(id) on delete restrict;

create index if not exists crmriq_clientes_nome_idx on public.crmriq_clientes(nome);
create index if not exists crmriq_produtos_nome_idx on public.crmriq_produtos(nome);
create index if not exists crmriq_pedidos_cliente_id_idx on public.crmriq_pedidos(cliente_id);
create index if not exists crmriq_pedidos_criado_em_idx on public.crmriq_pedidos(criado_em desc);

-- Perfis: todos os e-mails abaixo podem trabalhar; apenas Igor administra exclusoes e auditoria.
create or replace function public.crmriq_eh_autorizado()
returns boolean language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'igoraguiarviana@gmail.com',
    'igor.vianaaidev@gmail.com',
    'techbilld@gmail.com'
  );
$$;

create or replace function public.crmriq_eh_administrador()
returns boolean language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'igoraguiarviana@gmail.com';
$$;

-- Bucket privado para fotos e PDFs de comprovantes de entrega.
insert into storage.buckets (id, name, public)
values ('crmriq-comprovantes', 'crmriq-comprovantes', false)
on conflict (id) do nothing;

create table if not exists public.crmriq_auditoria (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  entidade_id uuid not null,
  acao text not null check (acao in ('insert', 'update', 'delete')),
  antes jsonb,
  depois jsonb,
  usuario_id uuid,
  usuario_email text,
  criado_em timestamptz not null default now()
);
create index if not exists crmriq_auditoria_entidade_id_idx on public.crmriq_auditoria(entidade, entidade_id);
create index if not exists crmriq_auditoria_criado_em_idx on public.crmriq_auditoria(criado_em desc);

-- O registro e criado no banco, nao pelo navegador; assim o historico nao pode ser alterado pelos usuarios.
create or replace function public.crmriq_registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.crmriq_auditoria (entidade, entidade_id, acao, antes, usuario_id, usuario_email)
    values (tg_table_name, old.id, 'delete', to_jsonb(old), auth.uid(), auth.jwt() ->> 'email');
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.crmriq_auditoria (entidade, entidade_id, acao, antes, depois, usuario_id, usuario_email)
    values (tg_table_name, new.id, 'update', to_jsonb(old), to_jsonb(new), auth.uid(), auth.jwt() ->> 'email');
    return new;
  else
    insert into public.crmriq_auditoria (entidade, entidade_id, acao, depois, usuario_id, usuario_email)
    values (tg_table_name, new.id, 'insert', to_jsonb(new), auth.uid(), auth.jwt() ->> 'email');
    return new;
  end if;
end;
$$;
revoke all on function public.crmriq_registrar_auditoria() from public;

drop trigger if exists crmriq_auditar_clientes on public.crmriq_clientes;
create trigger crmriq_auditar_clientes after insert or update or delete on public.crmriq_clientes
for each row execute function public.crmriq_registrar_auditoria();
drop trigger if exists crmriq_auditar_produtos on public.crmriq_produtos;
create trigger crmriq_auditar_produtos after insert or update or delete on public.crmriq_produtos
for each row execute function public.crmriq_registrar_auditoria();
drop trigger if exists crmriq_auditar_pedidos on public.crmriq_pedidos;
create trigger crmriq_auditar_pedidos after insert or update or delete on public.crmriq_pedidos
for each row execute function public.crmriq_registrar_auditoria();

alter table public.crmriq_clientes enable row level security;
alter table public.crmriq_produtos enable row level security;
alter table public.crmriq_pedidos enable row level security;
alter table public.crmriq_auditoria enable row level security;

-- Remove a politica antiga, que dava permissao total a qualquer e-mail autorizado.
drop policy if exists "Usuarios autenticados acessam clientes" on public.crmriq_clientes;
drop policy if exists "Usuarios autenticados acessam produtos" on public.crmriq_produtos;
drop policy if exists "Usuarios autenticados acessam pedidos" on public.crmriq_pedidos;
drop policy if exists "E-mails autorizados acessam clientes" on public.crmriq_clientes;
drop policy if exists "E-mails autorizados acessam produtos" on public.crmriq_produtos;
drop policy if exists "E-mails autorizados acessam pedidos" on public.crmriq_pedidos;
drop policy if exists "Autorizados leem clientes" on public.crmriq_clientes;
drop policy if exists "Autorizados criam clientes" on public.crmriq_clientes;
drop policy if exists "Autorizados alteram clientes" on public.crmriq_clientes;
drop policy if exists "Administrador exclui clientes" on public.crmriq_clientes;
drop policy if exists "Autorizados leem produtos" on public.crmriq_produtos;
drop policy if exists "Autorizados criam produtos" on public.crmriq_produtos;
drop policy if exists "Autorizados alteram produtos" on public.crmriq_produtos;
drop policy if exists "Administrador exclui produtos" on public.crmriq_produtos;
drop policy if exists "Autorizados leem pedidos" on public.crmriq_pedidos;
drop policy if exists "Autorizados criam pedidos" on public.crmriq_pedidos;
drop policy if exists "Autorizados alteram pedidos" on public.crmriq_pedidos;
drop policy if exists "Administrador exclui pedidos" on public.crmriq_pedidos;
drop policy if exists "Administrador le auditoria" on public.crmriq_auditoria;

create policy "Autorizados leem clientes" on public.crmriq_clientes for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Autorizados criam clientes" on public.crmriq_clientes for insert to authenticated with check (public.crmriq_eh_autorizado());
create policy "Autorizados alteram clientes" on public.crmriq_clientes for update to authenticated using (public.crmriq_eh_autorizado()) with check (public.crmriq_eh_autorizado());
create policy "Administrador exclui clientes" on public.crmriq_clientes for delete to authenticated using (public.crmriq_eh_administrador());

create policy "Autorizados leem produtos" on public.crmriq_produtos for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Autorizados criam produtos" on public.crmriq_produtos for insert to authenticated with check (public.crmriq_eh_autorizado());
create policy "Autorizados alteram produtos" on public.crmriq_produtos for update to authenticated using (public.crmriq_eh_autorizado()) with check (public.crmriq_eh_autorizado());
create policy "Administrador exclui produtos" on public.crmriq_produtos for delete to authenticated using (public.crmriq_eh_administrador());

create policy "Autorizados leem pedidos" on public.crmriq_pedidos for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Autorizados criam pedidos" on public.crmriq_pedidos for insert to authenticated with check (public.crmriq_eh_autorizado());
create policy "Autorizados alteram pedidos" on public.crmriq_pedidos for update to authenticated using (public.crmriq_eh_autorizado()) with check (public.crmriq_eh_autorizado());
create policy "Administrador exclui pedidos" on public.crmriq_pedidos for delete to authenticated using (public.crmriq_eh_administrador());
create policy "Administrador le auditoria" on public.crmriq_auditoria for select to authenticated using (public.crmriq_eh_administrador());

drop policy if exists "Autorizados leem comprovantes" on storage.objects;
drop policy if exists "Autorizados enviam comprovantes" on storage.objects;
drop policy if exists "Autorizados atualizam comprovantes" on storage.objects;
drop policy if exists "Administrador exclui comprovantes" on storage.objects;
create policy "Autorizados leem comprovantes" on storage.objects for select to authenticated
  using (bucket_id = 'crmriq-comprovantes' and public.crmriq_eh_autorizado());
create policy "Autorizados enviam comprovantes" on storage.objects for insert to authenticated
  with check (bucket_id = 'crmriq-comprovantes' and public.crmriq_eh_autorizado());
create policy "Autorizados atualizam comprovantes" on storage.objects for update to authenticated
  using (bucket_id = 'crmriq-comprovantes' and public.crmriq_eh_autorizado())
  with check (bucket_id = 'crmriq-comprovantes' and public.crmriq_eh_autorizado());
create policy "Administrador exclui comprovantes" on storage.objects for delete to authenticated
  using (bucket_id = 'crmriq-comprovantes' and public.crmriq_eh_administrador());

-- Atualizacao em tempo real entre a web e o aplicativo desktop.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crmriq_clientes') then
    execute 'alter publication supabase_realtime add table public.crmriq_clientes';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crmriq_produtos') then
    execute 'alter publication supabase_realtime add table public.crmriq_produtos';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crmriq_pedidos') then
    execute 'alter publication supabase_realtime add table public.crmriq_pedidos';
  end if;
end $$;

-- Expansao administrativa: perfis, contas, custos e movimentacoes de estoque.
-- A lista de acesso deixa de ficar fixa no codigo: o administrador gerencia os e-mails pelo CRM.
create table if not exists public.crmriq_perfis (
  email text primary key check (email = lower(email)),
  nome text,
  papel text not null default 'operador' check (papel in ('administrador', 'operador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.crmriq_perfis (email, nome, papel, ativo) values
  ('igoraguiarviana@gmail.com', 'Igor Aguiar Viana', 'administrador', true),
  ('igor.vianaaidev@gmail.com', 'Igor Viana AI Dev', 'operador', true),
  ('techbilld@gmail.com', 'TechBild', 'operador', true)
on conflict (email) do nothing;

create or replace function public.crmriq_eh_autorizado()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.crmriq_perfis
    where email = lower(coalesce(auth.jwt() ->> 'email', '')) and ativo
  );
$$;

create or replace function public.crmriq_eh_administrador()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.crmriq_perfis
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and ativo and papel = 'administrador'
  );
$$;

create table if not exists public.crmriq_financeiro (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receita', 'despesa')),
  descricao text not null check (char_length(trim(descricao)) > 0),
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null default current_date,
  pago_em date,
  pedido_id uuid references public.crmriq_pedidos(id) on delete set null,
  obs text,
  criado_em timestamptz not null default now()
);
create index if not exists crmriq_financeiro_vencimento_idx on public.crmriq_financeiro(vencimento desc);

create table if not exists public.crmriq_estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.crmriq_produtos(id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade integer not null check (quantidade <> 0),
  motivo text,
  criado_em timestamptz not null default now()
);
create index if not exists crmriq_estoque_movimentos_produto_idx on public.crmriq_estoque_movimentos(produto_id, criado_em desc);

alter table public.crmriq_perfis enable row level security;
alter table public.crmriq_financeiro enable row level security;
alter table public.crmriq_estoque_movimentos enable row level security;

drop policy if exists "Autorizados leem perfis" on public.crmriq_perfis;
drop policy if exists "Administrador gerencia perfis" on public.crmriq_perfis;
create policy "Autorizados leem perfis" on public.crmriq_perfis for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Administrador gerencia perfis" on public.crmriq_perfis for all to authenticated using (public.crmriq_eh_administrador()) with check (public.crmriq_eh_administrador());

drop policy if exists "Autorizados leem financeiro" on public.crmriq_financeiro;
drop policy if exists "Autorizados criam financeiro" on public.crmriq_financeiro;
drop policy if exists "Autorizados alteram financeiro" on public.crmriq_financeiro;
drop policy if exists "Administrador exclui financeiro" on public.crmriq_financeiro;
create policy "Autorizados leem financeiro" on public.crmriq_financeiro for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Autorizados criam financeiro" on public.crmriq_financeiro for insert to authenticated with check (public.crmriq_eh_autorizado());
create policy "Autorizados alteram financeiro" on public.crmriq_financeiro for update to authenticated using (public.crmriq_eh_autorizado()) with check (public.crmriq_eh_autorizado());
create policy "Administrador exclui financeiro" on public.crmriq_financeiro for delete to authenticated using (public.crmriq_eh_administrador());

drop policy if exists "Autorizados leem movimentos de estoque" on public.crmriq_estoque_movimentos;
drop policy if exists "Autorizados criam movimentos de estoque" on public.crmriq_estoque_movimentos;
drop policy if exists "Administrador exclui movimentos de estoque" on public.crmriq_estoque_movimentos;
create policy "Autorizados leem movimentos de estoque" on public.crmriq_estoque_movimentos for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Autorizados criam movimentos de estoque" on public.crmriq_estoque_movimentos for insert to authenticated with check (public.crmriq_eh_autorizado());
create policy "Administrador exclui movimentos de estoque" on public.crmriq_estoque_movimentos for delete to authenticated using (public.crmriq_eh_administrador());

drop trigger if exists crmriq_auditar_financeiro on public.crmriq_financeiro;
create trigger crmriq_auditar_financeiro after insert or update or delete on public.crmriq_financeiro
for each row execute function public.crmriq_registrar_auditoria();
drop trigger if exists crmriq_auditar_movimentos_estoque on public.crmriq_estoque_movimentos;
create trigger crmriq_auditar_movimentos_estoque after insert or update or delete on public.crmriq_estoque_movimentos
for each row execute function public.crmriq_registrar_auditoria();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crmriq_financeiro') then
    execute 'alter publication supabase_realtime add table public.crmriq_financeiro';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crmriq_estoque_movimentos') then
    execute 'alter publication supabase_realtime add table public.crmriq_estoque_movimentos';
  end if;
end $$;
