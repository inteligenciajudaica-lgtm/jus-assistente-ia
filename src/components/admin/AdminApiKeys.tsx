import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Key, CheckCircle2, AlertCircle } from "lucide-react";

interface ApiKeys {
  openai?: string;
  anthropic?: string;
}

const PROVIDERS: {
  id: keyof ApiKeys;
  label: string;
  placeholder: string;
  helpUrl: string;
  helpText: string;
  prefix: string;
}[] = [
  {
    id: "openai",
    label: "OpenAI API Key",
    placeholder: "sk-proj-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Obtenha em platform.openai.com/api-keys",
    prefix: "sk-",
  },
  {
    id: "anthropic",
    label: "Anthropic API Key (Claude)",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Obtenha em console.anthropic.com/settings/keys",
    prefix: "sk-ant-",
  },
];

const mask = (key: string) => {
  if (!key) return "";
  if (key.length <= 10) return "••••••";
  return `${key.slice(0, 6)}••••••${key.slice(-4)}`;
};

export function AdminApiKeys() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keys, setKeys] = useState<ApiKeys>({});
  const [stored, setStored] = useState<ApiKeys>({});
  const [show, setShow] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "api_keys")
        .maybeSingle();
      if (data?.value) {
        const v = data.value as ApiKeys;
        setStored(v);
        setKeys(v);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleChange = (id: keyof ApiKeys, value: string) => {
    setKeys((prev) => ({ ...prev, [id]: value }));
  };

  const validate = (): string | null => {
    for (const p of PROVIDERS) {
      const v = keys[p.id]?.trim();
      if (v && !v.startsWith(p.prefix)) {
        return `Chave ${p.label} deve começar com "${p.prefix}"`;
      }
      if (v && v.length < 20) {
        return `Chave ${p.label} parece inválida (muito curta)`;
      }
      if (v && v.length > 500) {
        return `Chave ${p.label} muito longa`;
      }
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Validação falhou", description: err, variant: "destructive" });
      return;
    }

    setSaving(true);
    // Limpa strings vazias
    const cleaned: ApiKeys = {};
    for (const p of PROVIDERS) {
      const v = keys[p.id]?.trim();
      if (v) cleaned[p.id] = v;
    }

    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "api_keys", value: cleaned as any },
        { onConflict: "key" }
      );
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setStored(cleaned);
      toast({
        title: "Chaves salvas",
        description: "As chaves serão usadas pelos provedores de IA configurados.",
      });
    }
  };

  const remove = async (id: keyof ApiKeys) => {
    const next = { ...keys };
    delete next[id];
    setKeys(next);

    const cleaned: ApiKeys = {};
    for (const p of PROVIDERS) {
      const v = next[p.id]?.trim();
      if (v) cleaned[p.id] = v;
    }

    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "api_keys", value: cleaned as any }, { onConflict: "key" });

    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      setStored(cleaned);
      toast({ title: "Chave removida" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando chaves...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Key className="size-5" /> Chaves de API dos Provedores
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Insira as chaves de API dos provedores de IA externos. As chaves são armazenadas
          de forma segura no banco e usadas pelos provedores configurados acima.
        </p>
      </div>

      <div className="bg-muted/40 border border-border rounded-sm p-3 flex gap-2 text-xs">
        <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Segurança:</strong> as chaves só são visíveis
          para administradores (RLS) e nunca são expostas para usuários comuns.
          Use chaves dedicadas ao seu workspace e revogue periodicamente.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((p) => {
          const isStored = !!stored[p.id];
          const current = keys[p.id] ?? "";
          const isVisible = show[p.id];

          return (
            <div key={p.id} className="bg-card border border-border rounded-sm p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Label htmlFor={`key-${p.id}`} className="text-sm font-medium flex items-center gap-2">
                    {p.label}
                    {isStored && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded">
                        <CheckCircle2 className="size-3" /> Configurada
                      </span>
                    )}
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {p.helpText} —{" "}
                    <a
                      href={p.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      abrir painel
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={`key-${p.id}`}
                    type={isVisible ? "text" : "password"}
                    placeholder={isStored ? mask(stored[p.id]!) : p.placeholder}
                    value={current}
                    onChange={(e) => handleChange(p.id, e.target.value)}
                    maxLength={500}
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => ({ ...s, [p.id]: !s[p.id] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={isVisible ? "Ocultar" : "Mostrar"}
                  >
                    {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {isStored && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove(p.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin mr-2" />}
          Salvar chaves
        </Button>
      </div>
    </div>
  );
}
