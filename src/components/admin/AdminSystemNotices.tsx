import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Bell, Plus, Trash2, Clock } from "lucide-react";

type NoticeLevel = "info" | "warning" | "success";

interface SystemNotice {
  id: string;
  title: string;
  message: string;
  level: NoticeLevel;
  created_at: string;
  expires_at?: string | null;
}

interface NoticesSettings {
  default_ttl_hours: number | null;
  notices: SystemNotice[];
}

const DEFAULT_SETTINGS: NoticesSettings = { default_ttl_hours: null, notices: [] };

function effectiveExpiry(n: SystemNotice, defaultTtl: number | null): Date | null {
  if (n.expires_at) return new Date(n.expires_at);
  if (defaultTtl && defaultTtl > 0 && n.created_at) {
    return new Date(new Date(n.created_at).getTime() + defaultTtl * 3600 * 1000);
  }
  return null;
}

export function AdminSystemNotices() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NoticesSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<NoticeLevel>("info");
  const [ttlHours, setTtlHours] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "system_notices")
        .maybeSingle();
      const v = (data?.value as any) || {};
      setSettings({
        default_ttl_hours: typeof v.default_ttl_hours === "number" ? v.default_ttl_hours : null,
        notices: Array.isArray(v.notices) ? v.notices : [],
      });
      setLoading(false);
    })();
  }, []);

  const persist = async (next: NoticesSettings) => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "system_notices", value: next as any, updated_by: user?.id ?? null, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    setSettings(next);
    return true;
  };

  const handleAddNotice = async () => {
    if (!title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    let expires_at: string | null = null;
    const t = parseFloat(ttlHours);
    if (!isNaN(t) && t > 0) {
      expires_at = new Date(Date.now() + t * 3600 * 1000).toISOString();
    }
    const notice: SystemNotice = {
      id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      message: message.trim(),
      level,
      created_at: new Date().toISOString(),
      expires_at,
    };
    const ok = await persist({ ...settings, notices: [notice, ...settings.notices] });
    if (ok) {
      setTitle("");
      setMessage("");
      setLevel("info");
      setTtlHours("");
      toast({ title: "Aviso publicado" });
    }
  };

  const handleDelete = async (id: string) => {
    await persist({ ...settings, notices: settings.notices.filter((n) => n.id !== id) });
  };

  const handleDefaultTtlSave = async (hours: number | null) => {
    const ok = await persist({ ...settings, default_ttl_hours: hours });
    if (ok) toast({ title: "Expiração padrão atualizada" });
  };

  if (loading) {
    return <div className="surface-card rounded-xl p-6 text-sm text-muted-foreground">Carregando avisos...</div>;
  }

  return (
    <section className="surface-card rounded-xl p-5 sm:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-muted flex items-center justify-center">
          <Bell className="size-4 text-accent" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Avisos do sistema</h2>
          <p className="text-xs text-muted-foreground">Publique e configure o tempo de expiração dos avisos exibidos no sino do cabeçalho.</p>
        </div>
      </header>

      {/* Default TTL */}
      <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Expiração padrão</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Aplicada a avisos sem data de expiração própria. Deixe em branco ou 0 para nunca expirar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px] max-w-[240px]">
            <Label className="text-xs">Horas</Label>
            <Input
              type="number"
              min={0}
              step={1}
              defaultValue={settings.default_ttl_hours ?? ""}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                const next = isNaN(v) || v <= 0 ? null : v;
                if (next !== settings.default_ttl_hours) handleDefaultTtlSave(next);
              }}
              placeholder="Nunca expira"
              disabled={saving}
            />
          </div>
          <div className="flex gap-2 text-xs">
            {[
              { label: "24h", v: 24 },
              { label: "7d", v: 24 * 7 },
              { label: "30d", v: 24 * 30 },
              { label: "Nunca", v: null as number | null },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleDefaultTtlSave(p.v)}
                className={`px-2.5 py-1.5 rounded border transition-colors ${
                  settings.default_ttl_hours === p.v
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* New notice */}
      <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Novo aviso</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Manutenção programada" />
          </div>
          <div>
            <Label className="text-xs">Nível</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as NoticeLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Informação</SelectItem>
                <SelectItem value="warning">Atenção</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Mensagem</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Detalhes do aviso..." />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[200px]">
            <Label className="text-xs">Expira em (horas)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={ttlHours}
              onChange={(e) => setTtlHours(e.target.value)}
              placeholder="Usar padrão"
            />
          </div>
          <Button onClick={handleAddNotice} disabled={saving} className="gap-2">
            <Plus className="size-4" /> Publicar aviso
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Avisos ativos</h3>
        {settings.notices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum aviso publicado.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {settings.notices.map((n) => {
              const expiry = effectiveExpiry(n, settings.default_ttl_hours);
              const expired = expiry && expiry.getTime() < Date.now();
              return (
                <li key={n.id} className={`p-3 flex items-start gap-3 ${expired ? "opacity-60" : ""}`}>
                  <span className={`mt-1 size-1.5 rounded-full ${
                    n.level === "warning" ? "bg-warning" : n.level === "success" ? "bg-success" : "bg-info"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                    <p className="text-[10px] font-mono text-muted-foreground/70 mt-1">
                      Criado: {new Date(n.created_at).toLocaleString("pt-BR")}
                      {expiry && (
                        <> · {expired ? "Expirou" : "Expira"} em {expiry.toLocaleString("pt-BR")}</>
                      )}
                      {!expiry && <> · Nunca expira</>}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)} aria-label="Remover">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
