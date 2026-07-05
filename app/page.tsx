"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, configurado } from "@/lib/supabase";
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

type Produto = { id: string; nome: string; preco: number };
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
};

const NAV = [
  { id: "painel", label: "Painel", icone: "▦" },
  { id: "clientes", label: "Clientes", icone: "◉" },
  { id: "pedidos", label: "Pedidos", icone: "▤" },
  { id: "produtos", label: "Produtos", icone: "▣" },
];

export default function App() {
  const [aba, setAba] = useState("painel");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<any>(null);
  const [toast, setToast] = useState("");

  const avisar = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
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
      return;
    }
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
  }, [carregar]);

  const nomeCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nome || "Cliente removido";

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

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ---------- Sidebar ---------- */}
      <aside className="md:w-56 md:min-h-screen bg-panel border-b md:border-b-0 md:border-r border-line flex md:flex-col">
        <div className="hidden md:block hazard h-1.5 w-full" />
        <div className="px-4 py-4 md:py-6 flex md:block items-center gap-3">
          <div className="grid grid-cols-2 gap-0.5 w-fit">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={"w-3.5 h-2.5 " + (i === 1 ? "bg-acc" : "bg-zinc-600")} />
            ))}
          </div>
          <div className="md:mt-3">
            <div className="font-disp font-bold uppercase leading-none tracking-wide">
              Riquelme
            </div>
            <div className="text-[11px] text-mut uppercase tracking-widest mt-0.5">
              Fábrica de blocos
            </div>
          </div>
        </div>
        <nav className="flex md:flex-col flex-1 md:px-2 overflow-x-auto scroll-slim">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setAba(n.id)}
              className={
                "flex items-center gap-3 px-4 py-3 text-sm font-disp uppercase tracking-wide border-l-2 md:border-l-2 transition-colors whitespace-nowrap " +
                (aba === n.id
                  ? "border-acc text-white bg-panel2"
                  : "border-transparent text-mut hover:text-zinc-200")
              }
            >
              <span className="text-acc">{n.icone}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="hidden md:block px-4 py-4 text-[11px] text-zinc-600 font-mono">
          dados compartilhados
          <br />
          entre todos os usuários
        </div>
      </aside>

      {/* ---------- Conteúdo ---------- */}
      <main className="flex-1 px-4 md:px-8 py-6 max-w-6xl">
        {!configurado && (
          <div className="mb-6 border border-acc/40 bg-acc/10 px-4 py-3 text-sm text-amber-200">
            Banco de dados ainda não configurado — preencha as chaves do Supabase em{" "}
            <code className="font-mono">lib/supabase.ts</code>.
          </div>
        )}

        {carregando ? (
          <Spinner />
        ) : (
          <>
            {aba === "painel" && (
              <Painel clientes={clientes} pedidos={pedidos} nomeCliente={nomeCliente} />
            )}
            {aba === "clientes" && (
              <Clientes
                clientes={clientes}
                pedidos={pedidos}
                onNovo={() => setModal({ tipo: "cliente" })}
                onEditar={(c: Cliente) => setModal({ tipo: "cliente", dado: c })}
                onExcluir={excluirCliente}
              />
            )}
            {aba === "pedidos" && (
              <Pedidos
                pedidos={pedidos}
                produtos={produtos}
                clientes={clientes}
                nomeCliente={nomeCliente}
                onNovo={() => setModal({ tipo: "pedido" })}
                onEditar={(p: Pedido) => setModal({ tipo: "pedido", dado: p })}
                onStatus={mudarStatus}
                onExcluir={excluirPedido}
              />
            )}
            {aba === "produtos" && (
              <Produtos produtos={produtos} recarregar={carregar} avisar={avisar} />
            )}
          </>
        )}
      </main>

      {/* ---------- Modais e toast ---------- */}
      {modal?.tipo === "cliente" && (
        <FormCliente dado={modal.dado} onSalvar={salvarCliente} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === "pedido" && (
        <FormPedido
          dado={modal.dado}
          clientes={clientes}
          produtos={produtos}
          onSalvar={salvarPedido}
          onFechar={() => setModal(null)}
        />
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-acc text-base font-disp uppercase text-sm px-4 py-2 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ================= Painel =================
function Painel({ clientes, pedidos, nomeCliente }: any) {
  const agora = new Date();
  const doMes = (t: string) => {
    const d = new Date(t);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  };
  const fatMes = pedidos
    .filter((p: Pedido) => p.status === "entregue" && doMes(p.criado_em))
    .reduce((s: number, p: Pedido) => s + Number(p.total), 0);

  const porStatus = (id: string) => pedidos.filter((p: Pedido) => p.status === id).length;

  const proximas = pedidos
    .filter((p: Pedido) => p.status !== "entregue" && p.data_entrega)
    .sort((a: Pedido, b: Pedido) => (a.data_entrega! > b.data_entrega! ? 1 : -1))
    .slice(0, 6);

  const stats = [
    ["Clientes", clientes.length],
    ["Orçamentos abertos", porStatus("orcamento")],
    ["Em produção", porStatus("confirmado") + porStatus("producao")],
    ["Faturado no mês", brl(fatMes)],
  ];

  const totalPed = pedidos.length || 1;

  return (
    <div>
      <h1 className="font-disp text-2xl font-bold uppercase tracking-wide mb-6">Painel</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(([label, valor]) => (
          <div key={label as string} className="bg-panel border border-line p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-8 h-0.5 bg-acc" />
            <div className="text-[11px] font-disp uppercase tracking-widest text-mut">{label}</div>
            <div className="font-mono text-2xl mt-2 text-white">{valor}</div>
          </div>
        ))}
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
              <div key={s.id} style={{ width: `${(n / totalPed) * 100}%`, background: s.cor }} />
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
          {proximas.map((p: Pedido) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
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
function Clientes({ clientes, pedidos, onNovo, onEditar, onExcluir }: any) {
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
          {lista.map((c: Cliente) => {
            const n = pedidos.filter((p: Pedido) => p.cliente_id === c.id).length;
            const tel = (c.telefone || "").replace(/\D/g, "");
            return (
              <div key={c.id} className="bg-panel border border-line p-4 flex flex-col">
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
                  {confirmar === c.id ? (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================= Pedidos =================
function Pedidos({ pedidos, produtos, clientes, nomeCliente, onNovo, onEditar, onStatus, onExcluir }: any) {
  const [filtro, setFiltro] = useState("todos");
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const lista = pedidos.filter((p: Pedido) => filtro === "todos" || p.status === filtro);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="font-disp text-2xl font-bold uppercase tracking-wide">Pedidos</h1>
        <Btn onClick={onNovo} disabled={clientes.length === 0}>
          + Novo pedido
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

      {clientes.length === 0 ? (
        <Empty texto="Cadastre um cliente primeiro na aba Clientes para criar pedidos." />
      ) : lista.length === 0 ? (
        <Empty texto="Nenhum pedido nesse filtro." />
      ) : (
        <div className="space-y-3">
          {lista.map((p: Pedido) => (
            <div key={p.id} className="bg-panel border border-line">
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
                  <div className="mt-2 flex gap-3 justify-end text-xs">
                    <button onClick={() => onEditar(p)} className="text-mut hover:text-white underline">
                      Editar
                    </button>
                    {confirmar === p.id ? (
                      <button
                        onClick={() => { onExcluir(p.id); setConfirmar(null); }}
                        className="text-red-400 hover:text-red-300 underline"
                      >
                        Confirmar?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmar(p.id)}
                        className="text-zinc-600 hover:text-red-400 underline"
                      >
                        Excluir
                      </button>
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
function Produtos({ produtos, recarregar, avisar }: any) {
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
    <div className="max-w-2xl">
      <h1 className="font-disp text-2xl font-bold uppercase tracking-wide mb-6">Produtos</h1>

      <div className="bg-panel border border-line divide-y divide-line">
        {produtos.map((p: Produto) => {
          const e = edits[p.id] || {};
          const alterado = e.nome !== undefined || e.preco !== undefined;
          return (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
              <input
                value={e.nome ?? p.nome}
                onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, nome: ev.target.value } })}
                className="flex-1 bg-transparent border border-transparent hover:border-line focus:border-acc outline-none px-2 py-1 text-sm"
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
              <button onClick={() => excluir(p.id)} className="text-zinc-600 hover:text-red-400 text-sm" aria-label="Excluir produto">
                ✕
              </button>
            </div>
          );
        })}
        {produtos.length === 0 && (
          <div className="px-4 py-6 text-sm text-mut">Nenhum produto cadastrado ainda.</div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <input
          value={novo.nome}
          onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          placeholder="Novo bloco (ex: Bloco 14x19x29)"
          className={inp + " flex-1"}
        />
        <input
          type="number"
          step="0.10"
          value={novo.preco}
          onChange={(e) => setNovo({ ...novo, preco: e.target.value })}
          placeholder="Preço"
          className={inp + " w-28 text-right font-mono"}
        />
        <Btn onClick={adicionar} disabled={!novo.nome.trim()}>
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

function FormPedido({ dado, clientes, produtos, onSalvar, onFechar }: any) {
  const [f, setF] = useState(
    dado
      ? { id: dado.id, cliente_id: dado.cliente_id, itens: dado.itens, status: dado.status, data_entrega: dado.data_entrega || "" }
      : {
          cliente_id: clientes[0]?.id || "",
          itens: [{ produto_id: produtos[0]?.id || "", qtd: 100 }],
          status: "orcamento",
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

  const ok = f.cliente_id && f.itens.some((it: Item) => Number(it.qtd) > 0);

  return (
    <Modal titulo={dado ? "Editar pedido" : "Novo pedido"} onFechar={onFechar}>
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
        <button
          onClick={() =>
            setF({ ...f, itens: [...f.itens, { produto_id: produtos[0]?.id || "", qtd: 100 }] })
          }
          className="text-xs font-disp uppercase text-acc hover:text-amber-300"
        >
          + adicionar item
        </button>
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
