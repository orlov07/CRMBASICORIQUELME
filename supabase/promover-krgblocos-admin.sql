-- Execute este arquivo no Supabase: SQL Editor -> New query -> Run.
-- Promove a conta informada e garante que ela continue com acesso ativo.
insert into public.crmriq_perfis (email, nome, papel, ativo)
values ('krgblocos@gmail.com', 'KRG Blocos', 'administrador', true)
on conflict (email) do update set
  nome = excluded.nome,
  papel = 'administrador',
  ativo = true;

-- Atualiza as regras usadas pelas políticas RLS de todas as telas do CRM.
-- Sem isto, um banco criado com a versão anterior pode manter uma lista fixa
-- de usuários autorizados, mesmo que o perfil acima esteja como administrador.
create or replace function public.crmriq_eh_autorizado()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.crmriq_perfis
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and ativo
  );
$$;

create or replace function public.crmriq_eh_administrador()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.crmriq_perfis
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and ativo
      and papel = 'administrador'
  );
$$;

-- Conferência: o resultado deve exibir papel = administrador e ativo = true.
select email, nome, papel, ativo
from public.crmriq_perfis
where email = 'krgblocos@gmail.com';
