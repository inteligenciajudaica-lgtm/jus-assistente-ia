import { useState, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { CasesTable } from "@/components/CasesTable";
import { CaseWorkspace } from "@/components/CaseWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export default function ProcessosPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseName, setSelectedCaseName] = useState<string | null>(null);
  const handleCaseCreated = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!selectedCaseId) { setSelectedCaseName(null); return; }
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
            <CaseWorkspace caseId={selectedCaseId} caseName={selectedCaseName} onBack={() => setSelectedCaseId(null)} />
          ) : (
            <section className="flex-1 overflow-y-auto p-8 space-y-6">
              <h1 className="text-xl font-medium">Processos Ativos</h1>
              <CasesTable key={`cases-${refreshKey}`} onSelectCase={setSelectedCaseId} selectedCaseId={selectedCaseId} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
