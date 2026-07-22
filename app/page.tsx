"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, configurado, getGoogleRedirectTo } from "@/lib/supabase";
import {
  STATUS,
  TIPOS_CLIENTE,
  brl,
  Chip,
  Btn,
  Field,
  inp,
  Modal,
  Empty,
  Spinner,
} from "@/components/ui";

type Produto = { id: string; nome: string; preco: number; estoque_atual: number; estoque_minimo: number };
type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  tipo: string | null;
  obs: string | null;
};
type Item = { produto_id: string; qtd: number };
type Pedido = {
  id: string;
  cliente_id: string;
  itens: Item[];
  status: string;
  data_entrega: string | null;
  total: number;
  criado_em: string;
  comprovante_path?: string | null;
};

const NAV = [
  { id: "estoque", label: "Estoque", icone: "▤" },
  { id: "producao", label: "Produção", icone: "◫" },
  { id: "relatorios", label: "Relatórios", icone: "▥" },
  { id: "agenda", label: "Agenda", icone: "◫" },
  { id: "painel", label: "Painel", icone: "▦" },
  { id: "clientes", label: "Clientes", icone: "◉" },
  { id: "pedidos", label: "Pedidos", icone: "▤" },
  { id: "produtos", label: "Produtos", icone: "▣" },
].sort((a, b) => {
  const ordem = ["painel", "clientes", "pedidos", "agenda", "estoque", "producao", "produtos", "relatorios"];
  return ordem.indexOf(a.id) - ordem.indexOf(b.id);
});

const EMAIL_ADMINISTRADOR = "igoraguiarviana@gmail.com";
const GRUPOS_NAVEGACAO = [
  { titulo: "Visão geral", ids: ["painel", "relatorios"] },
  { titulo: "Operação", ids: ["pedidos", "agenda", "producao", "estoque"] },
  { titulo: "Cadastros", ids: ["clientes", "produtos"] },
];

function NumeroAnimado({ valor, moeda = false }: { valor: number; moeda?: boolean }) {
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAtual(valor);
      return;
    }

    const inicio = performance.now();
    let quadro = 0;
    const animar = (agora: number) => {
      const progresso = Math.min((agora - inicio) / 500, 1);
      setAtual(valor * (1 - Math.pow(1 - progresso, 3)));
      if (progresso < 1) quadro = requestAnimationFrame(animar);
    };
    quadro = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(quadro);
  }, [valor]);

  return <>{moeda ? brl(atual) : Math.round(atual).toLocaleString("pt-BR")}</>;
}

export default function App() {
  const [aba, setAba] = useState("painel");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [authPronta, setAuthPronta] = useState(false);
  const [sessao, setSessao] = useState<any>(null);
  const [modal, setModal] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [menuCompacto, setMenuCompacto] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const podeExcluir = sessao?.user?.email?.toLowerCase() === EMAIL_ADMINISTRADOR;
  const tituloAba = (NAV.find((item) => item.id === aba)?.label || (aba === "auditoria" ? "Auditoria" : "CRM"));

  const avisar = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
  };

  const entrarComGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getGoogleRedirectTo() },
    });
    if (error) avisar("Erro ao iniciar login com Google");
  };

  const sair = async () => {
    await supabase.auth.signOut();
    setModal(null);
    setAba("painel");
    avisar("Sessao encerrada");
  };

  const carregar = useCallback(async () => {
    const [c, p, pr] = await Promise.all([
      supabase.from("crmriq_clientes").select("*").order("nome"),
      supabase.from("crmriq_pedidos").select("*").order("criado_em", { ascending: false }),
      supabase.from("crmriq_produtos").select("*").order("nome"),
    ]);
    setClientes(c.data || []);
    setPedidos((p.data || []).map((x: any) => ({ ...x, itens: x.itens || [] })));
    setProdutos(pr.data || []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (!configurado) {
      setCarregando(false);
      setAuthPronta(true);
      return;
    }

    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSessao(data.session);
      setAuthPronta(true);
      if (!data.session) setCarregando(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      setAuthPronta(true);
      if (!session) {
        setClientes([]);
        setPedidos([]);
        setProdutos([]);
        setCarregando(false);
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!configurado || !sessao) return;
    carregar();
    const canal = supabase
      .channel("crmriq")
      .on("postgres_changes", { event: "*", schema: "public", table: "crmriq_clientes" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "crmriq_pedidos" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "crmriq_produtos" }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar, sessao]);

  const nomeCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nome || "Cliente removido";

  const enviarWhatsApp = (pedido: Pedido) => {
    const cliente = clientes.find((c) => c.id === pedido.cliente_id);
    const telefone = cliente?.telefone?.replace(/\D/g, "");
    if (!cliente || !telefone) {
      avisar("Este cliente não possui WhatsApp cadastrado");
      return;
    }
    const itens = pedido.itens
      .map((item) => {
        const produto = produtos.find((p) => p.id === item.produto_id);
        return produto ? `• ${item.qtd}x ${produto.nome}` : null;
      })
      .filter(Boolean)
      .join("\n");
    const titulo = pedido.status === "orcamento" ? "Orçamento" : "Pedido";
    const mensagem = `${titulo} - Riquelme Fábrica de Blocos\n\nCliente: ${cliente.nome}\n${itens ? `\nItens:\n${itens}\n` : ""}\nTotal: ${brl(Number(pedido.total))}${pedido.data_entrega ? `\nEntrega: ${new Date(pedido.data_entrega + "T12:00").toLocaleDateString("pt-BR")}` : ""}`;
    window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
  };

  const imprimirPedido = (pedido: Pedido) => {
    const cliente = clientes.find((c) => c.id === pedido.cliente_id);
    const popup = window.open("", "_blank");
    if (!popup) {
      avisar("Permita pop-ups para gerar o PDF");
      return;
    }
    const escapar = (texto: string) => texto.replace(/[&<>"']/g, (caractere) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[caractere] || caractere));
    const itens = pedido.itens.map((item) => {
      const produto = produtos.find((p) => p.id === item.produto_id);
      return `<tr><td>${escapar(produto?.nome || "Produto removido")}</td><td>${item.qtd}</td><td>${produto ? brl(produto.preco * item.qtd) : "-"}</td></tr>`;
    }).join("") || "<tr><td colspan=\"3\">Nenhum item adicionado.</td></tr>";
    const titulo = pedido.status === "orcamento" ? "ORÇAMENTO" : "PEDIDO";
    const entrega = pedido.data_entrega ? ` · Entrega prevista: ${new Date(pedido.data_entrega + "T12:00").toLocaleDateString("pt-BR")}` : "";
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><title>${titulo} - Riquelme</title><style>body{font-family:Arial,sans-serif;color:#18181b;padding:42px;max-width:760px;margin:auto}h1{margin:0;font-size:28px}h2{font-size:14px;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin:6px 0 28px}.line{height:7px;background:#f2a900;margin-bottom:28px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}th{font-size:12px;color:#71717a;text-transform:uppercase}td:nth-child(2),td:nth-child(3){text-align:right}.total{margin-top:24px;text-align:right;font-size:22px;font-weight:bold}.muted{color:#71717a;font-size:13px}@media print{body{padding:0}}</style></head><body><div class="line"></div><h1>RIQUELME</h1><h2>Fábrica de Blocos · ${titulo}</h2><p><strong>Cliente:</strong> ${escapar(cliente?.nome || "Cliente removido")}<br><span class="muted">Emitido em ${new Date().toLocaleDateString("pt-BR")}${entrega}</span></p><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Subtotal</th></tr></thead><tbody>${itens}</tbody></table><div class="total">Total: ${brl(Number(pedido.total))}</div></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const enviarComprovante = async (pedido: Pedido, arquivo: File) => {
    if (arquivo.size > 10 * 1024 * 1024) {
      avisar("O comprovante deve ter no máximo 10 MB");
      return;
    }
    const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "arquivo";
    const caminho = `${pedido.id}/${crypto.randomUUID()}.${extensao}`;
    const { error: erroUpload } = await supabase.storage.from("crmriq-comprovantes").upload(caminho, arquivo, { contentType: arquivo.type });
    if (erroUpload) {
      avisar("Não foi possível enviar o comprovante");
      return;
    }
    const { error: erroPedido } = await supabase.from("crmriq_pedidos").update({ comprovante_path: caminho }).eq("id", pedido.id);
    if (erroPedido) {
      avisar("Comprovante enviado, mas não foi vinculado ao pedido");
      return;
    }
    avisar("Comprovante anexado");
    carregar();
  };

  const verComprovante = async (pedido: Pedido) => {
    if (!pedido.comprovante_path) return;
    const { data, error } = await supabase.storage.from("crmriq-comprovantes").createSignedUrl(pedido.comprovante_path, 60 * 10);
    if (error || !data?.signedUrl) {
      avisar("Não foi possível abrir o comprovante");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  // ---------- ações ----------
  const salvarCliente = async (f: any) => {
    if (f.id) {
      const { id, ...resto } = f;
      await supabase.from("crmriq_clientes").update(resto).eq("id", id);
    } else {
      await supabase.from("crmriq_clientes").insert(f);
    }
    setModal(null);
    avisar("Cliente salvo");
    carregar();
  };

  const excluirCliente = async (id: string) => {
    await supabase.from("crmriq_clientes").delete().eq("id", id);
    avisar("Cliente excluído");
    carregar();
  };

  const salvarPedido = async (f: any) => {
    const total = f.itens.reduce((s: number, it: Item) => {
      const p = produtos.find((x) => x.id === it.produto_id);
      return s + (p ? p.preco * (Number(it.qtd) || 0) : 0);
    }, 0);
    const dado = { ...f, total, data_entrega: f.data_entrega || null };
    if (dado.id) {
      const { id, ...resto } = dado;
      await supabase.from("crmriq_pedidos").update(resto).eq("id", id);
    } else {
      await supabase.from("crmriq_pedidos").insert(dado);
    }
    setModal(null);
    avisar("Pedido salvo");
    carregar();
  };

  const mudarStatus = async (id: string, status: string) => {
    await supabase.from("crmriq_pedidos").update({ status }).eq("id", id);
    carregar();
  };

  const excluirPedido = async (id: string) => {
    await supabase.from("crmriq_pedidos").delete().eq("id", id);
    avisar("Pedido excluído");
    carregar();
  };

  const novoPedido = (statusInicial = "orcamento") => {
    if (clientes.length === 0) {
      setModal({ tipo: "aviso-pedido" });
      return;
    }
    setModal({ tipo: "pedido", statusInicial });
  };

  if (!authPronta || (configurado && sessao && carregando)) {
    return <Spinner />;
  }

  if (configurado && !sessao) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-panel border border-line shadow-2xl">
          <div className="hazard h-2 w-full" />
          <div className="p-8">
            <div className="font-disp text-3xl font-bold uppercase tracking-wide text-white">
              Entrar
            </div>
            <p className="text-sm text-mut mt-3 leading-6">
              Use sua conta do Google para acessar o CRM da fabrica e trabalhar com os dados compartilhados.
            </p>
            <div className="mt-6">
              <Btn onClick={entrarComGoogle} className="w-full py-3">
                Entrar com Google
              </Btn>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              Parametros: <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
              <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> e{" "}
              <code className="font-mono">NEXT_PUBLIC_GOOGLE_REDIRECT_TO</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row">
      {/* ---------- Sidebar ---------- */}
      <aside className={(menuCompacto ? "md:w-20" : "md:w-56") + " hidden md:flex md:h-screen md:shrink-0 bg-panel border-r border-line flex-col transition-[width] duration-200"}>
        <div className="hidden md:block hazard h-1.5 w-full" />
        <div className={(menuCompacto ? "px-3" : "px-4") + " py-5 relative"}>
          <button onClick={() => setMenuCompacto(!menuCompacto)} title={menuCompacto ? "Expandir menu" : "Recolher menu"} className="absolute top-3 right-3 text-zinc-500 hover:text-white text-xs">{menuCompacto ? "»" : "«"}</button>
          <div className="grid grid-cols-2 gap-0.5 w-fit">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={"w-3.5 h-2.5 " + (i === 1 ? "bg-acc" : "bg-zinc-600")} />
            ))}
          </div>
          <div className={menuCompacto ? "hidden" : "mt-3"}>
            <div className="font-disp font-bold uppercase leading-none tracking-wide">
              Riquelme
            </div>
            <div className="text-[11px] text-mut uppercase tracking-widest mt-0.5">
              Fábrica de blocos
            </div>
          </div>
        </div>
        <div className={(menuCompacto ? "px-3 text-center" : "px-4") + " pb-3"}>
          <button onClick={sair} className="text-xs text-mut hover:text-white underline">
            Sair
          </button>
        </div>
        <nav className="flex-1 px-2 overflow-y-auto scroll-slim">
          {GRUPOS_NAVEGACAO.map((grupo) => (
            <div key={grupo.titulo} className="mb-4">
              {!menuCompacto && <div className="px-3 mb-1 text-[10px] uppercase tracking-widest text-zinc-600">{grupo.titulo}</div>}
              {grupo.ids.map((id) => {
                const n = NAV.find((item) => item.id === id);
                if (!n) return null;
                return (
                  <button
                    key={n.id}
                    onClick={() => setAba(n.id)}
                    title={n.label}
                    className={
                      "w-full flex items-center " + (menuCompacto ? "justify-center px-2" : "gap-3 px-3") + " py-2.5 text-sm font-disp uppercase tracking-wide border-l-2 transition-colors whitespace-nowrap " +
                      (aba === n.id ? "border-acc text-white bg-panel2" : "border-transparent text-mut hover:text-zinc-200 hover:bg-panel2/50")
                    }
                  >
                    <span className="text-acc">{n.icone}</span>
                    {!menuCompacto && n.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={(menuCompacto ? "px-2 text-center" : "px-4") + " py-4 font-mono border-t border-line"}>
          {podeExcluir && (
            <button
              onClick={() => setAba("auditoria")}
              className={
                "w-full text-left mb-4 border-l-2 px-3 py-2 text-[11px] uppercase tracking-widest transition-colors " +
                (aba === "auditoria" ? "border-acc bg-panel2 text-white" : "border-transparent text-mut hover:text-white")
              }
            >
              ◫ Auditoria
            </button>
          )}
          <div className={(menuCompacto ? "hidden" : "") + " text-[10px] uppercase tracking-widest text-zinc-500"}>Conta logada</div>
          <div className={(menuCompacto ? "hidden" : "mt-1") + " text-[10px] uppercase tracking-widest text-acc"}>{podeExcluir ? "Administrador" : "Operador"}</div>
          <div className={(menuCompacto ? "text-xs" : "mt-1 text-[11px] truncate") + " text-zinc-300"} title={sessao?.user?.email || ""}>
            {menuCompacto ? sessao?.user?.email?.slice(0, 1).toUpperCase() : sessao?.user?.email}
          </div>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-panel/95 backdrop-blur border-b border-line flex items-center justify-between px-4">
        <div><div className="font-disp text-sm uppercase text-white">Riquelme</div><div className="text-[10px] uppercase tracking-widest text-mut">{tituloAba}</div></div>
        <button onClick={sair} className="text-xs text-mut underline">Sair</button>
      </div>
      {menuMobileAberto && (
        <div className="md:hidden fixed bottom-16 inset-x-3 z-40 bg-panel border border-line p-3 shadow-2xl grid grid-cols-2 gap-2">
          {NAV.filter((item) => !["painel", "pedidos", "agenda"].includes(item.id)).map((item) => <button key={item.id} onClick={() => { setAba(item.id); setMenuMobileAberto(false); }} className="text-left px-3 py-2 text-xs font-disp uppercase text-mut hover:text-white hover:bg-panel2"><span className="text-acc mr-2">{item.icone}</span>{item.label}</button>)}
          {podeExcluir && <button onClick={() => { setAba("auditoria"); setMenuMobileAberto(false); }} className="text-left px-3 py-2 text-xs font-disp uppercase text-mut hover:text-white hover:bg-panel2"><span className="text-acc mr-2">◫</span>Auditoria</button>}
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-panel/95 backdrop-blur border-t border-line grid grid-cols-4">
        {[{ id: "painel", label: "Painel", icon: "◈" }, { id: "pedidos", label: "Pedidos", icon: "▤" }, { id: "agenda", label: "Agenda", icon: "◫" }].map((item) => <button key={item.id} onClick={() => { setAba(item.id); setMenuMobileAberto(false); }} className={(aba === item.id ? "text-acc" : "text-mut") + " flex flex-col items-center justify-center text-[10px] font-disp uppercase"}><span className="text-base leading-none mb-1">{item.icon}</span>{item.label}</button>)}
        <button onClick={() => setMenuMobileAberto(!menuMobileAberto)} className={(menuMobileAberto ? "text-acc" : "text-mut") + " flex flex-col items-center justify-center text-[10px] font-disp uppercase"}><span className="text-base leading-none mb-1">☰</span>Mais</button>
      </nav>

      {/* ---------- Conteúdo ---------- */}
      <main className="flex-1 min-w-0 px-4 md:px-8 pt-20 pb-24 md:pt-0 md:pb-6 md:h-screen md:overflow-y-auto md:overscroll-contain scroll-slim">
        <div className="hidden md:flex sticky top-0 z-20 -mx-2 px-2 py-3 mb-4 bg-base border-b border-line shadow-[0_8px_14px_#0b0b0d] items-center justify-between">
          <div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Gestão operacional</div><div className="font-disp text-lg uppercase text-white">{tituloAba}</div></div>
          <div className="text-xs font-mono text-mut">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</div>
        </div>
        {!configurado && (
          <div className="mb-6 border border-acc/40 bg-acc/10 px-4 py-3 text-sm text-amber-200">
            Banco de dados ainda não configurado — preencha as chaves do Supabase em{" "}
            <code className="font-mono">lib/supabase.ts</code>.
          </div>
        )}

        {carregando ? (
          <Spinner />
        ) : (
          <div key={aba} className="page-enter">
            {aba === "painel" && (
              <Painel clientes={clientes} pedidos={pedidos} produtos={produtos} nomeCliente={nomeCliente} onAgenda={() => setAba("agenda")} />
            )}
            {aba === "clientes" && (
              <Clientes
                clientes={clientes}
                pedidos={pedidos}
                onNovo={() => setModal({ tipo: "cliente" })}
                onEditar={(c: Cliente) => setModal({ tipo: "cliente", dado: c })}
                onExcluir={excluirCliente}
                podeExcluir={podeExcluir}
              />
            )}
            {aba === "pedidos" && (
              <Pedidos
                pedidos={pedidos}
                produtos={produtos}
                clientes={clientes}
                nomeCliente={nomeCliente}
                onNovo={novoPedido}
                onEditar={(p: Pedido) => setModal({ tipo: "pedido", dado: p })}
                onStatus={mudarStatus}
                onExcluir={excluirPedido}
                podeExcluir={podeExcluir}
                onWhatsApp={enviarWhatsApp}
                onImprimir={imprimirPedido}
                onComprovante={enviarComprovante}
                onVerComprovante={verComprovante}
              />
            )}
            {aba === "agenda" && (
              <Agenda pedidos={pedidos} nomeCliente={nomeCliente} onNovo={novoPedido} onEditar={(p: Pedido) => setModal({ tipo: "pedido", dado: p })} />
            )}
            {aba === "produtos" && (
              <Produtos produtos={produtos} recarregar={carregar} avisar={avisar} podeExcluir={podeExcluir} />
            )}
            {aba === "estoque" && <Estoque produtos={produtos} recarregar={carregar} avisar={avisar} />}
            {aba === "producao" && <Producao pedidos={pedidos} produtos={produtos} />}
            {aba === "relatorios" && <Relatorios pedidos={pedidos} produtos={produtos} nomeCliente={nomeCliente} />}
            {aba === "auditoria" && podeExcluir && <Auditoria />}
          </div>
        )}
      </main>

      {/* ---------- Modais e toast ---------- */}
      {modal?.tipo === "cliente" && (
        <FormCliente dado={modal.dado} onSalvar={salvarCliente} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === "pedido" && (
        <FormPedido
          dado={modal.dado}
          statusInicial={modal.statusInicial}
          clientes={clientes}
          produtos={produtos}
          onSalvar={salvarPedido}
          onFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === "aviso-pedido" && (
        <Modal titulo="Aviso" onFechar={() => setModal(null)} centralizado>
          <p className="text-sm text-zinc-300 leading-6">
            Primeiro voce precisa cadastrar o cliente na aba{" "}
            <span className="text-white font-semibold">Clientes</span>. Depois disso, volte para{" "}
            <span className="text-white font-semibold">Pedidos</span> para criar o pedido.
          </p>
          <div className="flex justify-end gap-2 mt-5">
            <Btn variant="ghost" onClick={() => setModal(null)}>Fechar</Btn>
            <Btn
              onClick={() => {
                setModal(null);
                setAba("clientes");
              }}
            >
              Ir para clientes
            </Btn>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-acc text-base font-disp uppercase text-sm px-4 py-2 shadow-lg z-50 toast-enter">
          {toast}
        </div>
      )}
    </div>
  );
}

// ================= Painel =================
function Painel({ clientes, pedidos, produtos, nomeCliente, onAgenda }: any) {
  const agora = new Date();
  const doMes = (t: string) => {
    const d = new Date(t);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  };
  const fatMes = pedidos
    .filter((p: Pedido) => p.status === "entregue" && doMes(p.criado_em))
    .reduce((s: number, p: Pedido) => s + Number(p.total), 0);
  const faturamentoTotal = pedidos
    .filter((p: Pedido) => p.status === "entregue")
    .reduce((s: number, p: Pedido) => s + Number(p.total), 0);

  const porStatus = (id: string) => pedidos.filter((p: Pedido) => p.status === id).length;

  const proximas = pedidos
    .filter((p: Pedido) => p.status !== "entregue" && p.data_entrega)
    .sort((a: Pedido, b: Pedido) => (a.data_entrega! > b.data_entrega! ? 1 : -1))
    .slice(0, 6);

  const stats = [
    { label: "Clientes", valor: clientes.length },
    { label: "Orçamentos abertos", valor: porStatus("orcamento") },
    { label: "Em produção", valor: porStatus("confirmado") + porStatus("producao") },
    { label: "Faturado no mês", valor: fatMes, moeda: true },
  ];

  const totalPed = pedidos.length || 1;
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const emDoisDias = new Date(inicioHoje);
  emDoisDias.setDate(emDoisDias.getDate() + 2);
  const entregasAtrasadas = pedidos.filter((p: Pedido) => p.status !== "entregue" && p.data_entrega && new Date(p.data_entrega + "T12:00") < inicioHoje);
  const entregasProximas = pedidos.filter((p: Pedido) => p.status !== "entregue" && p.data_entrega && new Date(p.data_entrega + "T12:00") >= inicioHoje && new Date(p.data_entrega + "T12:00") <= emDoisDias);
  const orcamentosAntigos = pedidos.filter((p: Pedido) => p.status === "orcamento" && (Date.now() - new Date(p.criado_em).getTime()) > 7 * 86400000);
  const estoqueCritico = produtos.filter((produto: Produto) => Number(produto.estoque_atual || 0) <= Number(produto.estoque_minimo || 0));
  const producaoPendente = pedidos
    .filter((pedido: Pedido) => pedido.status === "confirmado" || pedido.status === "producao")
    .reduce((s: number, pedido: Pedido) => s + pedido.itens.reduce((subtotal, item) => subtotal + Number(item.qtd || 0), 0), 0);
  const meses = Array.from({ length: 6 }, (_, indice) => {
    const data = new Date(agora.getFullYear(), agora.getMonth() - (5 - indice), 1);
    const valor = pedidos.filter((pedido: Pedido) => pedido.status === "entregue" && new Date(pedido.criado_em).getMonth() === data.getMonth() && new Date(pedido.criado_em).getFullYear() === data.getFullYear()).reduce((s: number, pedido: Pedido) => s + Number(pedido.total), 0);
    return { label: data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), valor };
  });
  const maiorMes = Math.max(...meses.map((mes) => mes.valor), 1);
  const clientesRanking = clientes.map((cliente: Cliente) => ({ cliente, total: pedidos.filter((pedido: Pedido) => pedido.cliente_id === cliente.id).reduce((s: number, pedido: Pedido) => s + Number(pedido.total), 0) })).filter((linha) => linha.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  return (
    <div>
      <h1 className="font-disp text-2xl font-bold uppercase tracking-wide mb-6">Painel</h1>

      {(entregasAtrasadas.length > 0 || entregasProximas.length > 0 || orcamentosAntigos.length > 0) && (
        <div className="grid gap-2 mb-5">
          {entregasAtrasadas.length > 0 && <button onClick={onAgenda} className="text-left border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{entregasAtrasadas.length} entrega(s) atrasada(s). Ver agenda.</button>}
          {entregasProximas.length > 0 && <button onClick={onAgenda} className="text-left border border-acc/40 bg-acc/10 px-4 py-3 text-sm text-amber-100">{entregasProximas.length} entrega(s) prevista(s) para os próximos 2 dias.</button>}
          {orcamentosAntigos.length > 0 && <div className="border border-line bg-panel px-4 py-3 text-sm text-zinc-300">{orcamentosAntigos.length} orçamento(s) aguardando resposta há mais de 7 dias.</div>}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map(({ label, valor, moeda }, i) => (
          <div key={label} className="surface-card p-4 relative overflow-hidden card-enter" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="absolute top-0 left-0 w-8 h-0.5 bg-acc" />
            <div className="text-[11px] font-disp uppercase tracking-widest text-mut">{label}</div>
            <div className="font-mono text-2xl mt-2 text-white"><NumeroAnimado valor={valor} moeda={moeda} /></div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-8">
        <div className="bg-panel border border-line p-4">
          <div className="flex items-center justify-between mb-5"><h2 className="font-disp uppercase tracking-wide text-mut text-sm">Faturamento · últimos 6 meses</h2><span className="text-xs font-mono text-acc">{brl(faturamentoTotal)}</span></div>
          <div className="h-40 flex items-end gap-3">
            {meses.map((mes) => <div key={mes.label} className="flex-1 min-w-0 h-full flex flex-col justify-end"><div className="w-full bg-acc/80 hover:bg-acc transition-colors" style={{ height: `${Math.max((mes.valor / maiorMes) * 100, mes.valor > 0 ? 6 : 1)}%` }} title={`${mes.label}: ${brl(mes.valor)}`} /><div className="text-center text-[10px] text-mut uppercase mt-2">{mes.label}</div></div>)}
          </div>
        </div>
        <div className="bg-panel border border-line p-4">
          <h2 className="font-disp uppercase tracking-wide text-mut text-sm mb-5">Resumo operacional</h2>
          <div className="grid grid-cols-2 gap-3"><div className="border border-line bg-panel2 p-3"><div className="text-xs text-mut">Produção pendente</div><div className="font-mono text-xl text-white mt-2">{producaoPendente} un.</div></div><div className={(estoqueCritico.length > 0 ? "border-red-500/40" : "border-line") + " border bg-panel2 p-3"}><div className="text-xs text-mut">Estoque crítico</div><div className={(estoqueCritico.length > 0 ? "text-red-300" : "text-emerald-300") + " font-mono text-xl mt-2"}>{estoqueCritico.length}</div></div></div>
          <div className="mt-4 text-xs text-mut">{estoqueCritico.length > 0 ? `Atenção: ${estoqueCritico.map((produto: Produto) => produto.nome).join(", ")}` : "Todos os produtos estão acima do estoque mínimo."}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="bg-panel border border-line p-4">
          <h2 className="font-disp uppercase tracking-wide text-mut text-sm mb-4">Melhores clientes</h2>
          {clientesRanking.length === 0 ? <p className="text-sm text-mut">Ainda não há vendas registradas.</p> : <div className="space-y-3">{clientesRanking.map((linha, indice) => <div key={linha.cliente.id} className="flex items-center gap-3"><span className="font-mono text-acc w-5">{indice + 1}</span><span className="flex-1 text-sm text-zinc-200 truncate">{linha.cliente.nome}</span><span className="font-mono text-sm text-white">{brl(linha.total)}</span></div>)}</div>}
        </div>
        <div className="bg-panel border border-line p-4">
          <h2 className="font-disp uppercase tracking-wide text-mut text-sm mb-4">Visão rápida</h2>
          <div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-mut">Pedidos entregues</span><span className="font-mono">{porStatus("entregue")}</span></div><div className="flex justify-between"><span className="text-mut">Orçamentos em aberto</span><span className="font-mono">{porStatus("orcamento")}</span></div><div className="flex justify-between"><span className="text-mut">Entregas próximas</span><span className="font-mono">{entregasProximas.length}</span></div><div className="flex justify-between"><span className="text-mut">Clientes ativos</span><span className="font-mono">{clientesRanking.length}</span></div></div>
        </div>
      </div>

      {/* pipeline */}
      <div className="mt-8">
        <h2 className="font-disp uppercase tracking-wide text-mut text-sm mb-3">
          Pipeline de pedidos
        </h2>
        <div className="flex h-3 w-full border border-line bg-panel overflow-hidden">
          {STATUS.map((s) => {
            const n = porStatus(s.id);
            return n > 0 ? (
              <div key={s.id} className="pipeline-fill" style={{ width: `${(n / totalPed) * 100}%`, background: s.cor }} />
            ) : null;
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          {STATUS.map((s) => (
            <span key={s.id} className="text-xs text-mut flex items-center gap-1.5">
              <span className="w-2 h-2 inline-block" style={{ background: s.cor }} />
              {s.label} · {porStatus(s.id)}
            </span>
          ))}
        </div>
      </div>

      <h2 className="font-disp uppercase tracking-wide text-mut text-sm mt-8 mb-3">
        Próximas entregas
      </h2>
      {proximas.length === 0 ? (
        <Empty texto="Nenhuma entrega agendada. Pedidos com data aparecem aqui." />
      ) : (
        <div className="bg-panel border border-line divide-y divide-line">
          {proximas.map((p: Pedido, i: number) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 card-enter" style={{ animationDelay: `${i * 55}ms` }}>
              <div>
                <div className="text-sm text-white">{nomeCliente(p.cliente_id)}</div>
                <div className="text-xs text-mut font-mono mt-0.5">
                  {new Date(p.data_entrega + "T12:00").toLocaleDateString("pt-BR")} · {brl(Number(p.total))}
                </div>
              </div>
              <Chip status={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================= Clientes =================
function Auditoria() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregarAuditoria = useCallback(async () => {
    setCarregando(true);
    setErro("");
    const { data, error } = await supabase
      .from("crmriq_auditoria")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) setErro("Não foi possível carregar a auditoria.");
    setRegistros(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregarAuditoria();
  }, [carregarAuditoria]);

  const nomes: Record<string, string> = {
    crmriq_clientes: "Cliente",
    crmriq_produtos: "Produto",
    crmriq_pedidos: "Pedido",
  };
  const acoes: Record<string, string> = { insert: "Criou", update: "Alterou", delete: "Excluiu" };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Auditoria</h1>
          <p className="text-sm text-mut mt-1">Últimas 100 ações registradas no CRM.</p>
        </div>
        <Btn variant="ghost" onClick={carregarAuditoria}>Atualizar</Btn>
      </div>

      {carregando ? (
        <Spinner />
      ) : erro ? (
        <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{erro}</div>
      ) : registros.length === 0 ? (
        <Empty texto="Nenhuma ação foi registrada desde a ativação da auditoria." />
      ) : (
        <div className="bg-panel border border-line divide-y divide-line">
          {registros.map((registro) => {
            return (
              <details key={registro.id} className="group px-4 py-3 card-enter">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white">
                      <span className="font-disp uppercase text-acc">{acoes[registro.acao] || registro.acao}</span>{" "}
                      {nomes[registro.entidade] || registro.entidade}
                    </div>
                    <div className="mt-1 text-xs font-mono text-mut">{registro.usuario_email || "Usuário não identificado"}</div>
                  </div>
                  <time className="shrink-0 text-xs text-zinc-500 font-mono">
                    {new Date(registro.criado_em).toLocaleString("pt-BR")}
                  </time>
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto bg-panel2 border border-line p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap">
                  {JSON.stringify({ antes: registro.antes, depois: registro.depois }, null, 2)}
                </pre>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Clientes({ clientes, pedidos, onNovo, onEditar, onExcluir, podeExcluir }: any) {
  const [busca, setBusca] = useState("");
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const lista = clientes.filter((c: Cliente) =>
    (c.nome + " " + (c.cidade || "")).toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Clientes</h1>
        <div className="flex gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome ou cidade"
            className={inp + " w-56"}
          />
          <Btn onClick={onNovo}>+ Novo</Btn>
        </div>
      </div>

      {lista.length === 0 ? (
        <Empty
          texto="Nenhum cliente encontrado."
          acao={!busca && <Btn onClick={onNovo}>Cadastrar primeiro cliente</Btn>}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map((c: Cliente, i: number) => {
            const n = pedidos.filter((p: Pedido) => p.cliente_id === c.id).length;
            const tel = (c.telefone || "").replace(/\D/g, "");
            return (
              <div key={c.id} className="bg-panel border border-line p-4 flex flex-col card-enter" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <div className="flex justify-between items-start gap-2">
                  <div className="font-disp font-semibold text-white">{c.nome}</div>
                  <span className="text-[11px] font-mono text-mut whitespace-nowrap">
                    {n} pedido{n !== 1 && "s"}
                  </span>
                </div>
                <div className="text-xs text-mut mt-1">
                  {[c.tipo, c.cidade].filter(Boolean).join(" · ")}
                </div>
                {c.telefone && <div className="text-xs text-mut font-mono mt-0.5">{c.telefone}</div>}
                {c.obs && (
                  <div className="text-xs text-zinc-400 mt-2 border-t border-line pt-2">{c.obs}</div>
                )}
                <div className="flex gap-2 mt-4 pt-3 border-t border-line items-center">
                  {tel && (
                    <a
                      href={`https://wa.me/55${tel}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-disp uppercase tracking-wide px-3 py-1.5 bg-emerald-600/90 text-white hover:bg-emerald-500"
                    >
                      WhatsApp
                    </a>
                  )}
                  <button onClick={() => onEditar(c)} className="text-xs text-mut hover:text-white underline">
                    Editar
                  </button>
                  {podeExcluir && (confirmar === c.id ? (
                    <button
                      onClick={() => { onExcluir(c.id); setConfirmar(null); }}
                      className="text-xs text-red-400 hover:text-red-300 underline ml-auto"
                    >
                      Confirmar exclusão?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmar(c.id)}
                      className="text-xs text-zinc-600 hover:text-red-400 underline ml-auto"
                    >
                      Excluir
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================= Estoque =================
function Estoque({ produtos, recarregar, avisar }: any) {
  const [edits, setEdits] = useState<Record<string, { atual?: string; minimo?: string }>>({});

  const salvar = async (produto: Produto) => {
    const edit = edits[produto.id];
    if (!edit) return;
    const { error } = await supabase.from("crmriq_produtos").update({
      estoque_atual: Math.max(0, Number(edit.atual ?? produto.estoque_atual) || 0),
      estoque_minimo: Math.max(0, Number(edit.minimo ?? produto.estoque_minimo) || 0),
    }).eq("id", produto.id);
    if (error) {
      avisar("Não foi possível atualizar o estoque");
      return;
    }
    setEdits((atual: any) => {
      const proximo = { ...atual };
      delete proximo[produto.id];
      return proximo;
    });
    avisar("Estoque atualizado");
    recarregar();
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Estoque</h1>
        <p className="text-sm text-mut mt-1">Controle manual dos blocos prontos disponíveis para entrega.</p>
      </div>
      {produtos.length === 0 ? <Empty texto="Cadastre produtos para começar o controle de estoque." /> : (
        <div className="bg-panel border border-line divide-y divide-line">
          {produtos.map((produto: Produto, i: number) => {
            const edit = edits[produto.id] || {};
            const atual = Number(edit.atual ?? produto.estoque_atual ?? 0);
            const minimo = Number(edit.minimo ?? produto.estoque_minimo ?? 0);
            const baixo = atual <= minimo;
            const alterado = edit.atual !== undefined || edit.minimo !== undefined;
            return (
              <div key={produto.id} className="card-enter grid grid-cols-[minmax(0,1fr)_5rem_5rem_auto] sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] items-center gap-3 px-4 py-3" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <div className="min-w-0"><div className="text-sm text-white truncate">{produto.nome}</div><div className={(baixo ? "text-red-300" : "text-zinc-500") + " text-xs mt-1"}>{baixo ? "Estoque baixo" : "Estoque regular"}</div></div>
                <label className="text-xs text-mut">Atual<input type="number" min="0" value={edit.atual ?? produto.estoque_atual ?? 0} onChange={(e) => setEdits({ ...edits, [produto.id]: { ...edit, atual: e.target.value } })} className={inp + " mt-1 text-right font-mono"} /></label>
                <label className="text-xs text-mut">Mínimo<input type="number" min="0" value={edit.minimo ?? produto.estoque_minimo ?? 0} onChange={(e) => setEdits({ ...edits, [produto.id]: { ...edit, minimo: e.target.value } })} className={inp + " mt-1 text-right font-mono"} /></label>
                {alterado && <button onClick={() => salvar(produto)} className="text-xs font-disp uppercase text-acc hover:text-amber-300">Salvar</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================= Produção =================
function Producao({ pedidos, produtos }: any) {
  const necessidades = new Map<string, number>();
  pedidos.filter((pedido: Pedido) => pedido.status === "confirmado" || pedido.status === "producao").forEach((pedido: Pedido) => {
    pedido.itens.forEach((item) => necessidades.set(item.produto_id, (necessidades.get(item.produto_id) || 0) + Number(item.qtd || 0)));
  });
  const linhas = [...necessidades.entries()].map(([produtoId, quantidade]) => ({ produto: produtos.find((p: Produto) => p.id === produtoId), quantidade })).filter((linha) => linha.produto);

  return (
    <div className="max-w-4xl">
      <div className="mb-6"><h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Produção</h1><p className="text-sm text-mut mt-1">Necessidade baseada nos pedidos confirmados e em produção.</p></div>
      {linhas.length === 0 ? <Empty texto="Nenhum bloco pendente de produção." /> : (
        <div className="bg-panel border border-line divide-y divide-line">
          {linhas.map((linha: any, i: number) => {
            const falta = Math.max(0, linha.quantidade - Number(linha.produto.estoque_atual || 0));
            return <div key={linha.produto.id} className="card-enter flex items-center justify-between gap-4 px-4 py-4" style={{ animationDelay: `${i * 55}ms` }}><div><div className="text-white text-sm">{linha.produto.nome}</div><div className="text-xs text-mut mt-1">Estoque atual: {linha.produto.estoque_atual || 0}</div></div><div className="text-right"><div className="font-mono text-lg text-white">{linha.quantidade} un.</div><div className={(falta > 0 ? "text-red-300" : "text-emerald-300") + " text-xs mt-1"}>{falta > 0 ? `Produzir ${falta}` : "Estoque suficiente"}</div></div></div>;
          })}
        </div>
      )}
    </div>
  );
}

// ================= Relatórios =================
function Relatorios({ pedidos, produtos, nomeCliente }: any) {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const lista = pedidos.filter((pedido: Pedido) => pedido.criado_em.slice(0, 7) === mes);
  const entregues = lista.filter((pedido: Pedido) => pedido.status === "entregue");
  const faturado = entregues.reduce((s: number, pedido: Pedido) => s + Number(pedido.total), 0);
  const aberto = lista.filter((pedido: Pedido) => pedido.status !== "entregue").reduce((s: number, pedido: Pedido) => s + Number(pedido.total), 0);
  const exportar = (nome: string, cabecalho: string[], linhas: (string | number)[][]) => {
    const escapar = (valor: string | number) => `"${String(valor ?? "").replace(/"/g, '""')}"`;
    const csv = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = nome; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="max-w-5xl"><div className="flex items-end justify-between gap-4 mb-6 flex-wrap"><div><h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Relatórios</h1><p className="text-sm text-mut mt-1">Resultados, pedidos e exportação para Excel.</p></div><label className="text-xs text-mut">Mês<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inp + " mt-1"} /></label></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="bg-panel border border-line p-4"><div className="text-xs text-mut uppercase">Faturado</div><div className="font-mono text-2xl mt-2">{brl(faturado)}</div></div><div className="bg-panel border border-line p-4"><div className="text-xs text-mut uppercase">Em aberto</div><div className="font-mono text-2xl mt-2">{brl(aberto)}</div></div><div className="bg-panel border border-line p-4"><div className="text-xs text-mut uppercase">Pedidos</div><div className="font-mono text-2xl mt-2">{lista.length}</div></div></div><div className="flex gap-3 mt-5 flex-wrap"><Btn variant="ghost" onClick={() => exportar(`pedidos-${mes}.csv`, ["Cliente", "Status", "Entrega", "Total"], lista.map((p: Pedido) => [nomeCliente(p.cliente_id), p.status, p.data_entrega || "", Number(p.total)]))}>Exportar pedidos</Btn><Btn variant="ghost" onClick={() => exportar("produtos.csv", ["Produto", "Preço", "Estoque"], produtos.map((p: Produto) => [p.nome, p.preco, p.estoque_atual || 0]))}>Exportar produtos</Btn></div></div>;
}

// ================= Agenda =================
function Agenda({ pedidos, nomeCliente, onNovo, onEditar }: any) {
  const entregas = pedidos
    .filter((p: Pedido) => p.data_entrega)
    .sort((a: Pedido, b: Pedido) => (a.data_entrega! > b.data_entrega! ? 1 : -1));

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Agenda de entregas</h1>
          <p className="text-sm text-mut mt-1">Acompanhe e programe as próximas entregas.</p>
        </div>
        <Btn onClick={() => onNovo("producao")}>+ Agendar entrega</Btn>
      </div>

      {entregas.length === 0 ? (
        <Empty texto="Nenhuma entrega agendada. Crie ou edite um pedido e informe a data de entrega." acao={<Btn onClick={() => onNovo("producao")}>+ Agendar entrega</Btn>} />
      ) : (
        <div className="bg-panel border border-line divide-y divide-line">
          {entregas.map((pedido: Pedido, i: number) => {
            const data = new Date(pedido.data_entrega + "T12:00");
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const atrasada = data < hoje && pedido.status !== "entregue";
            return (
              <button
                key={pedido.id}
                onClick={() => onEditar(pedido)}
                className="card-enter w-full px-4 py-4 flex items-center gap-4 text-left hover:bg-panel2 transition-colors"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <div className={(atrasada ? "border-red-400 text-red-300" : "border-acc text-acc") + " w-16 shrink-0 border py-2 text-center font-mono"}>
                  <div className="text-xl leading-none">{data.getDate().toString().padStart(2, "0")}</div>
                  <div className="text-[10px] uppercase mt-1">{data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white font-medium truncate">{nomeCliente(pedido.cliente_id)}</div>
                  <div className="text-xs text-mut font-mono mt-1">{atrasada ? "entrega atrasada" : data.toLocaleDateString("pt-BR", { weekday: "long" })} · {brl(Number(pedido.total))}</div>
                </div>
                <Chip status={pedido.status} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================= Pedidos =================
function Pedidos({ pedidos, produtos, clientes, nomeCliente, onNovo, onEditar, onStatus, onExcluir, podeExcluir, onWhatsApp, onImprimir, onComprovante, onVerComprovante }: any) {
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [acoesAbertas, setAcoesAbertas] = useState<string | null>(null);
  const lista = pedidos.filter((p: Pedido) => {
    const data = p.data_entrega || p.criado_em.slice(0, 10);
    const correspondeBusca = (nomeCliente(p.cliente_id) + " " + p.status).toLowerCase().includes(busca.toLowerCase());
    return (filtro === "todos" || p.status === filtro) && correspondeBusca && (!inicio || data >= inicio) && (!fim || data <= fim);
  });
  const podeCriarPedido = clientes.length > 0;
  const etapa = STATUS.find((s) => s.id === filtro);
  const statusInicial = etapa?.id || "orcamento";
  const nomeAcao = etapa?.id === "orcamento" ? "Novo orçamento" : etapa ? `Novo pedido — ${etapa.label}` : "Novo pedido";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Pedidos</h1>
        <Btn onClick={() => onNovo(statusInicial)}>
          + {nomeAcao}
        </Btn>
      </div>

      <div className="flex gap-1 mb-5 flex-wrap">
        {[{ id: "todos", label: "Todos" }, ...STATUS].map((s: any) => (
          <button
            key={s.id}
            onClick={() => setFiltro(s.id)}
            className={
              "text-xs font-disp uppercase tracking-wide px-3 py-1.5 border transition-colors " +
              (filtro === s.id
                ? "bg-acc text-base border-acc"
                : "border-line text-mut hover:text-white hover:border-mut")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_10rem_10rem] gap-2 mb-5">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente ou status" className={inp} />
        <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={inp} title="Data inicial" />
        <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={inp} title="Data final" />
      </div>

      {!podeCriarPedido ? (
        <Empty
          texto={
            clientes.length === 0
              ? "Cadastre um cliente primeiro na aba Clientes para criar pedidos."
              : ""
          }
          acao={<Btn onClick={() => onNovo(statusInicial)}>+ {nomeAcao}</Btn>}
        />
      ) : lista.length === 0 ? (
        <Empty texto={etapa ? `Nenhum pedido em ${etapa.label.toLowerCase()}.` : "Nenhum pedido cadastrado ainda."} acao={<Btn onClick={() => onNovo(statusInicial)}>+ {nomeAcao}</Btn>} />
      ) : (
        <div className="space-y-3">
          {lista.map((p: Pedido, i: number) => (
            <div key={p.id} className="bg-panel border border-line card-enter" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <div className="px-4 py-3 flex justify-between items-start gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-disp font-semibold text-white">
                      {nomeCliente(p.cliente_id)}
                    </span>
                    <Chip status={p.status} />
                  </div>
                  <div className="text-xs text-mut font-mono mt-1">
                    {p.data_entrega
                      ? "entrega " + new Date(p.data_entrega + "T12:00").toLocaleDateString("pt-BR")
                      : "sem data de entrega"}
                    {" · criado " + new Date(p.criado_em).toLocaleDateString("pt-BR")}
                  </div>
                  <ul className="text-sm text-zinc-300 mt-2 space-y-0.5">
                    {p.itens.map((it: Item, i: number) => {
                      const pr = produtos.find((x: Produto) => x.id === it.produto_id);
                      return (
                        <li key={i} className="flex gap-2">
                          <span className="font-mono text-acc w-16 text-right">{it.qtd}x</span>
                          <span>{pr ? pr.nome : "produto removido"}</span>
                          {pr && (
                            <span className="text-zinc-500 font-mono">
                              {brl(pr.preco * it.qtd)}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xl text-white">{brl(Number(p.total))}</div>
                  <select
                    value={p.status}
                    onChange={(e) => onStatus(p.id, e.target.value)}
                    className="mt-2 bg-panel2 border border-line text-xs px-2 py-1.5 text-zinc-200"
                  >
                    {STATUS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <div className="relative mt-2 flex justify-end text-xs">
                    <button onClick={() => setAcoesAbertas(acoesAbertas === p.id ? null : p.id)} className="border border-line px-2 py-1 text-mut hover:text-white hover:border-mut">Ações ▾</button>
                    {acoesAbertas === p.id && (
                      <div className="absolute right-0 top-8 z-10 w-40 bg-panel border border-line shadow-xl text-left py-1">
                        <button onClick={() => { onImprimir(p); setAcoesAbertas(null); }} className="w-full px-3 py-2 text-acc hover:bg-panel2">Gerar PDF</button>
                        <button onClick={() => { onWhatsApp(p); setAcoesAbertas(null); }} className="w-full px-3 py-2 text-emerald-300 hover:bg-panel2">Enviar WhatsApp</button>
                        <label className="block px-3 py-2 text-sky-300 hover:bg-panel2 cursor-pointer">Anexar entrega<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const arquivo = e.target.files?.[0]; if (arquivo) onComprovante(p, arquivo); e.currentTarget.value = ""; setAcoesAbertas(null); }} /></label>
                        {p.comprovante_path && <button onClick={() => { onVerComprovante(p); setAcoesAbertas(null); }} className="w-full px-3 py-2 text-sky-300 hover:bg-panel2">Ver comprovante</button>}
                        <button onClick={() => { onEditar(p); setAcoesAbertas(null); }} className="w-full px-3 py-2 text-zinc-300 hover:bg-panel2">Editar</button>
                        {podeExcluir && (confirmar === p.id ? <button onClick={() => { onExcluir(p.id); setConfirmar(null); setAcoesAbertas(null); }} className="w-full px-3 py-2 text-red-300 hover:bg-panel2">Confirmar exclusão</button> : <button onClick={() => setConfirmar(p.id)} className="w-full px-3 py-2 text-red-400 hover:bg-panel2">Excluir</button>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================= Produtos =================
function Produtos({ produtos, recarregar, avisar, podeExcluir }: any) {
  const [novo, setNovo] = useState({ nome: "", preco: "" });
  const [edits, setEdits] = useState<any>({});

  const salvarLinha = async (p: Produto) => {
    const e = edits[p.id];
    if (!e) return;
    await supabase
      .from("crmriq_produtos")
      .update({ nome: e.nome ?? p.nome, preco: Number(e.preco ?? p.preco) || 0 })
      .eq("id", p.id);
    setEdits((x: any) => {
      const y = { ...x };
      delete y[p.id];
      return y;
    });
    avisar("Preço atualizado");
    recarregar();
  };

  const excluir = async (id: string) => {
    await supabase.from("crmriq_produtos").delete().eq("id", id);
    recarregar();
  };

  const adicionar = async () => {
    if (!novo.nome.trim()) return;
    await supabase
      .from("crmriq_produtos")
      .insert({ nome: novo.nome.trim(), preco: Number(novo.preco) || 0 });
    setNovo({ nome: "", preco: "" });
    avisar("Produto adicionado");
    recarregar();
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Produtos</h1>
        <p className="text-sm text-mut mt-1">Cadastre os blocos e mantenha os preços unitários atualizados.</p>
      </div>

      <div className="bg-panel border border-line divide-y divide-line">
        {produtos.map((p: Produto) => {
          const e = edits[p.id] || {};
          const alterado = e.nome !== undefined || e.preco !== undefined;
          return (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
              <input
                value={e.nome ?? p.nome}
                onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, nome: ev.target.value } })}
                className="flex-1 min-w-0 bg-transparent border border-transparent hover:border-line focus:border-acc outline-none px-2 py-1 text-sm"
              />
              <span className="text-mut text-xs font-mono">R$</span>
              <input
                type="number"
                step="0.10"
                value={e.preco ?? p.preco}
                onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, preco: ev.target.value } })}
                className="w-24 bg-transparent border border-transparent hover:border-line focus:border-acc outline-none px-2 py-1 text-sm text-right font-mono"
              />
              {alterado && (
                <button
                  onClick={() => salvarLinha(p)}
                  className="text-xs font-disp uppercase text-acc hover:text-amber-300"
                >
                  Salvar
                </button>
              )}
              {podeExcluir && (
              <button onClick={() => excluir(p.id)} className="text-zinc-600 hover:text-red-400 text-sm" aria-label="Excluir produto">
                ✕
              </button>
              )}
            </div>
          );
        })}
        {produtos.length === 0 && (
          <div className="px-5 py-7 text-sm text-mut">Nenhum produto cadastrado ainda. Cadastre o primeiro item no formulário abaixo.</div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-4 bg-panel border border-line p-4">
        <input
          value={novo.nome}
          onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          placeholder="Novo bloco (ex: Bloco 14x19x29)"
          className={inp + " w-full sm:!w-auto flex-1"}
        />
        <input
          type="number"
          step="0.10"
          value={novo.preco}
          onChange={(e) => setNovo({ ...novo, preco: e.target.value })}
          placeholder="Preço"
          className={inp + " w-full sm:!w-32 text-right font-mono"}
        />
        <Btn onClick={adicionar} disabled={!novo.nome.trim()} className="w-full sm:w-auto">
          Adicionar
        </Btn>
      </div>
      <p className="text-xs text-mut mt-3">
        Preço unitário por bloco. Pedidos já salvos mantêm o total calculado na época.
      </p>
    </div>
  );
}

// ================= Formulários =================
function FormCliente({ dado, onSalvar, onFechar }: any) {
  const [f, setF] = useState(
    dado
      ? { id: dado.id, nome: dado.nome, telefone: dado.telefone || "", cidade: dado.cidade || "", tipo: dado.tipo || TIPOS_CLIENTE[0], obs: dado.obs || "" }
      : { nome: "", telefone: "", cidade: "", tipo: TIPOS_CLIENTE[0], obs: "" }
  );
  const ok = f.nome.trim().length > 0;

  return (
    <Modal titulo={dado ? "Editar cliente" : "Novo cliente"} onFechar={onFechar}>
      <Field label="Nome *">
        <input className={inp} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus />
      </Field>
      <Field label="Telefone / WhatsApp">
        <input className={inp} value={f.telefone} placeholder="(32) 9xxxx-xxxx" onChange={(e) => setF({ ...f, telefone: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade">
          <input className={inp} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} />
        </Field>
        <Field label="Tipo">
          <select className={inp} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Observações">
        <textarea className={inp} rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onFechar}>Cancelar</Btn>
        <Btn disabled={!ok} onClick={() => onSalvar(f)}>Salvar</Btn>
      </div>
    </Modal>
  );
}

function FormPedido({ dado, statusInicial = "orcamento", clientes, produtos, onSalvar, onFechar }: any) {
  const [f, setF] = useState(
    dado
      ? { id: dado.id, cliente_id: dado.cliente_id, itens: dado.itens, status: dado.status, data_entrega: dado.data_entrega || "" }
      : {
          cliente_id: clientes[0]?.id || "",
          itens: [],
          status: statusInicial,
          data_entrega: "",
        }
  );

  const total = useMemo(
    () =>
      f.itens.reduce((s: number, it: Item) => {
        const p = produtos.find((x: Produto) => x.id === it.produto_id);
        return s + (p ? p.preco * (Number(it.qtd) || 0) : 0);
      }, 0),
    [f.itens, produtos]
  );

  const setItem = (i: number, patch: any) =>
    setF({ ...f, itens: f.itens.map((it: Item, j: number) => (j === i ? { ...it, ...patch } : it)) });

  const ok = f.cliente_id;

  return (
    <Modal titulo={dado ? "Editar pedido" : statusInicial === "orcamento" ? "Novo orçamento" : `Novo pedido — ${STATUS.find((s) => s.id === statusInicial)?.label || ""}`} onFechar={onFechar}>
      <Field label="Cliente">
        <select className={inp} value={f.cliente_id} onChange={(e) => setF({ ...f, cliente_id: e.target.value })}>
          {clientes.map((c: Cliente) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Itens">
        {f.itens.map((it: Item, i: number) => (
          <div key={i} className="flex gap-2 mb-2">
            <select
              className={inp + " flex-1"}
              value={it.produto_id}
              onChange={(e) => setItem(i, { produto_id: e.target.value })}
            >
              {produtos.map((p: Produto) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({brl(p.preco)})
                </option>
              ))}
            </select>
            <input
              type="number"
              className={inp + " w-24 text-right font-mono"}
              value={it.qtd}
              onChange={(e) => setItem(i, { qtd: e.target.value })}
            />
            {f.itens.length > 1 && (
              <button
                onClick={() => setF({ ...f, itens: f.itens.filter((_: any, j: number) => j !== i) })}
                className="text-zinc-600 hover:text-red-400"
                aria-label="Remover item"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {f.itens.length === 0 && (
          <p className="text-sm text-mut py-2">Nenhum produto adicionado. Você pode salvar o orçamento e incluir os itens depois.</p>
        )}
        {produtos.length > 0 ? (
          <button
            onClick={() =>
              setF({ ...f, itens: [...f.itens, { produto_id: produtos[0].id, qtd: 100 }] })
            }
            className="text-xs font-disp uppercase text-acc hover:text-amber-300"
          >
            + adicionar item
          </button>
        ) : (
          <p className="text-xs text-zinc-500">Cadastre produtos quando quiser adicionar itens ao orçamento.</p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STATUS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data de entrega">
          <input type="date" className={inp} value={f.data_entrega} onChange={(e) => setF({ ...f, data_entrega: e.target.value })} />
        </Field>
      </div>

      <div className="flex justify-between items-center bg-panel2 border border-line px-4 py-3 mt-2">
        <span className="text-[11px] font-disp uppercase tracking-widest text-mut">Total</span>
        <span className="font-mono text-xl text-white">{brl(total)}</span>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onFechar}>Cancelar</Btn>
        <Btn disabled={!ok} onClick={() => onSalvar(f)}>Salvar</Btn>
      </div>
    </Modal>
  );
}
