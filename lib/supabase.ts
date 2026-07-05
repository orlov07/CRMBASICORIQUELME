import { createClient } from "@supabase/supabase-js";

// Preenchido automaticamente no deploy. Chave anon é pública por natureza (protegida por RLS).
const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "__SUPABASE_URL__";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "__SUPABASE_ANON_KEY__";

export const configurado = !URL.includes("__");

export const supabase = createClient(
  configurado ? URL : "https://placeholder.supabase.co",
  configurado ? KEY : "placeholder"
);
