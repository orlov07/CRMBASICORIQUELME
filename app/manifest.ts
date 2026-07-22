import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRM Riquelme - Fábrica de Blocos",
    short_name: "CRM Riquelme",
    description: "Clientes, pedidos e entregas da Fábrica de Blocos Riquelme.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#f2a900",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
