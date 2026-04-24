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
            <section className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 animate-fade-in">
              {/* Hero */}
              <div className="relative rounded-2xl border border-border bg-gradient-card overflow-hidden p-8 lg:p-10">
                <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
                <div className="absolute -top-24 -right-24 size-72 rounded-full bg-gradient-primary opacity-20 blur-3xl pointer-events-none" />
                <div className="relative flex items-end justify-between gap-6 flex-wrap">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent mb-4">
                      <span className="size-1.5 rounded-full bg-accent animate-glow-pulse" />
                      Visão geral em tempo real
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-balance">
                      Painel de <span className="font-display italic text-gradient-primary">Monitoramento</span>
                    </h1>
                    <p className="text-muted-foreground mt-3 text-pretty max-w-xl">
                      Acompanhe seus processos, prazos e produção documental em um só lugar — com o copiloto JURIS AI ao seu lado.
                    </p>
                  </div>
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
