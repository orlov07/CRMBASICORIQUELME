"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noIos = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

export function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [fechado, setFechado] = useState(false);
  const [mostrarAjudaIos, setMostrarAjudaIos] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const atualizarInstalado = () => setInstalado(media.matches || (navigator as any).standalone === true);
    const capturarPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const appInstalado = () => {
      setInstalado(true);
      setPromptEvent(null);
      setMostrarAjudaIos(false);
    };

    atualizarInstalado();
    window.addEventListener("beforeinstallprompt", capturarPrompt);
    window.addEventListener("appinstalled", appInstalado);
    media.addEventListener("change", atualizarInstalado);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturarPrompt);
      window.removeEventListener("appinstalled", appInstalado);
      media.removeEventListener("change", atualizarInstalado);
    };
  }, []);

  const instalar = async () => {
    if (noIos()) {
      setMostrarAjudaIos(true);
      return;
    }
    if (!promptEvent) return;
    await promptEvent.prompt();
    const escolha = await promptEvent.userChoice;
    if (escolha.outcome === "accepted") setInstalado(true);
    setPromptEvent(null);
  };

  if (fechado || instalado || (!promptEvent && !noIos())) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs border border-acc/60 bg-panel p-4 shadow-2xl">
      <button aria-label="Fechar" onClick={() => setFechado(true)} className="absolute right-2 top-1 text-lg text-mut hover:text-white">×</button>
      <div className="pr-5 font-disp text-sm uppercase tracking-wide text-white">Instale o CRM</div>
      {mostrarAjudaIos ? (
        <p className="mt-2 text-xs leading-5 text-zinc-300">No Safari, toque em Compartilhar e escolha <strong>Adicionar à Tela de Início</strong>.</p>
      ) : (
        <p className="mt-1 text-xs leading-5 text-mut">Use como aplicativo, com ícone próprio e abertura em tela cheia.</p>
      )}
      <button onClick={instalar} className="mt-3 border border-acc bg-acc px-3 py-2 text-xs font-disp uppercase tracking-wide text-base hover:bg-amber-400">
        ↓ Instalar aplicativo
      </button>
    </div>
  );
}
