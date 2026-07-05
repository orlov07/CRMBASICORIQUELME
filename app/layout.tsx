import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Riquelme — Fábrica de Blocos",
  description: "Clientes, pedidos e entregas da fábrica em um lugar só.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-body bg-base text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
