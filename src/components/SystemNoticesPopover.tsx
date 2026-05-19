import { useEffect, useMemo, useState } from "react";
import { Bell, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
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

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

const LEVEL_STYLE: Record<NoticeLevel, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "text-info" },
  warning: { icon: AlertTriangle, cls: "text-warning" },
  success: { icon: CheckCircle2, cls: "text-success" },
};

function parseNotices(value: any): SystemNotice[] {
  const raw = value?.notices;
  if (Array.isArray(raw) && raw.length) {
    return raw
      .filter((n) => n && n.id && n.title)
      .map((n: any) => ({
        id: String(n.id),
        title: String(n.title),
        message: String(n.message ?? ""),
        level: (n.level as NoticeLevel) ?? "info",
        created_at: n.created_at,
      }));
  }
  return DEFAULT_NOTICES;
}

export function SystemNoticesPopover() {
  const [notices, setNotices] = useState<SystemNotice[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "system_notices")
        .maybeSingle();
      if (!active) return;
      setNotices(parseNotices(data?.value));
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
          } else if (newRow?.value !== undefined) {
            setNotices(parseNotices(newRow.value));
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
    () => notices.filter((n) => !dismissed.includes(n.id)),
    [notices, dismissed],
  );

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    writeDismissed(next);
  };

  const clearAll = () => {
    const next = Array.from(new Set([...dismissed, ...notices.map((n) => n.id)]));
    setDismissed(next);
    writeDismissed(next);
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
          {visible.length > 0 && (
            <span className="absolute top-1.5 right-1.5 size-1.5 bg-accent rounded-full shadow-[0_0_8px_hsl(var(--accent))]" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(92vw,360px)] p-0 surface-glass border-border"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Avisos do sistema</span>
            {visible.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground">
                {visible.length}
              </span>
            )}
          </div>
          {visible.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar todos
            </button>
          )}
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
                return (
                  <li key={n.id} className="px-4 py-3 flex items-start gap-3 group">
                    <Icon className={cn("size-4 mt-0.5 shrink-0", lvl.cls)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
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
                    <button
                      type="button"
                      onClick={() => dismiss(n.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      aria-label="Dispensar aviso"
                    >
                      <X className="size-3.5" />
                    </button>
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
