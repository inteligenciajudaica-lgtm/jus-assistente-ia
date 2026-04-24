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
    { icon: FolderOpen, label: "Processos Ativos", value: stats.cases.toString().padStart(2, "0"), sub: "Total cadastrado", tint: "from-violet-500/15 to-violet-500/0", icoBg: "bg-violet-500/15 text-violet-500" },
    { icon: FileEdit, label: "Documentos", value: stats.documents.toString().padStart(2, "0"), sub: "Arquivos anexados", tint: "from-blue-500/15 to-blue-500/0", icoBg: "bg-blue-500/15 text-blue-500" },
    { icon: Calendar, label: "Conversas IA", value: stats.conversations.toString().padStart(2, "0"), sub: "Sessões do copiloto", tint: "from-fuchsia-500/15 to-fuchsia-500/0", icoBg: "bg-fuchsia-500/15 text-fuchsia-500" },
    { icon: AlertTriangle, label: "Prazos", value: "—", sub: "Em breve", tint: "from-amber-500/15 to-amber-500/0", icoBg: "bg-amber-500/15 text-amber-500", accent: true },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((s, i) => (
        <div
          key={s.label}
          className="relative surface-card rounded-xl p-5 group hover:-translate-y-1 hover:shadow-md-soft animate-slide-up overflow-hidden"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          {/* Tint corner */}
          <div className={`absolute -top-12 -right-12 size-32 rounded-full bg-gradient-to-br ${s.tint} blur-2xl opacity-80 transition-opacity group-hover:opacity-100`} />
          <div className="relative flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">{s.label}</p>
            <div className={`size-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${s.icoBg}`}>
              <s.icon className="size-[18px]" />
            </div>
          </div>
          <p className="relative text-4xl font-semibold tracking-tight tabular-nums">{s.value}</p>
          <p className="relative text-xs text-muted-foreground mt-1.5">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
