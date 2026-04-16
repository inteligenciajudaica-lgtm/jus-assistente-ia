import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Image, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="size-4 text-info" />;
  if (type.includes("pdf")) return <FileText className="size-4 text-destructive" />;
  return <File className="size-4 text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentUploadDialogProps {
  onUploaded?: () => void;
  preselectedCaseId?: string;
}

export function DocumentUploadDialog({ onUploaded, preselectedCaseId }: DocumentUploadDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [caseId, setCaseId] = useState(preselectedCaseId || "");
  const [cases, setCases] = useState<{ id: string; client_name: string; case_number: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !open) return;
    supabase
      .from("cases")
      .select("id, client_name, case_number")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCases(data);
      });
  }, [user, open]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast({ title: "Tipo não suportado", description: `${f.name} — aceitos: PDF, DOC, DOCX, PNG, JPG, WEBP`, variant: "destructive" });
        return false;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: "Arquivo grande demais", description: `${f.name} excede 10 MB`, variant: "destructive" });
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
  }, [toast]);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleUpload = async () => {
    if (!user || !caseId || files.length === 0) return;
    setUploading(true);

    try {
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const storagePath = `${user.id}/${caseId}/${crypto.randomUUID()}.${ext}`;

        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file);

        if (storageError) throw storageError;

        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(storagePath);

        const { error: dbError } = await supabase.from("case_documents").insert({
          user_id: user.id,
          case_id: caseId,
          name: file.name,
          file_url: storagePath,
          file_type: file.type,
          file_size: file.size,
        });

        if (dbError) throw dbError;
      }

      toast({ title: `${files.length} documento(s) enviado(s) com sucesso!` });
      setFiles([]);
      setCaseId("");
      setOpen(false);
      onUploaded?.();
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="size-3.5" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Documentos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Vincular ao Processo *</label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um processo" />
              </SelectTrigger>
              <SelectContent>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_number || "S/N"} — {c.client_name}
                  </SelectItem>
                ))}
                {cases.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum processo cadastrado
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <Upload className="size-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Arraste arquivos aqui ou <span className="text-primary font-medium">clique para selecionar</span>
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">PDF, DOC, DOCX, PNG, JPG, WEBP — máx. 10 MB</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-muted border border-border rounded-sm">
                  {fileIcon(f.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleUpload}
            className="w-full"
            disabled={uploading || !caseId || files.length === 0}
          >
            {uploading ? "Enviando..." : `Enviar ${files.length} arquivo(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
