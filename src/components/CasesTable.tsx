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
      <div className="bg-card border border-border rounded-sm p-8 text-center text-muted-foreground text-sm">
        Carregando processos...
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="bg-card border border-border rounded-sm p-8 text-center text-muted-foreground text-sm">
        Nenhum processo cadastrado. Clique em "Novo Processo" para começar.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      {/* Search bar */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center bg-background border border-border rounded-sm px-3 py-1.5">
          <Search className="size-3.5 text-muted-foreground mr-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar processos..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60"
          />
          <span className="text-xs text-muted-foreground ml-2">{filtered.length}</span>
        </div>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground font-medium">
          <tr>
            <th className="font-medium px-4 py-3">Nº Processo</th>
            <th className="font-medium px-4 py-3">Cliente</th>
            <th className="font-medium px-4 py-3">Tribunal</th>
            <th className="font-medium px-4 py-3">Área</th>
            <th className="font-medium px-4 py-3">Status</th>
            <th className="font-medium px-4 py-3 text-right">Atualização</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelectCase?.(c.id)}
              className={`hover:bg-muted/50 transition-colors cursor-pointer ${selectedCaseId === c.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
            >
              <td className="px-4 py-3 font-mono text-xs font-medium">{c.case_number || "—"}</td>
              <td className="px-4 py-3 font-medium">{c.client_name}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{c.court ? `${c.court}${c.court_division ? ` - ${c.court_division}` : ""}` : "—"}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{c.area_of_law || "—"}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <div className={`size-1.5 rounded-full ${statusColors[c.status] || "bg-muted-foreground/40"}`} />
                  {statusLabels[c.status] || c.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground tabular-nums text-xs">{formatDate(c.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
