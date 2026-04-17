import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Provider = "lovable" | "openai";

const LOVABLE_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (rápido, padrão)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (alta qualidade)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (equilibrado)" },
  { id: "openai/gpt-5", label: "GPT-5 (premium)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
];

const OPENAI_MODELS = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini (rápido/barato)" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

export function AdminAISettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<Provider>("lovable");
  const [model, setModel] = useState<string>("google/gemini-3-flash-preview");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_provider")
        .maybeSingle();
      if (data?.value) {
        const v = data.value as any;
        setProvider((v.provider as Provider) || "lovable");
        setModel(v.model || "google/gemini-3-flash-preview");
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(p === "openai" ? "gpt-4o-mini" : "google/gemini-3-flash-preview");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "ai_provider", value: { provider, model } as any },
        { onConflict: "key" }
      );
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva", description: `Provedor: ${provider} • Modelo: ${model}` });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando configurações...
      </div>
    );
  }

  const models = provider === "openai" ? OPENAI_MODELS : LOVABLE_MODELS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Configurações de IA</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Escolha o provedor de IA e o modelo usado pelo Copiloto Jurídico.
        </p>
      </div>

      {/* Provedor */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <h3 className="font-medium text-sm">Provedor de IA</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleProviderChange("lovable")}
            className={`p-4 border rounded-sm text-left transition-colors ${
              provider === "lovable"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Lovable AI Gateway</p>
              {provider === "lovable" && <CheckCircle2 className="size-4 text-primary" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Padrão. Acesso a Gemini e GPT-5 sem chave externa.
            </p>
          </button>
          <button
            onClick={() => handleProviderChange("openai")}
            className={`p-4 border rounded-sm text-left transition-colors ${
              provider === "openai"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">OpenAI Direto</p>
              {provider === "openai" && <CheckCircle2 className="size-4 text-primary" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Usa sua própria chave OpenAI (configurada nos secrets).
            </p>
          </button>
        </div>
      </div>

      {/* Modelo */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <h3 className="font-medium text-sm">Modelo</h3>
        <div className="space-y-2">
          <Label htmlFor="model" className="text-xs">Modelo ativo</Label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status da chave OpenAI */}
      {provider === "openai" && (
        <div className="bg-muted/50 border border-border rounded-sm p-4 flex items-start gap-3">
          <AlertCircle className="size-4 text-warning mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-medium">Chave OpenAI</p>
            <p className="text-muted-foreground">
              A chave <code className="text-primary bg-primary/10 px-1 rounded">OPENAI_API_KEY</code> deve estar configurada nos secrets do projeto.
              Se precisar atualizar, peça ao desenvolvedor para gerenciar via painel de secrets.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin mr-2" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
