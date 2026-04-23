// Edge function: consulta a API Pública DataJud do CNJ
// Documentação oficial: https://datajud-wiki.cnj.jus.br/api-publica/acesso
// Não requer chave do usuário — usa a chave pública oficial do CNJ.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Chave pública oficial do CNJ (publicada na wiki — pode ser sobrescrita via secret DATAJUD_API_KEY se rotacionada)
const DEFAULT_DATAJUD_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

const TRIBUNAL_ALIASES: Record<string, string> = {
  // Superiores
  STJ: "api_publica_stj",
  TST: "api_publica_tst",
  TSE: "api_publica_tse",
  STM: "api_publica_stm",
  // Justiça Federal
  TRF1: "api_publica_trf1",
  TRF2: "api_publica_trf2",
  TRF3: "api_publica_trf3",
  TRF4: "api_publica_trf4",
  TRF5: "api_publica_trf5",
  TRF6: "api_publica_trf6",
  // Justiça Estadual (TJs por UF)
  TJSP: "api_publica_tjsp",
  TJRJ: "api_publica_tjrj",
  TJMG: "api_publica_tjmg",
  TJRS: "api_publica_tjrs",
  TJPR: "api_publica_tjpr",
  TJSC: "api_publica_tjsc",
  TJBA: "api_publica_tjba",
  TJDF: "api_publica_tjdft",
  TJGO: "api_publica_tjgo",
  TJES: "api_publica_tjes",
  TJPE: "api_publica_tjpe",
  TJCE: "api_publica_tjce",
  TJPA: "api_publica_tjpa",
  TJAM: "api_publica_tjam",
  TJMT: "api_publica_tjmt",
  TJMS: "api_publica_tjms",
  TJPB: "api_publica_tjpb",
  TJRN: "api_publica_tjrn",
  TJAL: "api_publica_tjal",
  TJSE: "api_publica_tjse",
  TJPI: "api_publica_tjpi",
  TJMA: "api_publica_tjma",
  TJTO: "api_publica_tjto",
  TJAC: "api_publica_tjac",
  TJAP: "api_publica_tjap",
  TJRO: "api_publica_tjro",
  TJRR: "api_publica_tjrr",
  // Trabalho (TRTs principais)
  TRT1: "api_publica_trt1",
  TRT2: "api_publica_trt2",
  TRT3: "api_publica_trt3",
  TRT4: "api_publica_trt4",
  TRT15: "api_publica_trt15",
};

interface SearchPayload {
  query: string; // termos livres (assuntos / classe / fundamentos)
  tribunais?: string[]; // ex: ["STJ","TJSP"]
  numeroProcesso?: string; // CNJ
  size?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SearchPayload;
    const apiKey = Deno.env.get("DATAJUD_API_KEY") ?? DEFAULT_DATAJUD_KEY;

    const tribunais =
      body.tribunais && body.tribunais.length > 0
        ? body.tribunais
        : ["STJ", "TJSP", "TJRJ"]; // padrão amplo
    const size = Math.min(body.size ?? 5, 10);

    const elasticQuery: Record<string, unknown> = body.numeroProcesso
      ? {
          query: { match: { numeroProcesso: body.numeroProcesso.replace(/\D/g, "") } },
          size,
        }
      : {
          query: {
            multi_match: {
              query: body.query,
              fields: ["assuntos.nome^3", "classe.nome^2", "movimentos.nome"],
            },
          },
          size,
          sort: [{ dataAjuizamento: { order: "desc" } }],
        };

    const results: any[] = [];
    const errors: { tribunal: string; error: string }[] = [];

    await Promise.all(
      tribunais.map(async (tb) => {
        const alias = TRIBUNAL_ALIASES[tb.toUpperCase()];
        if (!alias) {
          errors.push({ tribunal: tb, error: "Tribunal não suportado" });
          return;
        }
        try {
          const resp = await fetch(
            `https://api-publica.datajud.cnj.jus.br/${alias}/_search`,
            {
              method: "POST",
              headers: {
                Authorization: `APIKey ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(elasticQuery),
            },
          );
          if (!resp.ok) {
            errors.push({
              tribunal: tb,
              error: `HTTP ${resp.status}`,
            });
            return;
          }
          const data = await resp.json();
          const hits = data?.hits?.hits ?? [];
          for (const h of hits) {
            const src = h._source ?? {};
            results.push({
              tribunal: tb,
              numeroProcesso: src.numeroProcesso,
              classe: src.classe?.nome,
              assuntos: (src.assuntos ?? []).map((a: any) => a.nome),
              orgaoJulgador: src.orgaoJulgador?.nome,
              dataAjuizamento: src.dataAjuizamento,
              grau: src.grau,
              ultimoMovimento:
                (src.movimentos ?? []).slice(-1)[0]?.nome ?? null,
            });
          }
        } catch (e) {
          errors.push({
            tribunal: tb,
            error: e instanceof Error ? e.message : "erro desconhecido",
          });
        }
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        results,
        errors,
        source: "DataJud CNJ - API Pública",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("search-jurisprudence error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
