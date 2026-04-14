import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { CalendarClock, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export default function PrazosPage() {
  // Placeholder — deadlines table will be added later
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <section className="flex-1 overflow-y-auto p-8 space-y-6">
          <h1 className="text-xl font-medium">Agenda de Prazos</h1>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Próximos 7 dias</p>
                <AlertTriangle className="size-4 text-warning" />
              </div>
              <p className="text-3xl font-semibold tracking-tight">—</p>
              <p className="text-xs text-muted-foreground mt-1">Prazos urgentes</p>
            </div>
            <div className="bg-card border border-border rounded-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Este mês</p>
                <Clock className="size-4 text-info" />
              </div>
              <p className="text-3xl font-semibold tracking-tight">—</p>
              <p className="text-xs text-muted-foreground mt-1">A vencer</p>
            </div>
            <div className="bg-card border border-border rounded-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Cumpridos</p>
                <CheckCircle2 className="size-4 text-success" />
              </div>
              <p className="text-3xl font-semibold tracking-tight">—</p>
              <p className="text-xs text-muted-foreground mt-1">Total cumprido</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-sm p-8 text-center">
            <CalendarClock className="size-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-sm font-medium mb-1">Nenhum prazo cadastrado</h3>
            <p className="text-xs text-muted-foreground">
              Em breve você poderá cadastrar e gerenciar prazos processuais aqui.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
