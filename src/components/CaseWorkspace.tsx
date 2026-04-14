import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, FileText, Image, File, Download, Scale, Hash, MapPin, Calendar,
  MessageSquare, FolderOpen, ScrollText, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { AIChatPanel } from "@/components/AIChatPanel";
import { GeneratedDocsPanel } from "@/components/GeneratedDocsPanel";

interface CaseDetail {
  id: string;
  case_number: string | null;
  client_name: string;
  court: string | null;
  court_division: string | null;
  area_of_law: string | null;
  state: string | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Doc {
  id: string;
  name: string;
  file_type: string | null;
  file_size: number | null;
  file_url: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  active: "bg-info", pending: "bg-warning", closed: "bg-success", urgent: "bg-destructive",
};
const statusLabels: Record<string, string> = {
  active: "Ativo", pending: "Aguardando", closed: "Encerrado", urgent: "Urgente",
};

type TabKey = "copiloto" | "dados" | "documentos" | "pecas";

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "copiloto", label: "Copiloto Jurídico", icon: Bot },
  { key: "dados", label: "Dados do Processo", icon: Scale },
  { key: "documentos", label: "Documentos", icon: FolderOpen },
  { key: "pecas", label: "Peças Geradas", icon: ScrollText },
];

function docIcon(type: string | null) {
  if (type?.startsWith("image/")) return <Image className="size-4 text-info" />;
  if (type?.includes("pdf")) return <FileText className="size-4 text-destructive" />;
  return <File className="size-4 text-muted-foreground" />;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

interface CaseWorkspaceProps {
  caseId: string;
  caseName: string | null;
  onBack: () => void;
}

export function CaseWorkspace({ caseId, caseName, onBack }: CaseWorkspaceProps) {
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("copiloto");

  useEffect(() => {
    if (!user || !caseId) return;
    setLoading(true);
    Promise.all([
      supabase.from("cases").select("*").eq("id", caseId).single(),
      supabase.from("case_documents").select("id, name, file_type, file_size, file_url, created_at").eq("case_id", caseId).order("created_at", { ascending: false }),
    ]).then(([caseRes, docsRes]) => {
      if (caseRes.data) setCaseData(caseRes.data);
      if (docsRes.data) setDocs(docsRes.data);
      setLoading(false);
    });
  }, [user, caseId, refreshKey]);

  const handleDownload = async (doc: Doc) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Carregando processo...</div>;
  }

  if (!caseData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Processo não encontrado.</p>
        <Button variant="outline" size="sm" onClick={onBack}>Voltar</Button>
      </div>
    );
  }

  // Build missing fields list for AI context
  const missingFields: string[] = [];
  if (!caseData.case_number) missingFields.push("número do processo");
  if (!caseData.court) missingFields.push("tribunal");
  if (!caseData.court_division) missingFields.push("vara");
  if (!caseData.area_of_law) missingFields.push("área do direito");
  if (!caseData.state) missingFields.push("estado/UF");
  if (!caseData.description) missingFields.push("descrição/resumo dos fatos");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar: back + case name + tabs */}
      <div className="border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 size-8">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{caseData.client_name}</h2>
            <div className="flex items-center gap-2">
              {caseData.case_number && (
                <span className="text-[10px] text-muted-foreground font-mono">{caseData.case_number}</span>
              )}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <span className={`size-1.5 rounded-full mr-1 ${statusColors[caseData.status] || "bg-muted-foreground/40"}`} />
                {statusLabels[caseData.status] || caseData.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-4 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "copiloto" && (
          <AIChatPanel
            caseId={caseId}
            caseName={caseName}
            caseDescription={caseData.description}
            documents={docs.map((d) => d.name)}
            missingFields={missingFields}
            caseData={{
              court: caseData.court,
              court_division: caseData.court_division,
              area_of_law: caseData.area_of_law,
              state: caseData.state,
              case_number: caseData.case_number,
            }}
            onDocumentGenerated={() => setRefreshKey((k) => k + 1)}
          />
        )}

        {activeTab === "dados" && (
          <div className="overflow-y-auto h-full p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <h3 className="text-base font-semibold">Dados do Processo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Hash, label: "Número", value: caseData.case_number },
                  { icon: Scale, label: "Tribunal", value: caseData.court },
                  { icon: Scale, label: "Vara", value: caseData.court_division },
                  { icon: Hash, label: "Área do Direito", value: caseData.area_of_law },
                  { icon: MapPin, label: "Estado", value: caseData.state },
                  { icon: Calendar, label: "Cadastro", value: formatDate(caseData.created_at) },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 p-4 border border-border rounded-sm bg-card">
                      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-medium mt-0.5">{item.value || <span className="text-muted-foreground italic">Não informado</span>}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {caseData.description && (
                <div className="p-4 border border-border rounded-sm bg-card">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Descrição</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{caseData.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "documentos" && (
          <div className="overflow-y-auto h-full p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Documentos ({docs.length})</h3>
                <DocumentUploadDialog onUploaded={() => setRefreshKey((k) => k + 1)} />
              </div>
              {docs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="size-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum documento anexado.</p>
                  <p className="text-xs mt-1">Use o botão acima para enviar documentos.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleDownload(doc)}
                      className="flex items-center gap-3 p-4 border border-border bg-card rounded-sm hover:bg-muted/50 transition-colors cursor-pointer group"
                    >
                      {docIcon(doc.file_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(doc.file_size)} · {formatDate(doc.created_at)}</p>
                      </div>
                      <Download className="size-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "pecas" && (
          <div className="h-full">
            <GeneratedDocsPanel caseId={caseId} refreshKey={refreshKey} fullPage />
          </div>
        )}
      </div>
    </div>
  );
}
