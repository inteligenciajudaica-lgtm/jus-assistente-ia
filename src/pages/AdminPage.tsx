import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { AdminPlansPanel } from "@/components/admin/AdminPlansPanel";
import { Settings, Users, CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type AdminTab = "users" | "plans" | "settings";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [tab, setTab] = useState<AdminTab>("users");

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Verificando permissões...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "users", label: "Usuários", icon: Users },
    { id: "plans", label: "Planos & Créditos", icon: CreditCard },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col shrink-0 bg-card">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-destructive rounded flex items-center justify-center text-destructive-foreground font-mono font-bold text-sm">
              AD
            </div>
            <span className="font-semibold tracking-tight text-lg">Admin</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-2">
            Gerenciamento
          </div>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-3 py-2 w-full text-left rounded-sm text-sm transition-colors ${
                tab === t.id
                  ? "bg-muted border border-border font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <Link to="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <ArrowLeft className="size-4" />
              Voltar ao Painel
            </Button>
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl">
          {tab === "users" && <AdminUsersPanel />}
          {tab === "plans" && <AdminPlansPanel />}
          {tab === "settings" && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium">Configurações</h2>
              <div className="bg-card border border-border rounded-sm p-6 space-y-4">
                <h3 className="font-medium text-sm">Provedores de IA</h3>
                <p className="text-xs text-muted-foreground">
                  O sistema utiliza a Lovable AI Gateway por padrão. Para configurar provedores adicionais 
                  (OpenAI, Anthropic, modelos open-source), entre em contato com o suporte.
                </p>
                <div className="p-4 bg-muted rounded-sm">
                  <p className="text-xs font-mono">Modelo atual: google/gemini-3-flash-preview</p>
                  <p className="text-xs font-mono text-muted-foreground">Gateway: ai.gateway.lovable.dev</p>
                  <p className="text-xs font-mono text-muted-foreground">Status: ✅ Conectado</p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-sm p-6 space-y-4">
                <h3 className="font-medium text-sm">Integrações Jurídicas</h3>
                <p className="text-xs text-muted-foreground">
                  Suporte a RAG e bases jurídicas externas será disponibilizado em breve.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border border-border rounded-sm">
                    <p className="text-sm font-medium">Planalto (Legislação)</p>
                    <p className="text-[10px] text-muted-foreground">Em breve</p>
                  </div>
                  <div className="p-3 border border-border rounded-sm">
                    <p className="text-sm font-medium">JusBrasil (Jurisprudência)</p>
                    <p className="text-[10px] text-muted-foreground">Em breve</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
