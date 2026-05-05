import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Upload, X, FileText, Image as ImageIcon, File, CheckCircle2, AlertCircle, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

type UploadStatus = "pending" | "uploading" | "done" | "error";

interface FileItem {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: UploadStatus;
  error?: string;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="size-5 text-info" />;
  if (type.includes("pdf")) return <FileText className="size-5 text-destructive" />;
  return <File className="size-5 text-muted-foreground" />;
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
  const [items, setItems] = useState<FileItem[]>([]);
  const [caseId, setCaseId] = useState(preselectedCaseId || "");
  const [cases, setCases] = useState<{ id: string; client_name: string; case_number: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preselectedCaseId) setCaseId(preselectedCaseId);
  }, [preselectedCaseId]);

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

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const toAdd: FileItem[] = [];
    Array.from(incoming).forEach((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast({
          title: "Tipo não suportado",
          description: `${f.name} — aceitos: PDF, DOC, DOCX, PNG, JPG, WEBP`,
          variant: "destructive",
        });
        return;
      }
      if (f.size > MAX_SIZE) {
        toast({
          title: "Arquivo grande demais",
          description: `${f.name} excede 10 MB`,
          variant: "destructive",
        });
        return;
      }
      toAdd.push({
        id: crypto.randomUUID(),
        file: f,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        progress: 0,
        status: "pending",
      });
    });
    if (toAdd.length) setItems((prev) => [...prev, ...toAdd]);
  }, [toast]);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearCompleted = () => {
    setItems((prev) => {
      prev.filter((p) => p.status === "done").forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      return prev.filter((p) => p.status !== "done");
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const updateItem = (id: string, patch: Partial<FileItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const pendingCount = useMemo(
    () => items.filter((i) => i.status === "pending" || i.status === "error").length,
    [items]
  );

  const handleUpload = async () => {
    if (!user || !caseId || pendingCount === 0) return;
    setUploading(true);

    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
      if (item.status === "done") continue;
      updateItem(item.id, { status: "uploading", progress: 10, error: undefined });

      try {
        const ext = item.file.name.split(".").pop();
        const storagePath = `${user.id}/${caseId}/${crypto.randomUUID()}.${ext}`;

        // Simulated incremental progress (Supabase JS doesn't expose real upload progress)
        const tick = setInterval(() => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id && i.status === "uploading" && i.progress < 85
                ? { ...i, progress: i.progress + 10 }
                : i
            )
          );
        }, 200);

        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(storagePath, item.file);

        clearInterval(tick);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from("case_documents").insert({
          user_id: user.id,
          case_id: caseId,
          name: item.file.name,
          file_url: storagePath,
          file_type: item.file.type,
          file_size: item.file.size,
        });

        if (dbError) throw dbError;

        updateItem(item.id, { status: "done", progress: 100 });
        successCount++;
      } catch (e: any) {
        updateItem(item.id, { status: "error", progress: 0, error: e.message || "Falha no envio" });
        errorCount++;
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast({
        title: `${successCount} documento(s) enviado(s)`,
        description: errorCount > 0 ? `${errorCount} falharam — revise abaixo.` : undefined,
      });
      onUploaded?.();
    }
    if (errorCount === 0 && successCount > 0) {
      // Auto close after short delay
      setTimeout(() => {
        setItems([]);
        setOpen(false);
      }, 800);
    }
  };

  const overallProgress = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(items.reduce((s, i) => s + i.progress, 0) / items.length);
  }, [items]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!uploading) setOpen(o);
        if (!o) {
          items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
          setItems([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="size-3.5" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="size-5 text-accent" />
            Enviar Documentos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Vincular ao Processo *</label>
            <Select value={caseId} onValueChange={setCaseId} disabled={uploading}>
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
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 group ${
              dragOver
                ? "border-accent bg-accent/10 scale-[1.01] shadow-glow"
                : "border-border hover:border-accent/50 hover:bg-muted/40"
            } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <div
              className={`mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-gradient-primary/10 transition-transform ${
                dragOver ? "scale-110" : "group-hover:scale-105"
              }`}
            >
              <UploadCloud className={`size-7 ${dragOver ? "text-accent" : "text-muted-foreground"}`} />
            </div>
            <p className="text-sm font-medium">
              {dragOver ? (
                "Solte os arquivos para enviar"
              ) : (
                <>
                  Arraste arquivos aqui ou{" "}
                  <span className="text-accent font-semibold underline-offset-4 group-hover:underline">
                    clique para selecionar
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              PDF, DOC, DOCX, PNG, JPG, WEBP — máx. 10 MB cada
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {items.length} arquivo(s) • {formatSize(items.reduce((s, i) => s + i.file.size, 0))}
                </span>
                {items.some((i) => i.status === "done") && !uploading && (
                  <button
                    onClick={clearCompleted}
                    className="text-accent hover:underline font-medium"
                  >
                    Limpar concluídos
                  </button>
                )}
              </div>

              {uploading && <Progress value={overallProgress} className="h-1" />}

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                      it.status === "done"
                        ? "border-success/30 bg-success/5"
                        : it.status === "error"
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-border bg-muted/40"
                    }`}
                  >
                    <div className="size-10 shrink-0 rounded-md bg-background border border-border flex items-center justify-center overflow-hidden">
                      {it.preview ? (
                        <img src={it.preview} alt={it.file.name} className="size-full object-cover" />
                      ) : (
                        fileIcon(it.file.type)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{it.file.name}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatSize(it.file.size)}
                        </span>
                      </div>
                      {it.status === "uploading" && (
                        <Progress value={it.progress} className="h-1 mt-1.5" />
                      )}
                      {it.status === "error" && (
                        <p className="text-xs text-destructive mt-0.5 truncate">{it.error}</p>
                      )}
                      {it.status === "done" && (
                        <p className="text-xs text-success mt-0.5">Enviado com sucesso</p>
                      )}
                      {it.status === "pending" && (
                        <p className="text-xs text-muted-foreground mt-0.5">Aguardando envio</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {it.status === "uploading" ? (
                        <Loader2 className="size-4 text-accent animate-spin" />
                      ) : it.status === "done" ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : it.status === "error" ? (
                        <AlertCircle className="size-4 text-destructive" />
                      ) : (
                        <button
                          onClick={() => removeItem(it.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remover"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            className="w-full"
            disabled={uploading || !caseId || pendingCount === 0}
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando... ({overallProgress}%)
              </>
            ) : (
              `Enviar ${pendingCount} arquivo(s)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
