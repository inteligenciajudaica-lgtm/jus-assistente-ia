import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Image, File, Download } from "lucide-react";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";

interface Doc {
  id: string;
  name: string;
  file_type: string | null;
  file_size: number | null;
  file_url: string;
  created_at: string;
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

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const hours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  if (hours < 1) return "Agora";
  if (hours < 24) return `${Math.floor(hours)}h atrás`;
  if (hours < 48) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function DocumentsWidget() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("case_documents")
      .select("id, name, file_type, file_size, file_url, created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setDocs(data);
      });
  }, [user, refreshKey]);

  const handleDownload = async (doc: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <div className="bg-card border border-border p-5 rounded-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-sm">Documentos</h3>
        <DocumentUploadDialog onUploaded={() => setRefreshKey((k) => k + 1)} />
      </div>
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum documento enviado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 border border-border bg-muted/30 rounded-sm hover:bg-muted/60 transition-colors cursor-pointer group"
              onClick={() => handleDownload(doc)}
            >
              {docIcon(doc.file_type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(doc.file_size)} · {timeAgo(doc.created_at)}</p>
              </div>
              <Download className="size-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
