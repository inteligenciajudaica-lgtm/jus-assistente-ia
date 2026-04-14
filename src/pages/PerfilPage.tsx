import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

export default function PerfilPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    office_name: "",
    oab_number: "",
    oab_state: "",
    phone: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, office_name, oab_number, oab_state, phone").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setForm({
          full_name: data.full_name || "",
          office_name: data.office_name || "",
          oab_number: data.oab_number || "",
          oab_state: data.oab_state || "",
          phone: data.phone || "",
        });
      }
      setLoading(false);
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Perfil atualizado com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <section className="flex-1 overflow-y-auto p-8 space-y-6">
          <h1 className="text-xl font-medium">Perfil do Advogado</h1>

          {loading ? (
            <div className="bg-card border border-border rounded-sm p-8 text-center text-muted-foreground text-sm">
              Carregando perfil...
            </div>
          ) : (
            <form onSubmit={handleSave} className="bg-card border border-border rounded-sm p-6 max-w-xl space-y-5">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nome do Escritório</Label>
                <Input value={form.office_name} onChange={(e) => setForm({ ...form, office_name: e.target.value })} placeholder="Ex: Silva & Associados" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº OAB</Label>
                  <Input value={form.oab_number} onChange={(e) => setForm({ ...form, oab_number: e.target.value })} placeholder="123456" />
                </div>
                <div className="space-y-2">
                  <Label>Estado OAB</Label>
                  <Input value={form.oab_state} onChange={(e) => setForm({ ...form, oab_state: e.target.value })} placeholder="SP" maxLength={2} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={user?.email || ""} disabled className="opacity-60" />
              </div>
              <Button type="submit" disabled={saving} className="gap-1.5">
                <Save className="size-3.5" />
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
