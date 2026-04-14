import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, FileText, Image, File, Download, ChevronDown, ChevronUp, Scale, Hash, MapPin, Calendar } from "lucide-react";
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

function docIcon(type: string | null) {
  if (type?.startsWith("image/")) return <Image className="size-3.5 text-info" />;
  if (type?.includes("pdf")) return <FileText className="size-3.5 text-destructive" />;
  return <File className="size-3.5 text-muted-foreground" />;
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
  const [showDetails, setShowDetails] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showGeneratedDocs, setShowGeneratedDocs] = useState(true);

  useEffect(() => {
    if (!user || !caseId) return;
    setLoading(true);
    const load = async () => {
      const [caseRes, docsRes] = await Promise.all([
        supabase.from("cases").select("*").eq("id", caseId).single(),
        supabase.from("case_documents").select("id, name, file_type, file_size, file_url, created_at").eq("case_id", caseId).order("created_at", { ascending: false }),
      ]);
      if (caseRes.data) setCaseData(caseRes.data);
      if (docsRes.data) setDocs(docsRes.data);
      setLoading(false);
    };
    load();
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

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: Compact case context panel */}
      <div className="w-72 border-r border-border flex flex-col bg-card shrink-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 size-7">
              <ArrowLeft className="size-3.5" />
            </Button>
            <h2 className="text-sm font-medium truncate flex-1">{caseData.client_name}</h2>
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
              <span className={`size-1.5 rounded-full mr-1 ${statusColors[caseData.status] || "bg-muted-foreground/40"}`} />
              {statusLabels[caseData.status] || caseData.status}
            </Badge>
          </div>
          {caseData.case_number && (
            <p className="text-[10px] text-muted-foreground font-mono ml-9">{caseData.case_number}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Collapsible details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:bg-muted/50 transition-colors"
          >
            Dados do Processo
            {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {showDetails && (
            <div className="px-4 pb-3 space-y-2">
              {caseData.court && (
                <div className="flex items-center gap-2 text-xs">
                  <Scale className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Tribunal:</span>
                  <span className="font-medium truncate">{caseData.court}</span>
                </div>
              )}
              {caseData.court_division && (
                <div className="flex items-center gap-2 text-xs">
                  <Scale className="size-3 text-muted-foreground shrink-0 opacity-0" />
                  <span className="text-muted-foreground">Vara:</span>
                  <span className="font-medium truncate">{caseData.court_division}</span>
                </div>
              )}
              {caseData.area_of_law && (
                <div className="flex items-center gap-2 text-xs">
                  <Hash className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Área:</span>
                  <span className="font-medium truncate">{caseData.area_of_law}</span>
                </div>
              )}
              {caseData.state && (
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Estado:</span>
                  <span className="font-medium">{caseData.state}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="size-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Cadastro:</span>
                <span className="font-medium">{formatDate(caseData.created_at)}</span>
              </div>
              {caseData.description && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-2 pt-2 border-t border-border whitespace-pre-wrap">
                  {caseData.description}
                </p>
              )}
            </div>
          )}

          {/* Collapsible documents */}
          <button
            onClick={() => setShowDocs(!showDocs)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:bg-muted/50 transition-colors border-t border-border"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="size-3" />
              Documentos ({docs.length})
            </span>
            {showDocs ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {showDocs && (
            <div className="px-4 pb-3 space-y-1.5">
              <div className="flex justify-end mb-1">
                <DocumentUploadDialog onUploaded={() => setRefreshKey((k) => k + 1)} />
              </div>
              {docs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-3">Nenhum documento.</p>
              ) : (
                docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 p-2 border border-border bg-muted/30 rounded-sm hover:bg-muted/60 transition-colors cursor-pointer group"
                    onClick={() => handleDownload(doc)}
                  >
                    {docIcon(doc.file_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatSize(doc.file_size)}</p>
                    </div>
                    <Download className="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: AI Chat (main area) */}
      <AIChatPanel
        caseId={caseId}
        caseName={caseName}
        caseDescription={caseData.description}
        documents={docs.map(d => d.name)}
        onDocumentGenerated={() => setRefreshKey((k) => k + 1)}
      />

      {/* Right: Generated documents panel */}
      <GeneratedDocsPanel caseId={caseId} refreshKey={refreshKey} />
    </div>
  );
}
