# CRM Basico - Riquelme Fabrica de Blocos

CRM multiusuario com dados compartilhados em tempo real via Supabase Realtime.

- **Painel**: indicadores, pipeline e proximas entregas
- **Clientes**: cadastro com WhatsApp direto
- **Pedidos**: orcamento -> confirmado -> em producao -> entregue
- **Produtos**: catalogo de blocos com precos editaveis

Stack: Next.js 16 (App Router) · TypeScript · Tailwind · Supabase

Tabelas: `crmriq_clientes`, `crmriq_pedidos`, `crmriq_produtos`

## Banco de dados

O projeto Supabase ja oferece o banco PostgreSQL; faltam apenas as tabelas do CRM. No painel do Supabase, abra **SQL Editor -> New query**, cole o conteudo de `supabase/schema.sql` e clique em **Run**. O script cria as tres tabelas, permissoes para usuarios logados e atualizacao em tempo real.

## Web e aplicativo Windows

O mesmo codigo gera as duas versoes:

- Web: `npm run dev` para desenvolvimento, ou `npm run build` e `npm run start` para producao.
- Aplicativo Windows: `npm run desktop:dev` abre o CRM como programa durante o desenvolvimento.
- Instalador Windows: `npm run desktop:build` cria o instalador `.exe` na pasta `release`.

O aplicativo desktop inicia uma copia local segura do CRM e continua usando o mesmo Supabase; por isso, os dados permanecem sincronizados com a versao web. Para o login Google funcionar no executavel, inclua `http://127.0.0.1:3210` na lista **Redirect URLs** de Authentication -> URL Configuration no Supabase. Para desenvolvimento desktop, inclua tambem `http://localhost:3000`.

## Login com Google

Parametros esperados no ambiente:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GOOGLE_REDIRECT_TO`

Exemplo em `.env.example`.

No Supabase:

1. Habilite o provider Google em `Authentication -> Providers`.
2. Configure a URL do app em `Site URL`.
3. Cadastre a URL de callback do Google com o mesmo redirect configurado no app.
