import type { Metadata } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/pwa-registration";

export const metadata: Metadata = {
  applicationName: "CRM Riquelme",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  title: "CRM Riquelme — Fábrica de Blocos",
  description: "Clientes, pedidos e entregas da fábrica em um lugar só.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-body bg-base text-zinc-100 antialiased">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
