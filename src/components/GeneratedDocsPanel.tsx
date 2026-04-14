import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, ScrollText, Gavel, FileCheck, ChevronRight } from "lucide-react";

interface GenDoc {
  id: string;
  title: string;
  document_type: string;
  content: string;
  created_at: string;
}

const typeIcons: Record<string, React.ElementType> = {
  "petição inicial": ScrollText,
  "contestação": Gavel,
  "recurso": FileCheck,
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface GeneratedDocsPanelProps {
  caseId: string;
  refreshKey?: number;
  fullPage?: boolean;
}

export function GeneratedDocsPanel({ caseId, refreshKey, fullPage }: GeneratedDocsPanelProps) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<GenDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<GenDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !caseId) return;
    setLoading(true);
    supabase
      .from("generated_documents")
      .select("id, title, document_type, content, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setDocs(data);
        setLoading(false);
      });
  }, [user, caseId, refreshKey]);

  if (docs.length === 0 && !loading) {
    if (fullPage) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
          <ScrollText className="size-10 mb-3 opacity-30" />
          <p className="text-sm">Nenhuma peça gerada ainda.</p>
          <p className="text-xs mt-1">Use o Copiloto Jurídico para gerar petições, recursos e outras peças.</p>
        </div>
      );
    }
    return null;
  }

  const containerClass = fullPage
    ? "flex-1 flex flex-col overflow-hidden"
    : "w-72 border-l border-border flex flex-col bg-card shrink-0 overflow-hidden";

  return (
    <div className={containerClass}>
      {!fullPage && (
        <div className="p-3 border-b border-border bg-muted">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <FileText className="size-3" />
            Peças Geradas ({docs.length})
          </h3>
        </div>
      )}

      {selectedDoc ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <button
            onClick={() => setSelectedDoc(null)}
            className="px-3 py-2 text-xs text-primary hover:underline text-left border-b border-border"
          >
            ← Voltar à lista
          </button>
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium">{selectedDoc.title}</p>
            <p className="text-[10px] text-muted-foreground">{selectedDoc.document_type} · {formatDate(selectedDoc.created_at)}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">
              {selectedDoc.content}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
          ) : (
            <div className="divide-y divide-border">
              {docs.map((doc) => {
                const DocIcon = typeIcons[doc.document_type] || FileText;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-muted/50 transition-colors group"
                  >
                    <DocIcon className="size-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.document_type} · {formatDate(doc.created_at)}</p>
                    </div>
                    <ChevronRight className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
