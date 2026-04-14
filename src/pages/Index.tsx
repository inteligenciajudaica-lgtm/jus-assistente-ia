import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCards } from "@/components/StatsCards";
import { CasesTable } from "@/components/CasesTable";
import { AIChatPanel } from "@/components/AIChatPanel";
import { DocumentsWidget } from "@/components/DocumentsWidget";
import { InsightsWidget } from "@/components/InsightsWidget";

const Index = () => {
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Content Area */}
          <section className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-medium">Painel de Monitoramento</h1>
              <div className="flex gap-2">
                <span className="px-2.5 py-1 text-[10px] bg-success/10 text-success border border-success/20 font-medium rounded-sm">
                  8 Novos Movimentos
                </span>
                <span className="px-2.5 py-1 text-[10px] bg-info/10 text-info border border-info/20 font-medium rounded-sm">
                  12 Prazos Hoje
                </span>
              </div>
            </div>

            <StatsCards />
            <CasesTable />

            <div className="grid grid-cols-2 gap-6">
              <DocumentsWidget />
              <InsightsWidget />
            </div>
          </section>

          {/* AI Panel */}
          <AIChatPanel />
        </div>
      </main>
    </div>
  );
};

export default Index;
