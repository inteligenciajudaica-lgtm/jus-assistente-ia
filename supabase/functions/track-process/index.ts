// Edge function: acompanhamento de processos via DataJud CNJ
// Permite buscar um processo específico, listar movimentos e salvar acompanhamento.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

// Deriva tribunal a partir do número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO)
// J=segmento, TR=tribunal
function inferTribunalFromCNJ(numero: string): string | null {
  const digits = numero.replace(/\D/g, "");
  if (digits.length !== 20) return null;
  const j = digits.charAt(13);
  const tr = digits.substring(14, 16);
  // Segmentos: 1=STF, 2=CNJ, 3=STJ, 4=Federal, 5=Trabalho, 6=Eleitoral, 7=Militar União, 8=Estadual, 9=Militar Estadual
  if (j === "3") return "STJ";
  if (j === "4") return `TRF${parseInt(tr, 10)}`;
  if (j === "5") return `TRT${parseInt(tr, 10)}`;
  if (j === "8") {
    const ufMap: Record<string, string> = {
      "01": "AC","02":"AL","03":"AP","04":"AM","05":"BA","06":"CE","07":"DF","08":"ES",
      "09":"GO","10":"MA","11":"MT","12":"MS","13":"MG","14":"PA","15":"PB","16":"PR",
      "17":"PE","18":"PI","19":"RJ","20":"RN","21":"RS","22":"RO","23":"RR","24":"SC",
      "25":"SP","26":"SE","27":"TO",
    };
    const uf = ufMap[tr];
    return uf ? `TJ${uf}` : null;
  }
  return null;
}

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
  const hit = data?.hits?.hits?.[0];
  return hit?._source ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const action = body.action as "lookup" | "track" | "sync" | "untrack";
    const apiKey = Deno.env.get("DATAJUD_API_KEY") ?? DEFAULT_DATAJUD_KEY;

    if (action === "lookup") {
      const numero = String(body.numeroProcesso || "").trim();
      if (!numero) throw new Error("numeroProcesso obrigatório");

      // Validação do CNJ: exige exatamente 20 dígitos
      const digits = numero.replace(/\D/g, "");
      if (digits.length !== 20) {
        return new Response(JSON.stringify({
          success: false,
          error: `Número CNJ inválido: foram informados ${digits.length} dígitos, mas o padrão exige 20 (formato NNNNNNN-DD.AAAA.J.TR.OOOO).`,
          digitsProvided: digits.length,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const explicitTribs: string[] | undefined = body.tribunais;
      const inferred = inferTribunalFromCNJ(numero);
      const tribs = explicitTribs && explicitTribs.length
        ? explicitTribs
        : inferred
        ? [inferred]
        : ["STJ", "TJSP", "TJRJ"];

      const results: any[] = [];
      const errors: any[] = [];
      await Promise.all(tribs.map(async (tb) => {
        try {
          const src = await fetchProcess(tb, numero, apiKey);
          if (src) results.push({ tribunal: tb, ...src });
        } catch (e) {
          errors.push({ tribunal: tb, error: e instanceof Error ? e.message : "erro" });
        }
      }));

      return new Response(JSON.stringify({
        success: true,
        results,
        errors,
        inferred,
        tribunaisConsultados: tribs,
        notFound: results.length === 0,
        message: results.length === 0
          ? `Processo não localizado nos tribunais consultados (${tribs.join(", ")}). Verifique o número ou selecione manualmente o tribunal.`
          : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "track") {
      const numero = String(body.numeroProcesso || "").trim();
      const tribunal = String(body.tribunal || "").trim().toUpperCase();
      const nickname = body.nickname?.trim() || null;
      const caseId = body.case_id || null;
      const notes = body.notes?.trim() || null;
      if (!numero || !tribunal) throw new Error("numeroProcesso e tribunal são obrigatórios");

      const src = await fetchProcess(tribunal, numero, apiKey);
      if (!src) throw new Error("Processo não encontrado neste tribunal");

      const movimentos = (src.movimentos ?? []) as any[];
      const last = movimentos[movimentos.length - 1];

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data, error } = await supabaseAdmin
        .from("tracked_processes")
        .upsert({
          user_id: userId,
          case_id: caseId,
          numero_processo: numero,
          tribunal,
          nickname,
          notes,
          classe: src.classe?.nome ?? null,
          assuntos: (src.assuntos ?? []).map((a: any) => a.nome),
          orgao_julgador: src.orgaoJulgador?.nome ?? null,
          data_ajuizamento: src.dataAjuizamento ?? null,
          grau: src.grau ?? null,
          ultimo_movimento: last?.nome ?? null,
          ultimo_movimento_data: last?.dataHora ?? null,
          movimentos_count: movimentos.length,
          raw_data: src,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,numero_processo" })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, tracked: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync") {
      const id = String(body.id || "");
      if (!id) throw new Error("id obrigatório");
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: row, error: rowErr } = await supabaseAdmin
        .from("tracked_processes")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (rowErr || !row) throw new Error("Processo não encontrado");

      const src = await fetchProcess(row.tribunal, row.numero_processo, apiKey);
      if (!src) throw new Error("Processo não retornado pelo DataJud");
      const movimentos = (src.movimentos ?? []) as any[];
      const last = movimentos[movimentos.length - 1];

      const { data, error } = await supabaseAdmin
        .from("tracked_processes")
        .update({
          classe: src.classe?.nome ?? null,
          assuntos: (src.assuntos ?? []).map((a: any) => a.nome),
          orgao_julgador: src.orgaoJulgador?.nome ?? null,
          data_ajuizamento: src.dataAjuizamento ?? null,
          grau: src.grau ?? null,
          ultimo_movimento: last?.nome ?? null,
          ultimo_movimento_data: last?.dataHora ?? null,
          movimentos_count: movimentos.length,
          raw_data: src,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, tracked: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "untrack") {
      const id = String(body.id || "");
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { error } = await supabaseAdmin
        .from("tracked_processes")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (e) {
    console.error("track-process error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Erro desconhecido",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
