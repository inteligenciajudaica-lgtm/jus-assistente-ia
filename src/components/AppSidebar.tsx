import { LogOut, Shield } from "lucide-react";
import { LayoutDashboard, FolderOpen, CalendarClock, FileText, MessageSquare, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface NavItem {
  icon: React.ElementType;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Painel de Controle", section: "Gestão Central" },
  { icon: FolderOpen, label: "Processos Ativos", section: "Gestão Central" },
  { icon: CalendarClock, label: "Agenda de Prazos", section: "Gestão Central" },
  { icon: FileText, label: "Biblioteca de Peças", section: "Gestão Central" },
  { icon: MessageSquare, label: "Copiloto Jurídico", section: "Inteligência" },
  { icon: BarChart3, label: "Análise de Risco", section: "Inteligência" },
];

interface AppSidebarProps {
  activeItem?: string;
  onNavigate?: (label: string) => void;
}

export function AppSidebar({ activeItem = "Painel de Controle", onNavigate }: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [profile, setProfile] = useState<{ full_name: string | null; oab_number: string | null; oab_state: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, oab_number, oab_state").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  let lastSection = "";

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside className="w-64 border-r border-border flex flex-col shrink-0 bg-card">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-mono font-bold text-sm">
            JA
          </div>
          <span className="font-semibold tracking-tight text-lg">JURIS AI</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const showSection = item.section !== lastSection;
          if (showSection) lastSection = item.section!;
          const isActive = item.label === activeItem;
          return (
            <div key={item.label}>
              {showSection && (
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 mt-6 first:mt-0 px-2">
                  {item.section}
                </div>
              )}
              <button
                onClick={() => onNavigate?.(item.label)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 w-full text-left rounded-sm text-sm transition-colors",
                  isActive
                    ? "bg-muted border border-border font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            </div>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="px-4 pb-2">
          <Link
            to="/admin"
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-sm text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Shield className="size-4" />
            Painel Admin
          </Link>
        </div>
      )}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="size-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{profile?.full_name || user?.email}</p>
            {profile?.oab_number && (
              <p className="text-xs text-muted-foreground truncate">
                OAB/{profile.oab_state} {profile.oab_number}
              </p>
            )}
          </div>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors" title="Sair">
            <LogOut className="size-4" />
          </button>
      </div>
    </aside>
  );
}
