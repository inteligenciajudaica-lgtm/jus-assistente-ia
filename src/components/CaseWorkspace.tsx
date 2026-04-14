import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, FileText, Image, File, Download, MessageSquare, Calendar, MapPin, Scale, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { AIChatPanel } from "@/components/AIChatPanel";

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

interface ChatConv {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

const statusColors: Record<string, string> = {
  active: "bg-info",
  pending: "bg-warning",
  closed: "bg-success",
  urgent: "bg-destructive",
};
const statusLabels: Record<string, string> = {
  active: "Ativo",
  pending: "Aguardando",
  closed: "Encerrado",
  urgent: "Urgente",
};

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
  const [conversations, setConversations] = useState<ChatConv[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user || !caseId) return;
    setLoading(true);

    const load = async () => {
      const [caseRes, docsRes, convsRes] = await Promise.all([
        supabase.from("cases").select("*").eq("id", caseId).single(),
        supabase.from("case_documents").select("id, name, file_type, file_size, file_url, created_at").eq("case_id", caseId).order("created_at", { ascending: false }),
        supabase.from("chat_conversations").select("id, title, created_at, updated_at").eq("case_id", caseId).order("updated_at", { ascending: false }),
      ]);

      if (caseRes.data) setCaseData(caseRes.data);
      if (docsRes.data) setDocs(docsRes.data);

      if (convsRes.data) {
        const convsWithCounts = await Promise.all(
          convsRes.data.map(async (conv) => {
            const { count } = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id);
            return { ...conv, message_count: count || 0 };
          })
        );
        setConversations(convsWithCounts);
      }

      setLoading(false);
    };
    load();
  }, [user, caseId, refreshKey]);

  const handleDownload = async (doc: Doc) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Carregando processo...
      </div>
    );
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
      {/* Left: Case details */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium truncate">{caseData.client_name}</h1>
              <Badge variant="outline" className="shrink-0">
                <span className={`size-1.5 rounded-full mr-1.5 ${statusColors[caseData.status] || "bg-muted-foreground/40"}`} />
                {statusLabels[caseData.status] || caseData.status}
              </Badge>
            </div>
            {caseData.case_number && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{caseData.case_number}</p>
            )}
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {caseData.court && (
            <div className="bg-card border border-border rounded-sm p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Scale className="size-3" />
                <span className="text-[10px] font-semibold uppercase tracking-widest">Tribunal</span>
              </div>
              <p className="text-xs font-medium">{caseData.court}</p>
              {caseData.court_division && <p className="text-[10px] text-muted-foreground">{caseData.court_division}</p>}
            </div>
          )}
          {caseData.area_of_law && (
            <div className="bg-card border border-border rounded-sm p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Hash className="size-3" />
                <span className="text-[10px] font-semibold uppercase tracking-widest">Área</span>
              </div>
              <p className="text-xs font-medium">{caseData.area_of_law}</p>
            </div>
          )}
          {caseData.state && (
            <div className="bg-card border border-border rounded-sm p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <MapPin className="size-3" />
                <span className="text-[10px] font-semibold uppercase tracking-widest">Estado</span>
              </div>
              <p className="text-xs font-medium">{caseData.state}</p>
            </div>
          )}
          <div className="bg-card border border-border rounded-sm p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Calendar className="size-3" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">Cadastro</span>
            </div>
            <p className="text-xs font-medium">{formatDate(caseData.created_at)}</p>
          </div>
        </div>

        {/* Description */}
        {caseData.description && (
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-sm font-medium mb-2">Descrição</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{caseData.description}</p>
          </div>
        )}

        {/* Documents */}
        <div className="bg-card border border-border rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <FileText className="size-4" />
              Documentos ({docs.length})
            </h3>
            <DocumentUploadDialog onUploaded={() => setRefreshKey((k) => k + 1)} />
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento vinculado.</p>
          ) : (
            <div className="space-y-1.5">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-2.5 border border-border bg-muted/30 rounded-sm hover:bg-muted/60 transition-colors cursor-pointer group"
                  onClick={() => handleDownload(doc)}
                >
                  {docIcon(doc.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(doc.file_size)} · {formatDate(doc.created_at)}</p>
                  </div>
                  <Download className="size-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversations */}
        <div className="bg-card border border-border rounded-sm p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <MessageSquare className="size-4" />
            Conversas ({conversations.length})
          </h3>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conversa vinculada.</p>
          ) : (
            <div className="space-y-1.5">
              {conversations.map((conv) => (
                <div key={conv.id} className="flex items-center gap-3 p-2.5 border border-border bg-muted/30 rounded-sm">
                  <MessageSquare className="size-3.5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{conv.title || "Conversa sem título"}</p>
                    <p className="text-[10px] text-muted-foreground">{conv.message_count} mensagens · {formatDate(conv.updated_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: AI Chat - always active when case is selected */}
      <AIChatPanel caseId={caseId} caseName={caseName} />
    </div>
  );
}
