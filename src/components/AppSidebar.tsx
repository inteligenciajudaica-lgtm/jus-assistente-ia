import { LogOut, Shield, Zap, User } from "lucide-react";
import { LayoutDashboard, FolderOpen, CalendarClock, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useLocation } from "react-router-dom";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  section?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Painel de Controle", path: "/", section: "Gestão Central" },
  { icon: FolderOpen, label: "Processos Ativos", path: "/processos", section: "Gestão Central" },
  { icon: CalendarClock, label: "Agenda de Prazos", path: "/prazos", section: "Gestão Central" },
  { icon: FileText, label: "Documentos", path: "/documentos", section: "Gestão Central" },
  { icon: MessageSquare, label: "Conversas", path: "/conversas", section: "Gestão Central" },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const location = useLocation();
  const [profile, setProfile] = useState<{ full_name: string | null; oab_number: string | null; oab_state: string | null } | null>(null);
  const [credits, setCredits] = useState<{ credits_total: number; credits_used: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("full_name, oab_number, oab_state").eq("user_id", user.id).single(),
      supabase.from("user_credits").select("credits_total, credits_used").eq("user_id", user.id).single(),
    ]).then(([profileRes, creditsRes]) => {
      if (profileRes.data) setProfile(profileRes.data);
      if (creditsRes.data) setCredits(creditsRes.data);
    });
  }, [user]);

  let lastSection = "";

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside className="w-64 border-r border-border flex flex-col shrink-0 bg-sidebar/95 backdrop-blur-sm">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-gradient-to-br from-primary to-primary/80 rounded-md flex items-center justify-center text-primary-foreground font-mono font-bold text-sm shadow-sm-soft">
            JA
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight text-[15px]">JURIS AI</span>
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase">Legal Copilot</span>
          </div>
        </div>
      </div>

      {/* Credit control */}
      <div className="px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="size-3.5 text-accent" />
          <span className="text-xs font-medium truncate">{profile?.full_name || user?.email || "Usuário"}</span>
        </div>
        {credits && (
          <>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-full transition-all duration-500"
                style={{ width: `${credits.credits_total > 0 ? Math.min((credits.credits_used / credits.credits_total) * 100, 100) : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground tabular-nums">{credits.credits_used} usados</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{credits.credits_total} total</span>
            </div>
          </>
        )}
        {!credits && (
          <p className="text-[10px] text-muted-foreground">Sem plano ativo</p>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const showSection = item.section !== lastSection;
          if (showSection) lastSection = item.section!;
          const isActive = location.pathname === item.path;
          return (
            <div key={item.label}>
              {showSection && (
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 mt-5 first:mt-1 px-3">
                  {item.section}
                </div>
              )}
              <Link
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm surface-interactive relative",
                  isActive
                    ? "bg-muted text-foreground font-medium shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-full" />
                )}
                <item.icon className={cn("size-4 transition-colors", isActive ? "text-accent" : "")} />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="px-3 pb-2">
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm surface-interactive",
              location.pathname === "/admin"
                ? "bg-muted text-foreground font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Shield className={cn("size-4", location.pathname === "/admin" ? "text-accent" : "")} />
            Painel Admin
          </Link>
        </div>
      )}

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 surface-interactive">
          <Link to="/perfil" className="size-9 rounded-full bg-gradient-to-br from-muted to-muted/60 border border-border flex items-center justify-center text-xs font-semibold hover:ring-2 hover:ring-accent/30 surface-interactive">
            {initials}
          </Link>
          <div className="min-w-0 flex-1">
            <Link to="/perfil" className="text-sm font-medium truncate block hover:text-accent transition-colors">
              {profile?.full_name || user?.email}
            </Link>
            {profile?.oab_number && (
              <p className="text-[11px] text-muted-foreground truncate tabular-nums">
                OAB/{profile.oab_state} {profile.oab_number}
              </p>
            )}
          </div>
          <button onClick={signOut} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10" title="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
