import { useState, useCallback, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCards } from "@/components/StatsCards";
import { CasesTable } from "@/components/CasesTable";
import { DocumentsWidget } from "@/components/DocumentsWidget";
import { CaseWorkspace } from "@/components/CaseWorkspace";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseName, setSelectedCaseName] = useState<string | null>(null);
  const handleCaseCreated = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCaseName(null);
      return;
    }
    supabase.from("cases").select("client_name").eq("id", selectedCaseId).maybeSingle().then(({ data }) => {
      setSelectedCaseName(data?.client_name || null);
    });
  }, [selectedCaseId]);

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader onCaseCreated={handleCaseCreated} />
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {selectedCaseId ? (
            <CaseWorkspace
              caseId={selectedCaseId}
              caseName={selectedCaseName}
              onBack={() => setSelectedCaseId(null)}
            />
          ) : (
            <section className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 animate-fade-in">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Visão geral</p>
                  <h1 className="text-2xl font-semibold tracking-tight">Painel de Monitoramento</h1>
                </div>
              </div>
              <StatsCards key={`stats-${refreshKey}`} />
              <CasesTable
                key={`cases-${refreshKey}`}
                onSelectCase={setSelectedCaseId}
                selectedCaseId={selectedCaseId}
              />
              <DocumentsWidget />
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
