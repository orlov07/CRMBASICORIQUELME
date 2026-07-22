import { createClient } from "@supabase/supabase-js";

// Valores definidos no ambiente de cada deploy. A chave anon e publica por
// natureza; as permissoes dos dados sao protegidas pelas regras RLS.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "__SUPABASE_URL_NAO_CONFIGURADA__";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "__SUPABASE_ANON_KEY_NAO_CONFIGURADA__";

export const configurado = !URL.startsWith("__") && !KEY.startsWith("__");

export const getSiteUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
};

export const getGoogleRedirectTo = () =>
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_TO || getSiteUrl();

export const supabase = createClient(
  configurado ? URL : "https://placeholder.supabase.co",
  configurado ? KEY : "placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
