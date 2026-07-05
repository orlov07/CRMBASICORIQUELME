import { createClient } from "@supabase/supabase-js";

// Preenchido automaticamente no deploy. Chave anon é pública por natureza (protegida por RLS).
const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gnyaayputrrjaglccqym.supabase.co";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdueWFheXB1dHJyamFnbGNjcXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjUyMTAsImV4cCI6MjA5NzE0MTIxMH0.ub3g6DXnbO-lfQRFzCFhnlpzfZtuNP-UX64fWfPXAaI";

export const configurado = !URL.includes("__");

export const getSiteUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
};

export const getGoogleRedirectTo = () =>
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_TO || getSiteUrl();

export const supabase = createClient(
  configurado ? URL : "https://placeholder.supabase.co",
  configurado ? KEY : "placeholder"
);
