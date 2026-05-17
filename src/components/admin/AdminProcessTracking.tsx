import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Scale, Plus, RefreshCw, Trash2, Search, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff,
  CheckCircle2, XCircle, RotateCw,
} from "lucide-react";

type SyncState = { status: "idle" | "syncing" | "success" | "error"; message?: string; at?: number };

interface TrackingConfig {
  enabled: boolean;
  autoSyncHours: number;
  defaultTribunais: string[];
  apiKeyOverride?: string;
  apiBaseUrl: string;
}

interface TrackedProcess {
  id: string;
  numero_processo: string;
  tribunal: string;
  nickname: string | null;
  classe: string | null;
  assuntos: string[] | null;
  orgao_julgador: string | null;
  data_ajuizamento: string | null;
  grau: string | null;
  ultimo_movimento: string | null;
  ultimo_movimento_data: string | null;
  movimentos_count: number;
  last_synced_at: string | null;
  notes: string | null;
  raw_data: any;
  updated_at: string;
}

const ALL_TRIBUNAIS = [
  "STJ","TST","TSE","STM",
  "TRF1","TRF2","TRF3","TRF4","TRF5","TRF6",
  "TJSP","TJRJ","TJMG","TJRS","TJPR","TJSC","TJBA","TJDF","TJGO","TJPE","TJCE","TJES",
  "TJPA","TJAM","TJMT","TJMS","TJPB","TJRN","TJAL","TJSE","TJPI","TJMA","TJTO",
  "TJAC","TJAP","TJRO","TJRR",
  "TRT1","TRT2","TRT3","TRT4","TRT15",
];

const formatCNJ = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 20);
  if (d.length < 20) return raw;
  return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16,20)}`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
};

export function AdminProcessTracking() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [config, setConfig] = useState<TrackingConfig>({
    enabled: true,
    autoSyncHours: 24,
    defaultTribunais: ["STJ", "TJSP", "TJRJ"],
    apiKeyOverride: "",
    apiBaseUrl: "https://api-publica.datajud.cnj.jus.br",
  });

  const [tracked, setTracked] = useState<TrackedProcess[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // formulário de adição
  const [newNumero, setNewNumero] = useState("");
  const [newTribunal, setNewTribunal] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [bulkSync, setBulkSync] = useState<{ active: boolean; done: number; total: number; failed: number }>({
    active: false, done: 0, total: 0, failed: 0,
  });

  // busca / lookup
  const [lookupNumero, setLookupNumero] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [cfgRes, listRes] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "process_tracking_config").maybeSingle(),
        supabase.from("tracked_processes").select("*").order("updated_at", { ascending: false }),
      ]);
      if (cfgRes.data?.value) {
        const v = cfgRes.data.value as any;
        setConfig((c) => ({ ...c, ...v }));
      }
      if (listRes.data) setTracked(listRes.data as any);
      setLoading(false);
    })();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "process_tracking_config", value: config as any, updated_by: user?.id }, { onConflict: "key" });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Configurações salvas" });
  };

  const toggleTrib = (code: string) => {
    setConfig((c) => ({
      ...c,
      defaultTribunais: c.defaultTribunais.includes(code)
        ? c.defaultTribunais.filter((t) => t !== code)
        : [...c.defaultTribunais, code],
    }));
  };

  const refreshList = async () => {
    const { data } = await supabase.from("tracked_processes").select("*").order("updated_at", { ascending: false });
    if (data) setTracked(data as any);
  };

  const handleLookup = async () => {
    if (!lookupNumero.trim()) return;
    setLooking(true);
    setLookupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("track-process", {
        body: { action: "lookup", numeroProcesso: lookupNumero.trim() },
      });
      if (error) throw error;
      setLookupResult(data);
      if (data?.results?.[0]) {
        setNewNumero(lookupNumero.trim());
        setNewTribunal(data.results[0].tribunal);
      }
    } catch (e) {
      toast({ title: "Falha na consulta", description: e instanceof Error ? e.message : "erro", variant: "destructive" });
    } finally {
      setLooking(false);
    }
  };

  const handleAdd = async () => {
    if (!newNumero || !newTribunal) {
      toast({ title: "Informe número e tribunal", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.functions.invoke("track-process", {
        body: {
          action: "track",
          numeroProcesso: newNumero.trim(),
          tribunal: newTribunal,
          nickname: newNickname || null,
          notes: newNotes || null,
        },
      });
      if (error) throw error;
      toast({ title: "Processo adicionado ao acompanhamento" });
      setNewNumero(""); setNewTribunal(""); setNewNickname(""); setNewNotes("");
      setLookupResult(null); setLookupNumero("");
      await refreshList();
    } catch (e) {
      toast({ title: "Erro ao adicionar", description: e instanceof Error ? e.message : "erro", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const syncOne = async (id: string): Promise<{ ok: boolean; message?: string }> => {
    setSyncStates((s) => ({ ...s, [id]: { status: "syncing" } }));
    try {
      const { data, error } = await supabase.functions.invoke("track-process", { body: { action: "sync", id } });
      if (error) throw error;
      const movs = (data?.process?.movimentos_count ?? data?.movimentos_count) as number | undefined;
      const msg = typeof movs === "number" ? `${movs} movimentos` : "atualizado";
      setSyncStates((s) => ({ ...s, [id]: { status: "success", message: msg, at: Date.now() } }));
      return { ok: true, message: msg };
    } catch (e) {
      const message = e instanceof Error ? e.message : "erro";
      setSyncStates((s) => ({ ...s, [id]: { status: "error", message, at: Date.now() } }));
      return { ok: false, message };
    }
  };

  const handleSync = async (id: string) => {
    const r = await syncOne(id);
    if (r.ok) toast({ title: "Processo atualizado", description: r.message });
    else toast({ title: "Erro ao sincronizar", description: r.message, variant: "destructive" });
    await refreshList();
  };

  const handleSyncAll = async () => {
    if (tracked.length === 0) return;
    setBulkSync({ active: true, done: 0, total: tracked.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < tracked.length; i++) {
      const r = await syncOne(tracked[i].id);
      if (!r.ok) failed++;
      setBulkSync((b) => ({ ...b, done: i + 1, failed }));
    }
    await refreshList();
    setBulkSync((b) => ({ ...b, active: false }));
    toast({
      title: "Sincronização concluída",
      description: `${tracked.length - failed}/${tracked.length} com sucesso${failed ? ` · ${failed} falharam` : ""}`,
      variant: failed ? "destructive" : "default",
    });
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remover este processo do acompanhamento?")) return;
    try {
      const { error } = await supabase.functions.invoke("track-process", { body: { action: "untrack", id } });
      if (error) throw error;
      await refreshList();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "erro", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER + CONFIG API */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Scale className="size-4" /> Acompanhamento de Processos — DataJud (CNJ)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Configure a API Pública oficial do CNJ para monitorar processos por número CNJ.
          </p>
          <a
            href="https://datajud-wiki.cnj.jus.br/api-publica/acesso"
            target="_blank" rel="noreferrer"
            className="text-xs inline-flex items-center gap-1 text-primary hover:underline mt-1"
          >
            Documentação oficial <ExternalLink className="size-3" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div className="col-span-2 flex items-center justify-between">
            <div>
              <Label className="text-sm">Acompanhamento ativo</Label>
              <p className="text-[11px] text-muted-foreground">Quando desativado, novos lookups são bloqueados.</p>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} />
          </div>

          <div>
            <Label className="text-xs">URL base da API</Label>
            <Input
              value={config.apiBaseUrl}
              onChange={(e) => setConfig((c) => ({ ...c, apiBaseUrl: e.target.value }))}
              placeholder="https://api-publica.datajud.cnj.jus.br"
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Sincronização automática (horas)</Label>
            <Input
              type="number" min={1} max={168}
              value={config.autoSyncHours}
              onChange={(e) => setConfig((c) => ({ ...c, autoSyncHours: Math.max(1, +e.target.value || 24) }))}
            />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Chave da API (APIKey) — opcional</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={config.apiKeyOverride ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, apiKeyOverride: e.target.value }))}
                placeholder="Deixe em branco para usar a chave pública oficial do CNJ"
                className="font-mono text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              A chave pública oficial já está embutida. Informe uma chave própria se o CNJ rotacionar a chave.
              Para uso em backend, configure também o secret <code className="bg-muted px-1 rounded">DATAJUD_API_KEY</code>.
            </p>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">Tribunais padrão</Label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Usados quando não for possível inferir o tribunal pelo número CNJ.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_TRIBUNAIS.map((t) => {
              const active = config.defaultTribunais.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTrib(t)}
                  className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                    active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <Button onClick={saveConfig} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin mr-2" />}
          Salvar configurações
        </Button>
      </div>

      {/* LOOKUP + ADICIONAR */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Plus className="size-4" /> Adicionar processo
        </Label>

        <div className="flex gap-2">
          <Input
            placeholder="Número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO)"
            value={lookupNumero}
            onChange={(e) => setLookupNumero(e.target.value)}
            className="font-mono text-xs"
          />
          <Button variant="outline" onClick={handleLookup} disabled={looking}>
            {looking ? <Loader2 className="size-4 animate-spin mr-2" /> : <Search className="size-4 mr-2" />}
            Consultar
          </Button>
        </div>

        {lookupResult && (
          <div className="border border-border rounded-sm p-3 bg-muted/40 text-xs space-y-1">
            <div>
              Tribunal inferido: <strong>{lookupResult.inferred ?? "—"}</strong> ·
              Resultados: <strong>{lookupResult.results?.length ?? 0}</strong>
            </div>
            {(lookupResult.results ?? []).map((r: any, i: number) => (
              <div key={i} className="border-l-2 border-primary pl-2">
                <div className="font-mono">{r.numeroProcesso} ({r.tribunal})</div>
                <div>{r.classe?.nome} — {(r.assuntos ?? []).slice(0,3).map((a:any)=>a.nome).join(", ")}</div>
              </div>
            ))}
            {(lookupResult.errors ?? []).length > 0 && (
              <div className="text-destructive">Erros: {lookupResult.errors.map((e:any)=>`${e.tribunal}:${e.error}`).join(" | ")}</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Número CNJ</Label>
            <Input value={newNumero} onChange={(e) => setNewNumero(e.target.value)} className="font-mono text-xs" />
          </div>
          <div>
            <Label className="text-xs">Tribunal</Label>
            <Select value={newTribunal} onValueChange={setNewTribunal}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {ALL_TRIBUNAIS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Apelido (opcional)</Label>
            <Input value={newNickname} onChange={(e) => setNewNickname(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea rows={1} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
          </div>
        </div>

        <Button onClick={handleAdd} disabled={adding}>
          {adding && <Loader2 className="size-4 animate-spin mr-2" />}
          Adicionar ao acompanhamento
        </Button>
      </div>

      {/* LISTA */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Processos acompanhados ({tracked.length})
          </Label>
          <Button variant="ghost" size="sm" onClick={refreshList}>
            <RefreshCw className="size-3 mr-1" /> Atualizar lista
          </Button>
        </div>

        {tracked.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum processo acompanhado ainda.</p>
        )}

        <div className="space-y-2">
          {tracked.map((p) => {
            const isOpen = expanded[p.id];
            const movs = (p.raw_data?.movimentos ?? []) as any[];
            return (
              <div key={p.id} className="border border-border rounded-sm">
                <div className="p-3 flex items-start gap-3">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                  >
                    {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs">{formatCNJ(p.numero_processo)}</span>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">{p.tribunal}</span>
                      {p.nickname && <span className="text-xs font-medium">— {p.nickname}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.classe ?? "—"} · {p.orgao_julgador ?? "—"} · {p.movimentos_count} movimentos
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Último: <span className="text-foreground">{p.ultimo_movimento ?? "—"}</span> · {formatDate(p.ultimo_movimento_data)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Sincronizado em {formatDate(p.last_synced_at)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleSync(p.id)} disabled={syncingId === p.id}>
                      {syncingId === p.id ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(p.id)}>
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border bg-muted/30 p-3 space-y-2">
                    {p.assuntos && p.assuntos.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Assuntos:</span> {p.assuntos.join(", ")}
                      </div>
                    )}
                    {p.notes && (
                      <div className="text-xs"><span className="text-muted-foreground">Notas:</span> {p.notes}</div>
                    )}
                    <div className="text-xs font-medium pt-2">Movimentos ({movs.length})</div>
                    <div className="max-h-72 overflow-auto space-y-1 text-xs">
                      {[...movs].reverse().map((m: any, i: number) => (
                        <div key={i} className="border-l-2 border-border pl-2 py-1">
                          <div className="font-medium">{m.nome}</div>
                          <div className="text-muted-foreground text-[11px]">{formatDate(m.dataHora)}</div>
                        </div>
                      ))}
                      {movs.length === 0 && <div className="text-muted-foreground">Sem movimentos disponíveis.</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
