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
    <aside className="w-64 border-r border-border flex flex-col shrink-0 bg-sidebar relative overflow-hidden">
      {/* Aurora background accent */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-aurora opacity-60" />

      <div className="relative px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative size-10 rounded-xl bg-gradient-primary flex items-center justify-center text-white font-mono font-bold text-sm shadow-glow">
            <span className="relative z-10">JA</span>
            <div className="absolute inset-0 rounded-xl bg-gradient-primary blur-md opacity-50 -z-0" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight text-[15px]">JURIS<span className="text-gradient-primary"> AI</span></span>
            <span className="text-[10px] text-muted-foreground tracking-[0.18em] uppercase">Legal Copilot</span>
          </div>
        </div>
      </div>

      {/* Credit control */}
      <div className="relative px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="size-5 rounded-md bg-accent/10 flex items-center justify-center">
            <Zap className="size-3 text-accent" />
          </div>
          <span className="text-xs font-medium truncate">{profile?.full_name || user?.email || "Usuário"}</span>
        </div>
        {credits && (
          <>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-primary rounded-full transition-all duration-700 ease-out relative"
                style={{ width: `${credits.credits_total > 0 ? Math.min((credits.credits_used / credits.credits_total) * 100, 100) : 0}%` }}
              >
                <div className="absolute inset-0 animate-shimmer" />
              </div>
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

      <nav className="relative flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const showSection = item.section !== lastSection;
          if (showSection) lastSection = item.section!;
          const isActive = location.pathname === item.path;
          return (
            <div key={item.label}>
              {showSection && (
                <div className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-[0.18em] mb-2 mt-5 first:mt-1 px-3">
                  {item.section}
                </div>
              )}
              <Link
                to={item.path}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm surface-interactive relative",
                  isActive
                    ? "bg-gradient-to-r from-accent/15 via-accent/8 to-transparent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-gradient-primary rounded-r-full shadow-glow" />
                )}
                <item.icon className={cn("size-[17px] transition-all", isActive ? "text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.5)]" : "group-hover:text-foreground")} />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="relative px-3 pb-2">
          <Link
            to="/admin"
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm surface-interactive relative",
              location.pathname === "/admin"
                ? "bg-gradient-to-r from-accent/15 via-accent/8 to-transparent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {location.pathname === "/admin" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-gradient-primary rounded-r-full shadow-glow" />
            )}
            <Shield className={cn("size-[17px]", location.pathname === "/admin" ? "text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.5)]" : "")} />
            Painel Admin
          </Link>
        </div>
      )}

      <div className="relative p-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 surface-interactive">
          <Link to="/perfil" className="size-9 rounded-full bg-gradient-primary border border-border flex items-center justify-center text-xs font-semibold text-white hover:ring-2 hover:ring-accent/40 surface-interactive shadow-sm-soft">
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
          <button onClick={signOut} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10" title="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
