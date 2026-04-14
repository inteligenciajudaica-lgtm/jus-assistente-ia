import { useState, useEffect } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DOCUMENT_TYPES = [
  { value: "petição inicial", label: "Petição Inicial" },
  { value: "contestação", label: "Contestação" },
  { value: "recurso", label: "Recurso" },
  { value: "parecer", label: "Parecer Jurídico" },
  { value: "contrato", label: "Contrato" },
  { value: "procuração", label: "Procuração" },
  { value: "notificação", label: "Notificação Extrajudicial" },
  { value: "habeas corpus", label: "Habeas Corpus" },
];

export function GenerateDocumentDialog() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<{ id: string; client_name: string; case_number: string | null }[]>([]);

  const [docType, setDocType] = useState("");
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState("");
  const [court, setCourt] = useState("");
  const [courtDivision, setCourtDivision] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [defendantName, setDefendantName] = useState("");
  const [facts, setFacts] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [requests, setRequests] = useState("");

  useEffect(() => {
    if (open && session) {
      supabase.from("cases").select("id, client_name, case_number").then(({ data }) => {
        if (data) setCases(data);
      });
    }
  }, [open, session]);

  const handleGenerate = async () => {
    if (!docType || !facts.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha o tipo de documento e os fatos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const body = {
        document_type: docType,
        title: title || docType,
        court: court || undefined,
        court_division: courtDivision || undefined,
        parties: (authorName || defendantName) ? { author: authorName, defendant: defendantName } : undefined,
        facts,
        legal_basis: legalBasis || undefined,
        requests: requests.trim() ? requests.split("\n").filter(r => r.trim()) : undefined,
        case_id: caseId || undefined,
      };

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docType.replace(/\s+/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Documento gerado!", description: "O download iniciou automaticamente." });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao gerar documento", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="size-4" />
          Gerar Peça
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Peça Jurídica (.docx)</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(dt => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Processo Vinculado</Label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.client_name}{c.case_number ? ` (${c.case_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Título do Documento</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Petição Inicial - Ação de Indenização" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tribunal / Vara</Label>
              <Input value={court} onChange={e => setCourt(e.target.value)} placeholder="Ex: Tribunal de Justiça de SP" />
            </div>
            <div className="space-y-2">
              <Label>Vara / Divisão</Label>
              <Input value={courtDivision} onChange={e => setCourtDivision(e.target.value)} placeholder="Ex: 3ª Vara Cível" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Autor</Label>
              <Input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Nome do autor" />
            </div>
            <div className="space-y-2">
              <Label>Réu</Label>
              <Input value={defendantName} onChange={e => setDefendantName(e.target.value)} placeholder="Nome do réu" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fatos *</Label>
            <Textarea value={facts} onChange={e => setFacts(e.target.value)} placeholder="Descreva os fatos relevantes do caso..." rows={4} />
          </div>

          <div className="space-y-2">
            <Label>Fundamentação Jurídica</Label>
            <Textarea value={legalBasis} onChange={e => setLegalBasis(e.target.value)} placeholder="Base legal, artigos de lei, doutrina..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Pedidos (um por linha)</Label>
            <Textarea value={requests} onChange={e => setRequests(e.target.value)} placeholder="Ex: Condenação do réu ao pagamento de R$ 10.000,00&#10;Inversão do ônus da prova" rows={3} />
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {loading ? "Gerando documento..." : "Gerar e Baixar .docx"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
