import { useState, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCards } from "@/components/StatsCards";
import { CasesTable } from "@/components/CasesTable";
import { AIChatPanel } from "@/components/AIChatPanel";
import { DocumentsWidget } from "@/components/DocumentsWidget";
import { InsightsWidget } from "@/components/InsightsWidget";

const Index = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleCaseCreated = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader onCaseCreated={handleCaseCreated} />
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <section className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-medium">Painel de Monitoramento</h1>
            </div>
            <StatsCards key={`stats-${refreshKey}`} />
            <CasesTable key={`cases-${refreshKey}`} />
            <div className="grid grid-cols-2 gap-6">
              <DocumentsWidget />
              <InsightsWidget />
            </div>
          </section>
          <AIChatPanel />
        </div>
      </main>
    </div>
  );
};

export default Index;
