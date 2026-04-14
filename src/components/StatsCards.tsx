import { AlertTriangle, FolderOpen, Calendar, FileEdit } from "lucide-react";

const stats = [
  { icon: AlertTriangle, label: "Prazos Críticos", value: "04", sub: "Expira em 24 horas", accent: true },
  { icon: FolderOpen, label: "Processos Ativos", value: "142", sub: "+3 movimentações hoje" },
  { icon: Calendar, label: "Audiências", value: "02", sub: "Fórum Central - 14:00" },
  { icon: FileEdit, label: "Minutas Pendentes", value: "09", sub: "Aguardando revisão" },
];

export function StatsCards() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((s) => (
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
