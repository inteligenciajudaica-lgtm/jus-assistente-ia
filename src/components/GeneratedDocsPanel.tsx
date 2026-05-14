import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, ScrollText, Gavel, FileCheck, ChevronRight, ArrowLeft, Search } from "lucide-react";
import { LegalEditor } from "@/components/editor/LegalEditor";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface GenDoc {
  id: string;
  title: string;
  document_type: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  word_count: number | null;
  revision_count: number | null;
  area_of_law: string | null;
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
  const [caseArea, setCaseArea] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<GenDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");

  useEffect(() => {
    if (!user || !caseId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("generated_documents")
        .select("id, title, document_type, content, created_at, updated_at, word_count, revision_count, area_of_law")
        .eq("case_id", caseId)
        .order("updated_at", { ascending: false }),
      supabase.from("cases").select("area_of_law").eq("id", caseId).maybeSingle(),
    ]).then(([docsRes, caseRes]) => {
      if (docsRes.data) setDocs(docsRes.data as GenDoc[]);
      if (caseRes.data) setCaseArea(caseRes.data.area_of_law ?? null);
      setLoading(false);
    });
  }, [user, caseId, refreshKey]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((d) => d.area_of_law && set.add(d.area_of_law));
    if (caseArea) set.add(caseArea);
    return Array.from(set).sort();
  }, [docs, caseArea]);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (areaFilter !== "all" && (d.area_of_law ?? "") !== areaFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.document_type.toLowerCase().includes(q)
      );
    });
  }, [docs, query, areaFilter]);

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
        fullPage ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
              <button
                onClick={() => setSelectedDoc(null)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
              >
                <ArrowLeft className="size-3.5" />
                Voltar à lista
              </button>
            </div>
            <LegalEditor
              key={selectedDoc.id}
              documentId={selectedDoc.id}
              initialContent={selectedDoc.content}
              title={selectedDoc.title}
              documentType={selectedDoc.document_type}
              areaOfLaw={selectedDoc.area_of_law ?? caseArea}
            />
          </div>
        ) : (
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
        )
      ) : (
        <div className="flex-1 overflow-y-auto">
          {fullPage && (
            <div className="flex items-center gap-2 p-3 border-b border-border bg-card/60 sticky top-0 z-10">
              <div className="relative flex-1">
                <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por título ou tipo…"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              {areas.length > 0 && (
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Área do direito" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as áreas</SelectItem>
                    {areas.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
          ) : filteredDocs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum resultado para os filtros.</p>
          ) : (
            <div className="divide-y divide-border">
              {filteredDocs.map((doc) => {
                const DocIcon = typeIcons[doc.document_type] || FileText;
                const updated = doc.updated_at ?? doc.created_at;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-muted/50 transition-colors group"
                  >
                    <DocIcon className="size-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {doc.document_type} · atualizado {formatDate(updated)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {doc.area_of_law && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            {doc.area_of_law}
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground">
                          {doc.word_count ?? 0} palavras
                        </span>
                        {(doc.revision_count ?? 0) > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                            {doc.revision_count} revisões
                          </span>
                        )}
                      </div>
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
