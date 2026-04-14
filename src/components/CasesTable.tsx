import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Case {
  id: string;
  case_number: string | null;
  client_name: string;
  court: string | null;
  court_division: string | null;
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

export function CasesTable() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchCases = async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_number, client_name, court, court_division, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(10);
      if (data) setCases(data);
      setLoading(false);
    };
    fetchCases();
  }, [user]);

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
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground font-medium">
          <tr>
            <th className="font-medium px-4 py-3">Nº Processo</th>
            <th className="font-medium px-4 py-3">Cliente</th>
            <th className="font-medium px-4 py-3">Tribunal</th>
            <th className="font-medium px-4 py-3">Status</th>
            <th className="font-medium px-4 py-3 text-right">Última Atualização</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cases.map((c) => (
            <tr key={c.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
              <td className="px-4 py-3 font-mono text-xs font-medium">{c.case_number || "—"}</td>
              <td className="px-4 py-3">{c.client_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.court ? `${c.court}${c.court_division ? ` - ${c.court_division}` : ""}` : "—"}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <div className={`size-1.5 rounded-full ${statusColors[c.status] || "bg-muted-foreground/40"}`} />
                  {statusLabels[c.status] || c.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{formatDate(c.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
