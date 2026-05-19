import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search } from "lucide-react";

interface Case {
  id: string;
  case_number: string | null;
  client_name: string;
  court: string | null;
  court_division: string | null;
  area_of_law: string | null;
  status: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  active: "bg-info",
  pending: "bg-warning",
  closed: "bg-success",
  urgent: "bg-destructive",
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  pending: "Aguardando",
  closed: "Encerrado",
  urgent: "Urgente",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 24) return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} — Hoje`;
  if (hours < 48) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

interface CasesTableProps {
  onSelectCase?: (caseId: string) => void;
  selectedCaseId?: string | null;
}

export function CasesTable({ onSelectCase, selectedCaseId }: CasesTableProps) {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchCases = async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_number, client_name, court, court_division, area_of_law, status, updated_at")
        .order("updated_at", { ascending: false });
      if (data) setCases(data);
      setLoading(false);
    };
    fetchCases();
  }, [user]);

  const filtered = cases.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.client_name.toLowerCase().includes(q) ||
      (c.case_number?.toLowerCase().includes(q)) ||
      (c.court?.toLowerCase().includes(q)) ||
      (c.area_of_law?.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="surface-card rounded-lg p-10 text-center text-muted-foreground text-sm animate-fade-in">
        Carregando processos...
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="surface-card rounded-lg p-10 text-center text-muted-foreground text-sm animate-fade-in">
        Nenhum processo cadastrado. Clique em "Novo Processo" para começar.
      </div>
    );
  }

  return (
    <div className="surface-card rounded-xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border bg-gradient-card flex items-center gap-2 sm:gap-3 flex-wrap">
        <h3 className="text-sm font-semibold tracking-tight">Processos</h3>
        <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted tabular-nums">{cases.length}</span>
        <div className="w-full sm:w-72 sm:ml-auto order-3 sm:order-none flex items-center bg-background border border-border rounded-lg px-3 py-1.5 surface-interactive focus-within:border-accent/60 focus-within:shadow-[var(--shadow-focus)]">
          <Search className="size-3.5 text-muted-foreground mr-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar processos..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden divide-y divide-border max-h-[70vh] overflow-y-auto">
        {filtered.map((c) => {
          const isSelected = selectedCaseId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelectCase?.(c.id)}
              className={`w-full text-left p-4 surface-interactive relative ${isSelected ? "bg-accent/5" : "active:bg-muted/40"}`}
            >
              {isSelected && <span className="absolute left-0 top-3 bottom-3 w-[3px] bg-gradient-primary rounded-r-full shadow-glow" />}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className={`font-mono text-[11px] font-medium truncate ${isSelected ? "text-accent" : "text-muted-foreground"}`}>
                  {c.case_number || "—"}
                </p>
                <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-muted/60 border border-border/60 font-medium">
                  <div className={`size-1.5 rounded-full ${statusColors[c.status] || "bg-muted-foreground/40"}`} />
                  {statusLabels[c.status] || c.status}
                </span>
              </div>
              <p className="text-sm font-medium truncate">{c.client_name}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">
                  {c.court ? `${c.court}${c.court_division ? ` · ${c.court_division}` : ""}` : "—"}
                  {c.area_of_law ? ` · ${c.area_of_law}` : ""}
                </span>
                <span className="tabular-nums shrink-0">{formatDate(c.updated_at)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground border-b border-border">
            <tr>
              <th className="font-semibold px-4 py-3 text-[10px] uppercase tracking-[0.14em]">Nº Processo</th>
              <th className="font-semibold px-4 py-3 text-[10px] uppercase tracking-[0.14em]">Cliente</th>
              <th className="font-semibold px-4 py-3 text-[10px] uppercase tracking-[0.14em]">Tribunal</th>
              <th className="font-semibold px-4 py-3 text-[10px] uppercase tracking-[0.14em]">Área</th>
              <th className="font-semibold px-4 py-3 text-[10px] uppercase tracking-[0.14em]">Status</th>
              <th className="font-semibold px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-right">Atualização</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelectCase?.(c.id)}
                className={`surface-interactive cursor-pointer ${selectedCaseId === c.id ? "bg-accent/5" : "hover:bg-muted/40"}`}
              >
                <td className={`px-4 py-3.5 font-mono text-xs font-medium relative ${selectedCaseId === c.id ? "text-accent" : ""}`}>
                  {selectedCaseId === c.id && <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-gradient-primary rounded-r-full shadow-glow" />}
                  {c.case_number || "—"}
                </td>
                <td className="px-4 py-3.5 font-medium">{c.client_name}</td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs">{c.court ? `${c.court}${c.court_division ? ` - ${c.court_division}` : ""}` : "—"}</td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs">{c.area_of_law || "—"}</td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-muted/60 border border-border/60 font-medium">
                    <div className={`size-1.5 rounded-full ${statusColors[c.status] || "bg-muted-foreground/40"} shadow-[0_0_8px_currentColor]`} />
                    {statusLabels[c.status] || c.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-muted-foreground tabular-nums text-xs">{formatDate(c.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
