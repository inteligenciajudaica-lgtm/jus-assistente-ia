import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, FolderOpen, Calendar, FileEdit } from "lucide-react";

export function StatsCards() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ cases: 0, documents: 0, conversations: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [casesRes, docsRes, convsRes] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }),
        supabase.from("case_documents").select("id", { count: "exact", head: true }),
        supabase.from("chat_conversations").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        cases: casesRes.count || 0,
        documents: docsRes.count || 0,
        conversations: convsRes.count || 0,
      });
    };
    load();
  }, [user]);

  const cards = [
    { icon: FolderOpen, label: "Processos Ativos", value: stats.cases.toString().padStart(2, "0"), sub: "Total cadastrado" },
    { icon: FileEdit, label: "Documentos", value: stats.documents.toString().padStart(2, "0"), sub: "Arquivos anexados" },
    { icon: Calendar, label: "Conversas IA", value: stats.conversations.toString().padStart(2, "0"), sub: "Sessões do copiloto" },
    { icon: AlertTriangle, label: "Prazos", value: "—", sub: "Em breve", accent: true },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((s) => (
        <div key={s.label} className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
            <s.icon className={`size-4 ${s.accent ? "text-warning" : "text-muted-foreground/50"}`} />
          </div>
          <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
