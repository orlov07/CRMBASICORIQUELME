-- Execute no Supabase SQL Editor para garantir que somente administradores
-- possam excluir dados, mesmo que tentem chamar a API fora da tela do CRM.

alter table public.crmriq_clientes enable row level security;
alter table public.crmriq_produtos enable row level security;
alter table public.crmriq_pedidos enable row level security;
alter table public.crmriq_financeiro enable row level security;
alter table public.crmriq_estoque_movimentos enable row level security;
alter table public.crmriq_perfis enable row level security;

drop policy if exists "Usuarios autenticados acessam clientes" on public.crmriq_clientes;
drop policy if exists "E-mails autorizados acessam clientes" on public.crmriq_clientes;
drop policy if exists "Autorizados leem clientes" on public.crmriq_clientes;
drop policy if exists "Autorizados criam clientes" on public.crmriq_clientes;
drop policy if exists "Autorizados alteram clientes" on public.crmriq_clientes;
drop policy if exists "Administrador exclui clientes" on public.crmriq_clientes;
create policy "Autorizados leem clientes" on public.crmriq_clientes
  for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Autorizados criam clientes" on public.crmriq_clientes
  for insert to authenticated with check (public.crmriq_eh_autorizado());
create policy "Autorizados alteram clientes" on public.crmriq_clientes
  for update to authenticated using (public.crmriq_eh_autorizado()) with check (public.crmriq_eh_autorizado());
create policy "Administrador exclui clientes" on public.crmriq_clientes
  for delete to authenticated using (public.crmriq_eh_administrador());

drop policy if exists "Usuarios autenticados acessam produtos" on public.crmriq_produtos;
drop policy if exists "E-mails autorizados acessam produtos" on public.crmriq_produtos;
drop policy if exists "Autorizados leem produtos" on public.crmriq_produtos;
drop policy if exists "Autorizados criam produtos" on public.crmriq_produtos;
drop policy if exists "Autorizados alteram produtos" on public.crmriq_produtos;
drop policy if exists "Administrador exclui produtos" on public.crmriq_produtos;
create policy "Autorizados leem produtos" on public.crmriq_produtos
  for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Autorizados criam produtos" on public.crmriq_produtos
  for insert to authenticated with check (public.crmriq_eh_autorizado());
create policy "Autorizados alteram produtos" on public.crmriq_produtos
  for update to authenticated using (public.crmriq_eh_autorizado()) with check (public.crmriq_eh_autorizado());
create policy "Administrador exclui produtos" on public.crmriq_produtos
  for delete to authenticated using (public.crmriq_eh_administrador());

drop policy if exists "Usuarios autenticados acessam pedidos" on public.crmriq_pedidos;
drop policy if exists "E-mails autorizados acessam pedidos" on public.crmriq_pedidos;
drop policy if exists "Autorizados leem pedidos" on public.crmriq_pedidos;
drop policy if exists "Autorizados criam pedidos" on public.crmriq_pedidos;
drop policy if exists "Autorizados alteram pedidos" on public.crmriq_pedidos;
drop policy if exists "Administrador exclui pedidos" on public.crmriq_pedidos;
create policy "Autorizados leem pedidos" on public.crmriq_pedidos
  for select to authenticated using (public.crmriq_eh_autorizado());
create policy "Autorizados criam pedidos" on public.crmriq_pedidos
  for insert to authenticated with check (public.crmriq_eh_autorizado());
create policy "Autorizados alteram pedidos" on public.crmriq_pedidos
  for update to authenticated using (public.crmriq_eh_autorizado()) with check (public.crmriq_eh_autorizado());
create policy "Administrador exclui pedidos" on public.crmriq_pedidos
  for delete to authenticated using (public.crmriq_eh_administrador());

drop policy if exists "Administrador exclui financeiro" on public.crmriq_financeiro;
create policy "Administrador exclui financeiro" on public.crmriq_financeiro
  for delete to authenticated using (public.crmriq_eh_administrador());

drop policy if exists "Administrador exclui movimentos de estoque" on public.crmriq_estoque_movimentos;
create policy "Administrador exclui movimentos de estoque" on public.crmriq_estoque_movimentos
  for delete to authenticated using (public.crmriq_eh_administrador());

drop policy if exists "Administrador gerencia perfis" on public.crmriq_perfis;
create policy "Administrador gerencia perfis" on public.crmriq_perfis
  for all to authenticated
  using (public.crmriq_eh_administrador())
  with check (public.crmriq_eh_administrador());

drop policy if exists "Administrador exclui comprovantes" on storage.objects;
create policy "Administrador exclui comprovantes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'crmriq-comprovantes' and public.crmriq_eh_administrador());
