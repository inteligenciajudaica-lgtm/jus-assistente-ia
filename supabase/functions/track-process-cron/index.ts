// Edge function: cron de sincronização automática dos processos acompanhados.
// Autorização: Bearer <SERVICE_ROLE_KEY> (chamada pelo pg_cron via pg_net).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_DATAJUD_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

const TRIBUNAL_ALIASES: Record<string, string> = {
  STJ: "api_publica_stj", TST: "api_publica_tst", TSE: "api_publica_tse", STM: "api_publica_stm",
  TRF1: "api_publica_trf1", TRF2: "api_publica_trf2", TRF3: "api_publica_trf3",
  TRF4: "api_publica_trf4", TRF5: "api_publica_trf5", TRF6: "api_publica_trf6",
  TJSP: "api_publica_tjsp", TJRJ: "api_publica_tjrj", TJMG: "api_publica_tjmg",
  TJRS: "api_publica_tjrs", TJPR: "api_publica_tjpr", TJSC: "api_publica_tjsc",
  TJBA: "api_publica_tjba", TJDF: "api_publica_tjdft", TJGO: "api_publica_tjgo",
  TJES: "api_publica_tjes", TJPE: "api_publica_tjpe", TJCE: "api_publica_tjce",
  TJPA: "api_publica_tjpa", TJAM: "api_publica_tjam", TJMT: "api_publica_tjmt",
  TJMS: "api_publica_tjms", TJPB: "api_publica_tjpb", TJRN: "api_publica_tjrn",
  TJAL: "api_publica_tjal", TJSE: "api_publica_tjse", TJPI: "api_publica_tjpi",
  TJMA: "api_publica_tjma", TJTO: "api_publica_tjto", TJAC: "api_publica_tjac",
  TJAP: "api_publica_tjap", TJRO: "api_publica_tjro", TJRR: "api_publica_tjrr",
  TRT1: "api_publica_trt1", TRT2: "api_publica_trt2", TRT3: "api_publica_trt3",
  TRT4: "api_publica_trt4", TRT15: "api_publica_trt15",
};

async function fetchProcess(tribunal: string, numero: string, apiKey: string) {
  const alias = TRIBUNAL_ALIASES[tribunal.toUpperCase()];
  if (!alias) throw new Error(`Tribunal não suportado: ${tribunal}`);
  const resp = await fetch(
    `https://api-publica.datajud.cnj.jus.br/${alias}/_search`,
    {
      method: "POST",
      headers: {
        Authorization: `APIKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numero.replace(/\D/g, "") } },
        size: 1,
      }),
    },
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`DataJud ${tribunal} HTTP ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data?.hits?.hits?.[0]?._source ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = Date.now();
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    // 1) Configuração
    const { data: cfgRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "process_tracking_config")
      .maybeSingle();

    const cfg = (cfgRow?.value ?? {}) as {
      enabled?: boolean;
      autoSyncHours?: number;
      apiKeyOverride?: string;
    };

    if (cfg.enabled === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const autoSyncHours = Math.max(1, Math.min(168, Number(cfg.autoSyncHours) || 24));
    const apiKey = cfg.apiKeyOverride?.trim()
      || Deno.env.get("DATAJUD_API_KEY")
      || DEFAULT_DATAJUD_KEY;

    // 2) Processos vencidos
    const cutoffIso = new Date(Date.now() - autoSyncHours * 3600 * 1000).toISOString();
    const { data: due, error: dueErr } = await supabase
      .from("tracked_processes")
      .select("id, numero_processo, tribunal, last_synced_at")
      .or(`last_synced_at.is.null,last_synced_at.lt.${cutoffIso}`)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(50); // teto por execução para não estourar o tempo da função

    if (dueErr) throw dueErr;

    let synced = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const row of due ?? []) {
      try {
        const src = await fetchProcess(row.tribunal, row.numero_processo, apiKey);
        if (!src) throw new Error("Processo não retornado pelo DataJud");
        const movs = (src.movimentos ?? []) as any[];
        const last = movs[movs.length - 1];
        const { error: upErr } = await supabase
          .from("tracked_processes")
          .update({
            classe: src.classe?.nome ?? null,
            assuntos: (src.assuntos ?? []).map((a: any) => a.nome),
            orgao_julgador: src.orgaoJulgador?.nome ?? null,
            data_ajuizamento: src.dataAjuizamento ?? null,
            grau: src.grau ?? null,
            ultimo_movimento: last?.nome ?? null,
            ultimo_movimento_data: last?.dataHora ?? null,
            movimentos_count: movs.length,
            raw_data: src,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (upErr) throw upErr;
        synced++;
      } catch (e) {
        failed++;
        errors.push({ id: row.id, numero: row.numero_processo, error: e instanceof Error ? e.message : "erro" });
      }
    }

    // 3) Registra última execução do cron
    await supabase.from("app_settings").upsert(
      {
        key: "process_tracking_cron_last_run",
        value: {
          ranAt: new Date().toISOString(),
          autoSyncHours,
          considered: due?.length ?? 0,
          synced,
          failed,
          durationMs: Date.now() - startedAt,
          errors: errors.slice(0, 10),
        },
      },
      { onConflict: "key" },
    );

    return new Response(
      JSON.stringify({
        success: true,
        autoSyncHours,
        considered: due?.length ?? 0,
        synced,
        failed,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("track-process-cron error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
