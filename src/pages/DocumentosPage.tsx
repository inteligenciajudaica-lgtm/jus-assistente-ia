import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { GenerateDocumentDialog } from "@/components/GenerateDocumentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Image, File, Download, Search } from "lucide-react";

interface Doc {
  id: string;
  name: string;
  file_type: string | null;
  file_size: number | null;
  file_url: string;
  created_at: string;
  case_id: string;
  case_name?: string;
}

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

export default function DocumentosPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("case_documents")
        .select("id, name, file_type, file_size, file_url, created_at, case_id")
        .order("created_at", { ascending: false });

      if (data) {
        // Fetch case names
        const caseIds = [...new Set(data.map((d) => d.case_id))];
        const { data: cases } = await supabase.from("cases").select("id, client_name").in("id", caseIds);
        const caseMap = new Map(cases?.map((c) => [c.id, c.client_name]) || []);
        setDocs(data.map((d) => ({ ...d, case_name: caseMap.get(d.case_id) || "—" })));
      }
      setLoading(false);
    };
    load();
  }, [user, refreshKey]);

  const handleDownload = async (doc: Doc) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const filtered = docs.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || (d.case_name?.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <section className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-medium">Biblioteca de Documentos</h1>
            <div className="flex items-center gap-2">
              <GenerateDocumentDialog />
              <DocumentUploadDialog onUploaded={() => setRefreshKey((k) => k + 1)} />
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center bg-card border border-border rounded-sm px-3 py-2 max-w-md">
            <Search className="size-3.5 text-muted-foreground mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar documentos..."
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60"
            />
            <span className="text-xs text-muted-foreground ml-2">{filtered.length}</span>
          </div>

          {loading ? (
            <div className="bg-card border border-border rounded-sm p-8 text-center text-muted-foreground text-sm">
              Carregando documentos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-sm p-8 text-center text-muted-foreground text-sm">
              {docs.length === 0 ? "Nenhum documento enviado ainda." : "Nenhum resultado encontrado."}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground font-medium">
                  <tr>
                    <th className="font-medium px-4 py-3">Documento</th>
                    <th className="font-medium px-4 py-3">Processo</th>
                    <th className="font-medium px-4 py-3">Tipo</th>
                    <th className="font-medium px-4 py-3">Tamanho</th>
                    <th className="font-medium px-4 py-3 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => handleDownload(doc)}
                      className="hover:bg-muted/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {docIcon(doc.file_type)}
                          <span className="font-medium truncate max-w-[250px]">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{doc.case_name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{doc.file_type?.split("/").pop() || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatSize(doc.file_size)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{formatDate(doc.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
