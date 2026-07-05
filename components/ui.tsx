"use client";

export const STATUS = [
  { id: "orcamento", label: "Orçamento", cor: "#8B8B95" },
  { id: "confirmado", label: "Confirmado", cor: "#F2A900" },
  { id: "producao", label: "Em produção", cor: "#4C9AFF" },
  { id: "entregue", label: "Entregue", cor: "#3ECF8E" },
];

export const TIPOS_CLIENTE = [
  "Construtora",
  "Pedreiro / Empreiteiro",
  "Depósito",
  "Pessoa física",
];

export const brl = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Chip({ status }: { status: string }) {
  const s = STATUS.find((x) => x.id === status) || STATUS[0];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-disp uppercase tracking-wide px-2 py-0.5 border border-line bg-panel2 text-zinc-300">
      <span className="w-1.5 h-1.5" style={{ background: s.cor }} />
      {s.label}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: any) {
  const base =
    "font-disp uppercase tracking-wide text-sm px-4 py-2 transition-colors ";
  const styles: any = {
    primary: disabled
      ? "bg-panel2 text-mut cursor-not-allowed"
      : "bg-acc text-base hover:bg-amber-400",
    ghost: "border border-line text-zinc-300 hover:border-mut hover:text-white",
    danger: "text-red-400 hover:text-red-300",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={base + styles[variant] + " " + className}>
      {children}
    </button>
  );
}

export function Field({ label, children }: any) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-disp uppercase tracking-widest text-mut mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inp =
  "w-full bg-panel2 border border-line focus:border-acc outline-none px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600";

export function Modal({ titulo, children, onFechar, centralizado = false }: any) {
  return (
    <div
      className={
        "fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center p-4 overflow-auto z-50 " +
        (centralizado ? "items-center" : "items-start")
      }
      onClick={onFechar}
    >
      <div
        className={
          "bg-panel border border-line w-full max-w-lg shadow-2xl " +
          (centralizado ? "" : "mt-10")
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hazard h-1 w-full" />
        <div className="px-5 py-3 flex justify-between items-center border-b border-line">
          <span className="font-disp uppercase tracking-wide">{titulo}</span>
          <button onClick={onFechar} className="text-mut hover:text-white" aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ texto, acao }: { texto: string; acao?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line bg-panel/50 p-10 text-center">
      <div className="mx-auto mb-4 grid grid-cols-3 gap-1 w-fit opacity-40">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-6 h-4 border border-mut" />
        ))}
      </div>
      <p className="text-mut text-sm">{texto}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-line border-t-acc rounded-full animate-spin" />
    </div>
  );
}
