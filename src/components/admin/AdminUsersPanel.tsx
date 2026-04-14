import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPlus, Shield, Trash2 } from "lucide-react";

interface UserWithProfile {
  id: string;
  email: string;
  full_name: string | null;
  oab_number: string | null;
  oab_state: string | null;
  created_at: string;
  credits_total: number;
  credits_used: number;
  plan_name: string | null;
  roles: string[];
}

export function AdminUsersPanel() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDialog, setRoleDialog] = useState<{ userId: string; email: string } | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    // Fetch profiles (admin can see all via RLS)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, oab_number, oab_state, created_at");

    const { data: credits } = await supabase
      .from("user_credits")
      .select("user_id, credits_total, credits_used, plans(name)");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (profiles) {
      const mapped = profiles.map((p) => {
        const credit = credits?.find((c) => c.user_id === p.user_id);
        const userRoles = roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role) || [];
        return {
          id: p.user_id,
          email: "",
          full_name: p.full_name,
          oab_number: p.oab_number,
          oab_state: p.oab_state,
          created_at: p.created_at,
          credits_total: credit?.credits_total || 0,
          credits_used: credit?.credits_used || 0,
          plan_name: (credit as any)?.plans?.name || "Sem plano",
          roles: userRoles,
        };
      });
      setUsers(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const addRole = async (userId: string, role: "admin" | "moderator" | "user") => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Role "${role}" adicionada!` });
      setRoleDialog(null);
      loadUsers();
    }
  };

  const removeRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Role "${role}" removida` });
      loadUsers();
    }
  };

  const updateCredits = async (userId: string, credits: number) => {
    const { error } = await supabase
      .from("user_credits")
      .update({ credits_total: credits })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Créditos atualizados!" });
      loadUsers();
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Carregando usuários...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Usuários ({users.length})</h2>
      </div>

      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground font-medium">
            <tr>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">OAB</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Créditos</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{u.id.slice(0, 8)}...</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.oab_number ? `OAB/${u.oab_state} ${u.oab_number}` : "—"}
                </td>
                <td className="px-4 py-3">{u.plan_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{u.credits_used}/{u.credits_total}</span>
                    <button
                      onClick={() => {
                        const val = prompt("Novo total de créditos:", String(u.credits_total));
                        if (val) updateCredits(u.id, parseInt(val));
                      }}
                      className="text-[10px] text-accent underline"
                    >
                      Editar
                    </button>
                  </div>
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
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Dialog open={roleDialog?.userId === u.id} onOpenChange={(o) => !o && setRoleDialog(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setRoleDialog({ userId: u.id, email: u.full_name || "" })}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
