import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, GripVertical, AlertCircle, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ProviderId = "lovable" | "openai" | "anthropic";

interface ProviderConfig {
  provider: ProviderId;
  model: string;
  enabled: boolean;
}

const MODELS: Record<ProviderId, { id: string; label: string }[]> = {
  lovable: [
    { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (rápido, padrão)" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (alta qualidade)" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (equilibrado)" },
    { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (econômico)" },
    { id: "openai/gpt-5", label: "GPT-5 (premium)" },
    { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
    { id: "openai/gpt-5-nano", label: "GPT-5 Nano" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini (rápido/barato)" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { id: "claude-opus-4-20250514", label: "Claude Opus 4 (máxima qualidade)" },
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (equilibrado, padrão)" },
    { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (rápido/barato)" },
  ],
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  lovable: "Lovable AI Gateway",
  openai: "OpenAI Direto",
  anthropic: "Anthropic Claude",
};

const PROVIDER_DESC: Record<ProviderId, string> = {
  lovable: "Acesso a Gemini e GPT-5 via gateway Lovable (sem chave externa).",
  openai: "Usa a chave OPENAI_API_KEY configurada em Chaves de API.",
  anthropic: "Usa a chave ANTHROPIC_API_KEY configurada em Chaves de API.",
};

function SortableRow({
  cfg,
  index,
  onModelChange,
  onToggle,
  onRemove,
}: {
  cfg: ProviderConfig;
  index: number;
  onModelChange: (model: string) => void;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${cfg.provider}-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-background border border-border rounded-md"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="size-7 bg-primary/10 text-primary rounded text-xs font-bold flex items-center justify-center shrink-0">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        <div>
          <p className="text-sm font-medium">{PROVIDER_LABELS[cfg.provider]}</p>
          <p className="text-[11px] text-muted-foreground">{PROVIDER_DESC[cfg.provider]}</p>
        </div>
        <select
          value={cfg.model}
          onChange={(e) => onModelChange(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-xs"
        >
          {MODELS[cfg.provider].map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Switch checked={cfg.enabled} onCheckedChange={onToggle} />
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive p-1"
          aria-label="Remover"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function AdminAISettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_provider")
        .maybeSingle();

      if (data?.value) {
        const v = data.value as any;
        if (Array.isArray(v.providers)) {
          setProviders(v.providers);
        } else if (v.provider) {
          // Migração de formato antigo {provider, model}
          setProviders([{ provider: v.provider, model: v.model, enabled: true }]);
        } else {
          setProviders([{ provider: "lovable", model: "google/gemini-3-flash-preview", enabled: true }]);
        }
      } else {
        setProviders([{ provider: "lovable", model: "google/gemini-3-flash-preview", enabled: true }]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = providers.findIndex((_, i) => `${providers[i].provider}-${i}` === active.id);
    const newIndex = providers.findIndex((_, i) => `${providers[i].provider}-${i}` === over.id);
    if (oldIndex >= 0 && newIndex >= 0) {
      setProviders(arrayMove(providers, oldIndex, newIndex));
    }
  };

  const updateProvider = (index: number, patch: Partial<ProviderConfig>) => {
    setProviders((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removeProvider = (index: number) => {
    setProviders((prev) => prev.filter((_, i) => i !== index));
  };

  const addProvider = (provider: ProviderId) => {
    const defaultModel = MODELS[provider][0].id;
    setProviders((prev) => [...prev, { provider, model: defaultModel, enabled: true }]);
  };

  const save = async () => {
    if (providers.length === 0) {
      toast({ title: "Adicione ao menos um provedor", variant: "destructive" });
      return;
    }
    if (!providers.some((p) => p.enabled)) {
      toast({ title: "Habilite ao menos um provedor", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "ai_provider", value: { providers } as any },
        { onConflict: "key" }
      );
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      const active = providers.filter((p) => p.enabled);
      toast({
        title: "Configuração salva",
        description: `${active.length} provedor(es) ativo(s). Ordem de prioridade aplicada.`,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando configurações...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Configurações de IA</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure múltiplos provedores e arraste para definir a <strong>ordem de prioridade</strong>.
          O sistema tenta o primeiro habilitado da lista; se falhar, usa o próximo automaticamente (fallback).
        </p>
      </div>

      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sm">Provedores de IA (ordenados por prioridade)</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Posição #1 = primeiro a ser tentado
            </p>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={providers.map((p, i) => `${p.provider}-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {providers.map((cfg, i) => (
                <SortableRow
                  key={`${cfg.provider}-${i}`}
                  cfg={cfg}
                  index={i}
                  onModelChange={(model) => updateProvider(i, { model })}
                  onToggle={(enabled) => updateProvider(i, { enabled })}
                  onRemove={() => removeProvider(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {providers.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-4">
            Nenhum provedor configurado. Adicione um abaixo.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground self-center mr-2">Adicionar:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addProvider("lovable")}
            className="h-8 text-xs"
          >
            <Plus className="size-3 mr-1" /> Lovable AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addProvider("openai")}
            className="h-8 text-xs"
          >
            <Plus className="size-3 mr-1" /> OpenAI
          </Button>
        </div>
      </div>

      {providers.some((p) => p.provider === "openai" && p.enabled) && (
        <div className="bg-muted/50 border border-border rounded-sm p-4 flex items-start gap-3">
          <AlertCircle className="size-4 text-warning mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-medium">Chave OpenAI necessária</p>
            <p className="text-muted-foreground">
              A chave <code className="text-primary bg-primary/10 px-1 rounded">OPENAI_API_KEY</code> deve estar configurada nos secrets para que o provedor OpenAI funcione.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin mr-2" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
