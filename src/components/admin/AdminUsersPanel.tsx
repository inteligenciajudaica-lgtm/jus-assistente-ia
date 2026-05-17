import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Shield, Trash2, Pencil } from "lucide-react";

interface UserWithProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  oab_number: string | null;
  oab_state: string | null;
  created_at: string;
  credits_total: number;
  credits_used: number;
  plan_id: string | null;
  plan_name: string | null;
  roles: string[];
  suspended: boolean;
}

interface Plan {
  id: string;
  name: string;
  credits_monthly: number;
}

export function AdminUsersPanel() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDialog, setRoleDialog] = useState<{ userId: string } | null>(null);
  const [editing, setEditing] = useState<UserWithProfile | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    plan_id: "",
    credits_total: 0,
    credits_delta: 0,
    suspended: false,
  });
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: credits }, { data: roles }, { data: plansData }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, oab_number, oab_state, created_at"),
      supabase.from("user_credits").select("user_id, credits_total, credits_used, plan_id, plans(name)"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("plans").select("id, name, credits_monthly").order("price_monthly"),
    ]);

    setPlans(plansData || []);

    const baseList: UserWithProfile[] = (profiles || []).map((p) => {
      const credit = credits?.find((c) => c.user_id === p.user_id);
      const userRoles = roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role) || [];
      return {
        id: p.user_id,
        email: null,
        full_name: p.full_name,
        oab_number: p.oab_number,
        oab_state: p.oab_state,
        created_at: p.created_at,
        credits_total: credit?.credits_total || 0,
        credits_used: credit?.credits_used || 0,
        plan_id: (credit as any)?.plan_id || null,
        plan_name: (credit as any)?.plans?.name || "Sem plano",
        roles: userRoles,
        suspended: false,
      };
    });

    // Fetch emails + ban status via edge function
    try {
      const { data: emailRes } = await supabase.functions.invoke("admin-users", {
        body: { action: "list_emails", user_ids: baseList.map((u) => u.id) },
      });
      if ((emailRes as any)?.ok) {
        const map = (emailRes as any).users as Record<string, { email: string | null; banned_until: string | null }>;
        for (const u of baseList) {
          const info = map[u.id];
          if (info) {
            u.email = info.email;
            u.suspended = !!(info.banned_until && new Date(info.banned_until).getTime() > Date.now());
          }
        }
      }
    } catch (e) {
      console.warn("Falha ao buscar emails", e);
    }

    setUsers(baseList);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const addRole = async (userId: string, role: "admin" | "moderator" | "user") => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Role "${role}" adicionada` });
      setRoleDialog(null);
      loadUsers();
    }
  };

  const removeRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role as "admin" | "moderator" | "user");
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Role "${role}" removida` });
      loadUsers();
    }
  };

  const openEdit = (u: UserWithProfile) => {
    setEditing(u);
    setForm({
      email: u.email || "",
      password: "",
      plan_id: u.plan_id || "none",
      credits_total: u.credits_total,
      credits_delta: 0,
      suspended: u.suspended,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // 1) auth changes (email / password / suspend) via edge function
      const authPayload: Record<string, unknown> = { action: "update_user", user_id: editing.id };
      let needsAuth = false;
      if (form.email && form.email !== editing.email) {
        authPayload.email = form.email;
        needsAuth = true;
      }
      if (form.password) {
        if (form.password.length < 6) throw new Error("Senha precisa de no mínimo 6 caracteres");
        authPayload.password = form.password;
        needsAuth = true;
      }
      if (form.suspended !== editing.suspended) {
        authPayload.suspended = form.suspended;
        needsAuth = true;
      }
      if (needsAuth) {
        const { data, error } = await supabase.functions.invoke("admin-users", { body: authPayload });
        if (error) throw error;
        if (!(data as any)?.ok) throw new Error((data as any)?.error || "Erro na atualização");
      }

      // 2) credits + plan changes via direct table (admin RLS allowed)
      const newTotal = form.credits_total + (form.credits_delta || 0);
      const planChanged = (form.plan_id || "none") !== (editing.plan_id || "none");
      const creditsChanged = newTotal !== editing.credits_total;
      if (planChanged || creditsChanged) {
        const updates: { plan_id?: string | null; credits_total?: number } = {};
        if (planChanged) updates.plan_id = form.plan_id === "none" ? null : form.plan_id;
        if (creditsChanged) updates.credits_total = Math.max(0, newTotal);

        // upsert: try update, if no row exists, insert
        const { data: existing } = await supabase
          .from("user_credits")
          .select("id")
          .eq("user_id", editing.id)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase.from("user_credits").update(updates).eq("user_id", editing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_credits").insert({
            user_id: editing.id,
            credits_total: Math.max(0, newTotal),
            credits_used: 0,
            plan_id: form.plan_id === "none" ? null : form.plan_id,
          });
          if (error) throw error;
        }
      }

      toast({ title: "Usuário atualizado" });
      setEditing(null);
      await loadUsers();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Carregando usuários...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Usuários ({users.length})</h2>
      </div>

      <div className="bg-card border border-border rounded-sm overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[760px]">
          <thead className="bg-muted text-muted-foreground font-medium">
            <tr>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Créditos</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.oab_number ? `OAB/${u.oab_state} ${u.oab_number}` : u.id.slice(0, 8) + "..."}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{u.email || "—"}</td>
                <td className="px-4 py-3">{u.plan_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{u.credits_used}/{u.credits_total}</td>
                <td className="px-4 py-3">
                  {u.suspended ? (
                    <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded-sm text-[10px] font-medium">
                      Suspenso
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-sm text-[10px] font-medium">
                      Ativo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {u.roles.map((r) => (
                      <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border rounded-sm text-[10px] font-medium">
                        {r}
                        <button onClick={() => removeRole(u.id, r)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="size-2.5" />
                        </button>
                      </span>
                    ))}
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(u)} title="Editar usuário">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Dialog open={roleDialog?.userId === u.id} onOpenChange={(o) => !o && setRoleDialog(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => setRoleDialog({ userId: u.id })} title="Gerenciar roles">
                          <Shield className="size-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle>Adicionar Role</DialogTitle></DialogHeader>
                        <div className="space-y-2">
                          {(["admin", "moderator", "user"] as const).map((role) => (
                            <Button
                              key={role}
                              variant="outline"
                              className="w-full justify-start"
                              disabled={u.roles.includes(role)}
                              onClick={() => addRole(u.id, role)}
                            >
                              <Shield className="size-4 mr-2" />
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                              {u.roles.includes(role) && " (já atribuída)"}
                            </Button>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">{editing.full_name || "Sem nome"}</div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-pass">Nova senha (opcional)</Label>
                <Input
                  id="edit-pass"
                  type="text"
                  placeholder="Deixe em branco para manter"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem plano</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.credits_monthly} créditos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-total">Total de créditos</Label>
                  <Input
                    id="edit-total"
                    type="number"
                    value={form.credits_total}
                    onChange={(e) => setForm({ ...form, credits_total: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-delta">Adicionar / retirar</Label>
                  <Input
                    id="edit-delta"
                    type="number"
                    placeholder="ex.: 100 ou -50"
                    value={form.credits_delta}
                    onChange={(e) => setForm({ ...form, credits_delta: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              {form.credits_delta !== 0 && (
                <p className="text-xs text-muted-foreground">
                  Novo total: {Math.max(0, form.credits_total + form.credits_delta)}
                </p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <Label>Suspender acesso</Label>
                  <p className="text-xs text-muted-foreground">
                    Usuário suspenso não consegue logar nem usar a plataforma.
                  </p>
                </div>
                <Switch
                  checked={form.suspended}
                  onCheckedChange={(v) => setForm({ ...form, suspended: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
