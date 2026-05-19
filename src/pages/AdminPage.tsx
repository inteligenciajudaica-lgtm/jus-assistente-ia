import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { AdminPlansPanel } from "@/components/admin/AdminPlansPanel";
import { AdminAISettings } from "@/components/admin/AdminAISettings";
import { AdminJurisprudenceSettings } from "@/components/admin/AdminJurisprudenceSettings";
import { AdminProcessTracking } from "@/components/admin/AdminProcessTracking";
import { AdminApiKeys } from "@/components/admin/AdminApiKeys";
import { AdminSystemNotices } from "@/components/admin/AdminSystemNotices";
import { Settings, Users, CreditCard, ArrowLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type AdminTab = "users" | "plans" | "settings";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [tab, setTab] = useState<AdminTab>("users");
  const [navOpen, setNavOpen] = useState(false);

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

  const handleSelect = (id: AdminTab) => {
    setTab(id);
    setNavOpen(false);
  };

  const AdminNav = ({ onSelect }: { onSelect: (id: AdminTab) => void }) => (
    <div className="flex flex-col h-full bg-card">
      <div className="p-5 border-b border-border">
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
            onClick={() => onSelect(t.id)}
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
    </div>
  );

  const currentLabel = tabs.find((t) => t.id === tab)?.label ?? "Admin";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Admin Sidebar — desktop */}
      <aside className="hidden md:flex w-64 border-r border-border flex-col shrink-0">
        <AdminNav onSelect={handleSelect} />
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Mobile topbar */}
        <header className="md:hidden h-14 border-b border-border surface-glass flex items-center gap-2 px-3 sticky top-0 z-30">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu admin">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 max-w-[85vw] border-r border-border">
              <AdminNav onSelect={handleSelect} />
            </SheetContent>
          </Sheet>
          <div className="size-7 bg-destructive rounded flex items-center justify-center text-destructive-foreground font-mono font-bold text-[11px] shrink-0">
            AD
          </div>
          <span className="text-sm font-semibold truncate">{currentLabel}</span>
        </header>

        <div className="p-4 sm:p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            {tab === "users" && <AdminUsersPanel />}
            {tab === "plans" && <AdminPlansPanel />}
            {tab === "settings" && (
              <div className="space-y-6 sm:space-y-8">
                <AdminAISettings />
                <AdminApiKeys />
                <AdminSystemNotices />
                <AdminJurisprudenceSettings />
                <AdminProcessTracking />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
