# CRM Basico - Riquelme Fabrica de Blocos

CRM multiusuario com dados compartilhados em tempo real via Supabase Realtime.

- **Painel**: indicadores, pipeline e proximas entregas
- **Clientes**: cadastro com WhatsApp direto
- **Pedidos**: orcamento -> confirmado -> em producao -> entregue
- **Produtos**: catalogo de blocos com precos editaveis

Stack: Next.js 16 (App Router) · TypeScript · Tailwind · Supabase

Tabelas: `crmriq_clientes`, `crmriq_pedidos`, `crmriq_produtos`

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
