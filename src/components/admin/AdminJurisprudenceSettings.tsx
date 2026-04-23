import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookOpen, CheckCircle2, ExternalLink, Search } from "lucide-react";

interface JurisprudenceConfig {
  enabled: boolean;
  defaultTribunais: string[];
  maxResultsPerTribunal: number;
}

const ALL_TRIBUNAIS = [
  { code: "STJ", label: "STJ — Superior Tribunal de Justiça" },
  { code: "TST", label: "TST — Tribunal Superior do Trabalho" },
  { code: "TSE", label: "TSE — Tribunal Superior Eleitoral" },
  { code: "STM", label: "STM — Superior Tribunal Militar" },
  { code: "TRF1", label: "TRF1" }, { code: "TRF2", label: "TRF2" },
  { code: "TRF3", label: "TRF3" }, { code: "TRF4", label: "TRF4" },
  { code: "TRF5", label: "TRF5" }, { code: "TRF6", label: "TRF6" },
  { code: "TJSP", label: "TJSP" }, { code: "TJRJ", label: "TJRJ" },
  { code: "TJMG", label: "TJMG" }, { code: "TJRS", label: "TJRS" },
  { code: "TJPR", label: "TJPR" }, { code: "TJSC", label: "TJSC" },
  { code: "TJBA", label: "TJBA" }, { code: "TJDF", label: "TJDF" },
  { code: "TJGO", label: "TJGO" }, { code: "TJPE", label: "TJPE" },
  { code: "TJCE", label: "TJCE" }, { code: "TJES", label: "TJES" },
];

export function AdminJurisprudenceSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<JurisprudenceConfig>({
    enabled: true,
    defaultTribunais: ["STJ", "TJSP", "TJRJ"],
    maxResultsPerTribunal: 5,
  });
  const [testQuery, setTestQuery] = useState("dano moral negativação indevida");
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "jurisprudence_config")
        .maybeSingle();
      if (data?.value) {
        const v = data.value as any;
        setConfig({
          enabled: v.enabled ?? true,
          defaultTribunais: v.defaultTribunais ?? ["STJ", "TJSP", "TJRJ"],
          maxResultsPerTribunal: v.maxResultsPerTribunal ?? 5,
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "jurisprudence_config", value: config as any, updated_by: user?.id }, { onConflict: "key" });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Configurações salvas" });
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("search-jurisprudence", {
        body: {
          query: testQuery,
          tribunais: config.defaultTribunais,
          size: config.maxResultsPerTribunal,
        },
      });
      if (error) throw error;
      setTestResult(data);
      toast({ title: "Teste executado", description: `${data?.total ?? 0} resultados` });
    } catch (e) {
      toast({
        title: "Falha no teste",
        description: e instanceof Error ? e.message : "erro",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const toggleTribunal = (code: string) => {
    setConfig((c) => ({
      ...c,
      defaultTribunais: c.defaultTribunais.includes(code)
        ? c.defaultTribunais.filter((t) => t !== code)
        : [...c.defaultTribunais, code],
    }));
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</div>;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <BookOpen className="size-4" /> Jurisprudência — DataJud (CNJ)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Integração ativa com a API Pública oficial do Conselho Nacional de Justiça.
              A IA cita julgados REAIS de processos públicos brasileiros.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="size-4 text-green-600" />
            <span className="font-medium">Conectado</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <Label className="text-sm">Ativar busca automática durante o chat</Label>
            <p className="text-[11px] text-muted-foreground">A IA decide quando consultar julgados.</p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
          />
        </div>
      </div>

      {/* TRIBUNAIS PADRÃO */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-3">
        <div>
          <Label className="text-sm font-medium">Tribunais consultados por padrão</Label>
          <p className="text-[11px] text-muted-foreground">
            A IA pode escolher outros conforme o caso, mas usará estes como fallback.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_TRIBUNAIS.map((t) => {
            const active = config.defaultTribunais.includes(t.code);
            return (
              <button
                key={t.code}
                onClick={() => toggleTribunal(t.code)}
                className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <Label className="text-xs">Resultados por tribunal (máx 10)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={config.maxResultsPerTribunal}
              onChange={(e) => setConfig((c) => ({ ...c, maxResultsPerTribunal: Math.min(10, Math.max(1, +e.target.value || 5)) }))}
            />
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="mt-2">
          {saving && <Loader2 className="size-4 animate-spin mr-2" />}
          Salvar configurações
        </Button>
      </div>

      {/* TESTE */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Search className="size-4" /> Testar busca
        </Label>
        <div className="flex gap-2">
          <Input
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Tema ou tese jurídica"
          />
          <Button onClick={runTest} disabled={testing} variant="outline">
            {testing && <Loader2 className="size-4 animate-spin mr-2" />}
            Buscar
          </Button>
        </div>
        {testResult && (
          <div className="border border-border rounded-sm p-3 bg-muted/40 max-h-72 overflow-auto text-xs space-y-2">
            <div className="font-medium">{testResult.total} resultado(s) — {testResult.source}</div>
            {(testResult.results ?? []).slice(0, 8).map((r: any, i: number) => (
              <div key={i} className="border-l-2 border-primary pl-2 py-1">
                <div className="font-mono">{r.numeroProcesso} <span className="text-muted-foreground">({r.tribunal})</span></div>
                <div>{r.classe} — {(r.assuntos ?? []).slice(0, 2).join(", ")}</div>
                <div className="text-muted-foreground">{r.orgaoJulgador} · {r.dataAjuizamento?.slice(0, 10)}</div>
              </div>
            ))}
            {(testResult.errors ?? []).length > 0 && (
              <div className="text-destructive">Erros: {(testResult.errors as any[]).map(e => `${e.tribunal}:${e.error}`).join(", ")}</div>
            )}
          </div>
        )}
      </div>

      {/* MANUAL */}
      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <h3 className="font-semibold text-sm">📖 Manual de Integração — DataJud CNJ</h3>

        <section className="space-y-2 text-sm">
          <h4 className="font-medium">1. O que é</h4>
          <p className="text-muted-foreground text-xs leading-relaxed">
            A <strong>API Pública DataJud</strong> é o serviço oficial do Conselho Nacional de Justiça
            que disponibiliza metadados de processos públicos de praticamente todos os tribunais brasileiros
            (STJ, TST, TRFs, TJs, TRTs, TREs).
            Base legal: Portaria CNJ nº 160/2020.
          </p>
          <a
            href="https://datajud-wiki.cnj.jus.br/api-publica/acesso"
            target="_blank" rel="noreferrer"
            className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
          >
            Documentação oficial <ExternalLink className="size-3" />
          </a>
        </section>

        <section className="space-y-2 text-sm">
          <h4 className="font-medium">2. Autenticação</h4>
          <p className="text-muted-foreground text-xs">
            Usamos a chave pública oficial do CNJ (gratuita).
            Caso o CNJ rotacione a chave, atualize a secret <code className="bg-muted px-1 rounded">DATAJUD_API_KEY</code>
            nas configurações de backend. Sem essa secret, o sistema usa a chave padrão embutida.
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h4 className="font-medium">3. Como funciona no chat</h4>
          <ol className="text-muted-foreground text-xs list-decimal pl-5 space-y-1">
            <li>Usuário faz uma pergunta jurídica.</li>
            <li>A IA decide automaticamente se precisa consultar jurisprudência (function calling).</li>
            <li>Edge function <code className="bg-muted px-1 rounded">search-jurisprudence</code> consulta DataJud nos tribunais configurados.</li>
            <li>Resultados REAIS (número CNJ, classe, assunto, órgão julgador, data) são injetados na resposta.</li>
            <li>A IA cita apenas julgados retornados — nunca inventa.</li>
          </ol>
        </section>

        <section className="space-y-2 text-sm">
          <h4 className="font-medium">4. Limitações</h4>
          <ul className="text-muted-foreground text-xs list-disc pl-5 space-y-1">
            <li>API retorna metadados, não inteiro teor do acórdão.</li>
            <li>Cobertura depende da alimentação de cada tribunal junto ao CNJ.</li>
            <li>Não substitui pesquisa especializada para teses complexas.</li>
            <li>Limite prático: ~10 resultados por tribunal por consulta.</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm">
          <h4 className="font-medium">5. Custo</h4>
          <p className="text-muted-foreground text-xs">
            <strong>Gratuita.</strong> Sem necessidade de plano ou cartão. Sujeita às políticas do CNJ.
          </p>
        </section>
      </div>
    </div>
  );
}
