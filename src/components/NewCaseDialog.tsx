import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus } from "lucide-react";

const ESTADOS_BR = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];

const TRIBUNAIS = [
  // Superiores
  "STF – Supremo Tribunal Federal",
  "STJ – Superior Tribunal de Justiça",
  "TST – Tribunal Superior do Trabalho",
  "TSE – Tribunal Superior Eleitoral",
  "STM – Superior Tribunal Militar",
  // Federais
  "TRF1 – Tribunal Regional Federal da 1ª Região",
  "TRF2 – Tribunal Regional Federal da 2ª Região",
  "TRF3 – Tribunal Regional Federal da 3ª Região",
  "TRF4 – Tribunal Regional Federal da 4ª Região",
  "TRF5 – Tribunal Regional Federal da 5ª Região",
  "TRF6 – Tribunal Regional Federal da 6ª Região",
  // Estaduais
  "TJAC – Tribunal de Justiça do Acre",
  "TJAL – Tribunal de Justiça de Alagoas",
  "TJAP – Tribunal de Justiça do Amapá",
  "TJAM – Tribunal de Justiça do Amazonas",
  "TJBA – Tribunal de Justiça da Bahia",
  "TJCE – Tribunal de Justiça do Ceará",
  "TJDFT – Tribunal de Justiça do Distrito Federal",
  "TJES – Tribunal de Justiça do Espírito Santo",
  "TJGO – Tribunal de Justiça de Goiás",
  "TJMA – Tribunal de Justiça do Maranhão",
  "TJMT – Tribunal de Justiça de Mato Grosso",
  "TJMS – Tribunal de Justiça de Mato Grosso do Sul",
  "TJMG – Tribunal de Justiça de Minas Gerais",
  "TJPA – Tribunal de Justiça do Pará",
  "TJPB – Tribunal de Justiça da Paraíba",
  "TJPR – Tribunal de Justiça do Paraná",
  "TJPE – Tribunal de Justiça de Pernambuco",
  "TJPI – Tribunal de Justiça do Piauí",
  "TJRJ – Tribunal de Justiça do Rio de Janeiro",
  "TJRN – Tribunal de Justiça do Rio Grande do Norte",
  "TJRS – Tribunal de Justiça do Rio Grande do Sul",
  "TJRO – Tribunal de Justiça de Rondônia",
  "TJRR – Tribunal de Justiça de Roraima",
  "TJSC – Tribunal de Justiça de Santa Catarina",
  "TJSP – Tribunal de Justiça de São Paulo",
  "TJSE – Tribunal de Justiça de Sergipe",
  "TJTO – Tribunal de Justiça do Tocantins",
  // Trabalhistas
  "TRT1 – Tribunal Regional do Trabalho da 1ª Região (RJ)",
  "TRT2 – Tribunal Regional do Trabalho da 2ª Região (SP)",
  "TRT3 – Tribunal Regional do Trabalho da 3ª Região (MG)",
  "TRT4 – Tribunal Regional do Trabalho da 4ª Região (RS)",
  "TRT5 – Tribunal Regional do Trabalho da 5ª Região (BA)",
  "TRT6 – Tribunal Regional do Trabalho da 6ª Região (PE)",
  "TRT7 – Tribunal Regional do Trabalho da 7ª Região (CE)",
  "TRT8 – Tribunal Regional do Trabalho da 8ª Região (PA/AP)",
  "TRT9 – Tribunal Regional do Trabalho da 9ª Região (PR)",
  "TRT10 – Tribunal Regional do Trabalho da 10ª Região (DF/TO)",
  "TRT11 – Tribunal Regional do Trabalho da 11ª Região (AM/RR)",
  "TRT12 – Tribunal Regional do Trabalho da 12ª Região (SC)",
  "TRT13 – Tribunal Regional do Trabalho da 13ª Região (PB)",
  "TRT14 – Tribunal Regional do Trabalho da 14ª Região (RO/AC)",
  "TRT15 – Tribunal Regional do Trabalho da 15ª Região (Campinas)",
  "TRT16 – Tribunal Regional do Trabalho da 16ª Região (MA)",
  "TRT17 – Tribunal Regional do Trabalho da 17ª Região (ES)",
  "TRT18 – Tribunal Regional do Trabalho da 18ª Região (GO)",
  "TRT19 – Tribunal Regional do Trabalho da 19ª Região (AL)",
  "TRT20 – Tribunal Regional do Trabalho da 20ª Região (SE)",
  "TRT21 – Tribunal Regional do Trabalho da 21ª Região (RN)",
  "TRT22 – Tribunal Regional do Trabalho da 22ª Região (PI)",
  "TRT23 – Tribunal Regional do Trabalho da 23ª Região (MT)",
  "TRT24 – Tribunal Regional do Trabalho da 24ª Região (MS)",
];

const VARAS = [
  // Cíveis
  "1ª Vara Cível",
  "2ª Vara Cível",
  "3ª Vara Cível",
  "4ª Vara Cível",
  "5ª Vara Cível",
  "6ª Vara Cível",
  "7ª Vara Cível",
  "8ª Vara Cível",
  "9ª Vara Cível",
  "10ª Vara Cível",
  // Criminais
  "1ª Vara Criminal",
  "2ª Vara Criminal",
  "3ª Vara Criminal",
  "4ª Vara Criminal",
  "5ª Vara Criminal",
  // Família
  "1ª Vara de Família e Sucessões",
  "2ª Vara de Família e Sucessões",
  "3ª Vara de Família e Sucessões",
  // Fazenda Pública
  "1ª Vara da Fazenda Pública",
  "2ª Vara da Fazenda Pública",
  "3ª Vara da Fazenda Pública",
  // Trabalho
  "1ª Vara do Trabalho",
  "2ª Vara do Trabalho",
  "3ª Vara do Trabalho",
  "4ª Vara do Trabalho",
  "5ª Vara do Trabalho",
  // Federal
  "1ª Vara Federal",
  "2ª Vara Federal",
  "3ª Vara Federal",
  "4ª Vara Federal",
  "5ª Vara Federal",
  // Juizados
  "Juizado Especial Cível",
  "Juizado Especial Criminal",
  "Juizado Especial da Fazenda Pública",
  "Juizado Especial Federal",
  // Especializadas
  "Vara de Execuções Penais",
  "Vara de Execuções Fiscais",
  "Vara de Registros Públicos",
  "Vara Empresarial",
  "Vara de Falências e Recuperações Judiciais",
  "Vara da Infância e Juventude",
  "Vara do Idoso",
  "Vara de Violência Doméstica",
  "Vara de Meio Ambiente",
  "Vara de Precatórias",
  "Vara do Tribunal do Júri",
  "Vara de Órfãos e Sucessões",
];

const AREAS_DIREITO = [
  "Administrativo",
  "Ambiental",
  "Bancário",
  "Civil",
  "Constitucional",
  "Consumidor",
  "Contratual",
  "Criminal / Penal",
  "Digital / Tecnologia",
  "Eleitoral",
  "Empresarial / Societário",
  "Família e Sucessões",
  "Falência e Recuperação Judicial",
  "Imobiliário",
  "Internacional",
  "Militar",
  "Previdenciário",
  "Propriedade Intelectual",
  "Seguros",
  "Trabalhista",
  "Tributário / Fiscal",
  "Trânsito",
];

function formatCaseNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 20);
  let formatted = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 7) formatted += "-";
    if (i === 9) formatted += ".";
    if (i === 13) formatted += ".";
    if (i === 14) formatted += ".";
    if (i === 16) formatted += ".";
    formatted += digits[i];
  }
  return formatted;
}

interface NewCaseDialogProps {
  onCreated?: () => void;
}

export function NewCaseDialog({ onCreated }: NewCaseDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    case_number: "",
    court: "",
    court_division: "",
    area_of_law: "",
    state: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("cases").insert({
        user_id: user.id,
        ...form,
      });
      if (error) throw error;
      toast({ title: "Processo criado com sucesso!" });
      setOpen(false);
      setForm({ client_name: "", case_number: "", court: "", court_division: "", area_of_law: "", state: "", description: "" });
      onCreated?.();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Novo Processo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Processo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Cliente *</Label>
            <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nº Processo</Label>
              <Input
                value={form.case_number}
                onChange={(e) => setForm({ ...form, case_number: formatCaseNumber(e.target.value) })}
                placeholder="0000000-00.0000.0.00.0000"
                maxLength={25}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado (UF)</Label>
              <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_BR.map((e) => (
                    <SelectItem key={e.uf} value={e.uf}>{e.uf} – {e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tribunal</Label>
              <Select value={form.court} onValueChange={(v) => setForm({ ...form, court: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TRIBUNAIS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vara</Label>
              <Select value={form.court_division} onValueChange={(v) => setForm({ ...form, court_division: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {VARAS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Área do Direito</Label>
            <Select value={form.area_of_law} onValueChange={(v) => setForm({ ...form, area_of_law: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {AREAS_DIREITO.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-border bg-background rounded-sm p-2 text-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-ring/30"
              placeholder="Breve descrição do caso..."
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar Processo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
