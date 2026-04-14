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
import { Plus } from "lucide-react";

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
      <DialogContent className="max-w-lg">
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
              <Input value={form.case_number} onChange={(e) => setForm({ ...form, case_number: e.target.value })} placeholder="0000000-00.0000.0.00.0000" />
            </div>
            <div className="space-y-2">
              <Label>Estado (UF)</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="SP" maxLength={2} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tribunal</Label>
              <Input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} placeholder="TJSP" />
            </div>
            <div className="space-y-2">
              <Label>Vara</Label>
              <Input value={form.court_division} onChange={(e) => setForm({ ...form, court_division: e.target.value })} placeholder="4ª Vara Cível" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Área do Direito</Label>
            <Input value={form.area_of_law} onChange={(e) => setForm({ ...form, area_of_law: e.target.value })} placeholder="Cível, Trabalhista, etc." />
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
