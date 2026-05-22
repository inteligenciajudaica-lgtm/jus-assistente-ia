import { useEffect, useMemo, useState } from "react";
import { Bell, AlertTriangle, Info, CheckCircle2, X, Check, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NoticeLevel = "info" | "warning" | "success";

interface SystemNotice {
  id: string;
  title: string;
  message: string;
  level?: NoticeLevel;
  created_at?: string;
  expires_at?: string | null;
  active?: boolean;
}

const DEFAULT_NOTICES: SystemNotice[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao JURIS AI",
    message: "Acompanhe aqui os avisos e novidades do sistema.",
    level: "info",
  },
];

const STORAGE_KEY = "juris.system_notices.dismissed";
const READ_STORAGE_KEY = "juris.system_notices.read";

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}


const LEVEL_STYLE: Record<NoticeLevel, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "text-info" },
  warning: { icon: AlertTriangle, cls: "text-warning" },
  success: { icon: CheckCircle2, cls: "text-success" },
};

interface ParsedSettings {
  notices: SystemNotice[];
  defaultTtlHours: number | null;
}

function parseSettings(value: any): ParsedSettings {
  const defaultTtlHours = typeof value?.default_ttl_hours === "number" && value.default_ttl_hours > 0
    ? value.default_ttl_hours
    : null;
  const raw = value?.notices;
  if (Array.isArray(raw) && raw.length) {
    return {
      defaultTtlHours,
      notices: raw
        .filter((n) => n && n.id && n.title)
        .map((n: any) => ({
          id: String(n.id),
          title: String(n.title),
          message: String(n.message ?? ""),
          level: (n.level as NoticeLevel) ?? "info",
          created_at: n.created_at,
          expires_at: n.expires_at ?? null,
          active: n.active !== false,
        })),
    };
  }
  return { defaultTtlHours, notices: DEFAULT_NOTICES };
}

function isExpired(n: SystemNotice, defaultTtlHours: number | null, now: number): boolean {
  if (n.expires_at) return new Date(n.expires_at).getTime() < now;
  if (defaultTtlHours && n.created_at) {
    return new Date(n.created_at).getTime() + defaultTtlHours * 3600 * 1000 < now;
  }
  return false;
}


export function SystemNoticesPopover() {
  const [notices, setNotices] = useState<SystemNotice[]>([]);
  const [defaultTtlHours, setDefaultTtlHours] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(() => readIds(STORAGE_KEY));
  const [read, setRead] = useState<string[]>(() => readIds(READ_STORAGE_KEY));
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;

    const apply = (value: any) => {
      const parsed = parseSettings(value);
      setNotices(parsed.notices);
      setDefaultTtlHours(parsed.defaultTtlHours);
    };

    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "system_notices")
        .maybeSingle();
      if (!active) return;
      apply(data?.value);
    };

    load();

    const channel = supabase
      .channel("system-notices")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.system_notices" },
        (payload) => {
          if (!active) return;
          const newRow = (payload.new ?? payload.old) as { value?: any } | null;
          if (payload.eventType === "DELETE") {
            setNotices(DEFAULT_NOTICES);
            setDefaultTtlHours(null);
          } else if (newRow?.value !== undefined) {
            apply(newRow.value);
          } else {
            load();
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);


  const visible = useMemo(
    () => notices.filter((n) => n.active !== false && !dismissed.includes(n.id) && !isExpired(n, defaultTtlHours, now)),
    [notices, dismissed, defaultTtlHours, now],
  );


  const unreadCount = useMemo(
    () => visible.filter((n) => !read.includes(n.id)).length,
    [visible, read],
  );

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    writeIds(STORAGE_KEY, next);
  };

  const markRead = (id: string) => {
    if (read.includes(id)) return;
    const next = [...read, id];
    setRead(next);
    writeIds(READ_STORAGE_KEY, next);
  };

  const markAllRead = () => {
    const next = Array.from(new Set([...read, ...visible.map((n) => n.id)]));
    setRead(next);
    writeIds(READ_STORAGE_KEY, next);
  };

  const clearAll = () => {
    const next = Array.from(new Set([...dismissed, ...notices.map((n) => n.id)]));
    setDismissed(next);
    writeIds(STORAGE_KEY, next);
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-md hover:bg-muted"
          aria-label="Avisos do sistema"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-accent-foreground tabular-nums shadow-[0_0_8px_hsl(var(--accent))]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(92vw,360px)] p-0 surface-glass border-border"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium">Avisos do sistema</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent/40 bg-accent/10 text-accent">
                {unreadCount} novo{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Marcar todos como lidos"
              >
                <CheckCheck className="size-3.5" />
                Marcar lidos
              </button>
            )}
            {visible.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Sem avisos no momento.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((n) => {
                const lvl = LEVEL_STYLE[n.level ?? "info"];
                const Icon = lvl.icon;
                const isRead = read.includes(n.id);
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "px-4 py-3 flex items-start gap-3 group relative transition-opacity",
                      isRead ? "opacity-60" : "bg-accent/[0.03]",
                    )}
                    onClick={() => markRead(n.id)}
                  >
                    {!isRead && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent))]" />
                    )}
                    <Icon className={cn("size-4 mt-0.5 shrink-0", lvl.cls)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-tight", isRead ? "font-normal" : "font-medium")}>{n.title}</p>
                      {n.message && (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {n.message}
                        </p>
                      )}
                      {n.created_at && (
                        <p className="mt-1.5 text-[10px] font-mono text-muted-foreground/70">
                          {new Date(n.created_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isRead && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                          aria-label="Marcar como lido"
                          title="Marcar como lido"
                        >
                          <Check className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                        className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                        aria-label="Dispensar aviso"
                        title="Dispensar"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

      </PopoverContent>
    </Popover>
  );
}
