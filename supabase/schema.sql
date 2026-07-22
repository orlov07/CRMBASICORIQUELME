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
alter table public.crmriq_pedidos add column if not exists comprovante_path text;

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
