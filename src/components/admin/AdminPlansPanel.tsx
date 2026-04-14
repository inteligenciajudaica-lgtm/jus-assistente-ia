import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  credits_monthly: number;
  is_active: boolean;
  features: string[];
}

export function AdminPlansPanel() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [newPlan, setNewPlan] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price_monthly: 0, credits_monthly: 0, features: "" });

  const loadPlans = async () => {
    const { data } = await supabase.from("plans").select("*").order("price_monthly");
    if (data) {
      setPlans(data.map((p) => ({ ...p, features: Array.isArray(p.features) ? (p.features as string[]) : [] })));
    }
    setLoading(false);
  };

  useEffect(() => { loadPlans(); }, []);

  const handleSave = async () => {
    const features = form.features.split("\n").filter(Boolean);
    if (editPlan) {
      const { error } = await supabase.from("plans").update({
        name: form.name,
        description: form.description,
        price_monthly: form.price_monthly,
        credits_monthly: form.credits_monthly,
        features,
      }).eq("id", editPlan.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Plano atualizado!" });
    } else {
      const { error } = await supabase.from("plans").insert({
        name: form.name,
        description: form.description,
        price_monthly: form.price_monthly,
        credits_monthly: form.credits_monthly,
        features,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Plano criado!" });
    }
    setEditPlan(null);
    setNewPlan(false);
    loadPlans();
  };

  const toggleActive = async (plan: Plan) => {
    await supabase.from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    loadPlans();
  };

  const openEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      description: plan.description || "",
      price_monthly: plan.price_monthly,
      credits_monthly: plan.credits_monthly,
      features: plan.features.join("\n"),
    });
    setEditPlan(plan);
  };

  const openNew = () => {
    setForm({ name: "", description: "", price_monthly: 0, credits_monthly: 0, features: "" });
    setNewPlan(true);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Carregando planos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Planos de Assinatura</h2>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="size-3.5" /> Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`bg-card border rounded-sm p-5 space-y-3 ${plan.is_active ? "border-border" : "border-destructive/30 opacity-60"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{plan.name}</h3>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(plan)}>
                  <Pencil className="size-3" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => toggleActive(plan)}>
                  {plan.is_active ? <ToggleRight className="size-4 text-success" /> : <ToggleLeft className="size-4" />}
                </Button>
              </div>
            </div>
            <p className="text-2xl font-semibold">
              {plan.price_monthly === 0 ? "Grátis" : `R$ ${plan.price_monthly}`}
              {plan.price_monthly > 0 && <span className="text-sm text-muted-foreground font-normal">/mês</span>}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{plan.credits_monthly} créditos/mês</p>
            <ul className="space-y-1">
              {plan.features.map((f, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="text-success">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Edit/New Dialog */}
      <Dialog open={!!editPlan || newPlan} onOpenChange={(o) => { if (!o) { setEditPlan(null); setNewPlan(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Preço Mensal (R$)</Label>
                <Input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: parseFloat(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Créditos/Mês</Label>
                <Input type="number" value={form.credits_monthly} onChange={(e) => setForm({ ...form, credits_monthly: parseInt(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Funcionalidades (uma por linha)</Label>
              <textarea
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                className="w-full border border-border bg-background rounded-sm p-2 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            </div>
            <Button className="w-full" onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
