import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Copiloto JURIS AI — assistente jurídico especializado em direito brasileiro, com foco em ANÁLISE PROFUNDA e ESTRATÉGIA.

REGRAS FUNDAMENTAIS:
- Responda sempre em português (Brasil)
- NUNCA invente fatos, leis ou jurisprudências
- Seja técnico, claro e direto
- Priorize precisão jurídica sobre completude

🔎 BUSCA DE JURISPRUDÊNCIA REAL (FERRAMENTA OBRIGATÓRIA):
Você tem acesso à ferramenta **search_jurisprudence**, que consulta a API Pública oficial do CNJ (DataJud) e retorna processos REAIS de tribunais brasileiros (STJ, TJs, TRFs, TRTs, etc.).
- SEMPRE chame essa ferramenta antes de citar jurisprudência em respostas analíticas.
- Use os termos centrais do caso (matéria, tese, instituto jurídico) como query.
- Selecione tribunais conforme o caso (STJ para padronização federal; TJ da UF para casos estaduais).
- Cite APENAS julgados retornados pela ferramenta (com número CNJ, órgão e data) — NUNCA invente.
- Se a busca não retornar resultados relevantes, declare expressamente "não foram encontrados precedentes diretos via DataJud — recomenda-se pesquisa complementar".

🔍 PROTOCOLO DE REVISÃO ANTES DE ENTREGAR (OBRIGATÓRIO):
Antes de finalizar QUALQUER resposta analítica, revise mentalmente:
1. ✅ Identifiquei TODAS as brechas processuais possíveis? (prescrição, decadência, nulidades, ilegitimidade, incompetência, cerceamento de defesa, coisa julgada)
2. ✅ Verifiquei TODAS as teses defensivas/ofensivas aplicáveis ao caso?
3. ✅ Há jurisprudência consolidada (Súmulas STF/STJ, repetitivos, repercussão geral) que reforce a tese?
4. ✅ Considerei princípios constitucionais aplicáveis (devido processo, contraditório, ampla defesa, dignidade)?
5. ✅ Apontei riscos contrários e como mitigá-los?
Se faltar algo nessa lista, ADICIONE antes de responder.

FORMATAÇÃO VISUAL (MUITO IMPORTANTE):
- Use cabeçalhos H2 (##) com EMOJIS para destacar seções
- Use linhas em branco entre parágrafos para respiração visual
- Use **negrito** para termos jurídicos-chave
- Use > blockquotes para citações de leis e jurisprudência
- Use listas com - para enumerações
- Use --- (linha horizontal) para separar grandes seções

COLETA DE DADOS OBRIGATÓRIA:
Quando o contexto indicar INFORMAÇÕES FALTANTES:
1. Faça UMA pergunta por vez, em ordem: área → número → tribunal/vara → estado → fatos
2. Após cada resposta, passe à próxima pendente
3. Só pergunte qual peça gerar APÓS coletar todos os dados

ESTRUTURA OBRIGATÓRIA DE ANÁLISE:

## ⚖️ 1. ENQUADRAMENTO JURÍDICO
- Questão central e área do direito
- Normas aplicáveis (resumo)

## 📚 2. FUNDAMENTAÇÃO LEGAL
- Dispositivos legais aplicáveis (artigo, lei, código)
- Como cada um se aplica ao caso
- Princípios constitucionais relevantes

> Cite leis em blockquote: "Art. X da Lei Y/ZZZZ — texto..."

## 🔓 3. BRECHAS E VULNERABILIDADES
- Falhas processuais exploráveis
- Prazos prescricionais/decadenciais
- Nulidades, ilegitimidade, incompetência
- Vícios formais

## 📖 4. JURISPRUDÊNCIA APLICÁVEL
- Súmulas relevantes (apenas se tiver certeza)
- Precedentes vinculantes (STF/STJ)
- Se não houver certeza, indique "pesquisar jurisprudência sobre [tema]"

## 🎯 5. ESTRATÉGIA PRINCIPAL
- Linha de ação recomendada
- Prós e contras

## 🔄 6. ESTRATÉGIA ALTERNATIVA
- Plano B com fundamentação
- Quando seria preferível

## ⚠️ 7. RISCOS DA PARTE CONTRÁRIA
- Possíveis contra-argumentos
- Como neutralizá-los

## 📊 8. PROBABILIDADE ESTIMADA
- Estimativa em % (ex: ~65%)
- Fatores que influenciam
- Aviso: estimativa, não garantia

GERAÇÃO DE PEÇAS JURÍDICAS:
- SEMPRE confirme antes de gerar
- Estrutura: Endereçamento, Qualificação, Fatos, Fundamentação, Pedidos, Fechamento
- Linguagem formal pronta para protocolo

LIMITES:
- Você é ASSISTENTE — não substitui o advogado
- Sinalize quando algo exige análise mais aprofundada`;

// Definição da ferramenta de busca de jurisprudência (DataJud CNJ)
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_jurisprudence",
      description:
        "Consulta a API Pública oficial do CNJ (DataJud) para buscar processos e jurisprudência REAIS dos tribunais brasileiros. Use sempre que precisar citar precedentes ou verificar entendimento de tribunais.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Termos centrais da pesquisa: matéria, tese, instituto jurídico (ex: 'dano moral negativação indevida').",
          },
          tribunais: {
            type: "array",
            items: { type: "string" },
            description:
              "Códigos dos tribunais (ex: STJ, TJSP, TJRJ, TRF1, TST). Padrão: STJ + TJ da UF do caso.",
          },
          numeroProcesso: {
            type: "string",
            description: "Número CNJ específico (opcional).",
          },
        },
        required: ["query"],
      },
    },
  },
];

async function callJurisprudenceTool(args: {
  query: string;
  tribunais?: string[];
  numeroProcesso?: string;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/search-jurisprudence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify(args),
    });
    return await resp.json();
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "erro" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    type ProviderCfg = { provider: "lovable" | "openai"; model: string; enabled: boolean };
    let providers: ProviderCfg[] = [
      { provider: "lovable", model: "google/gemini-3-flash-preview", enabled: true },
    ];

    // Verifica se a integração jurisprudência está habilitada
    let jurisprudenceEnabled = true;
    try {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["ai_provider", "jurisprudence_config"]);
      for (const s of settings ?? []) {
        if (s.key === "ai_provider") {
          const v = s.value as any;
          if (v && Array.isArray(v.providers) && v.providers.length > 0) {
            providers = v.providers;
          } else if (v?.provider) {
            providers = [{ provider: v.provider, model: v.model, enabled: true }];
          }
        }
        if (s.key === "jurisprudence_config") {
          const v = s.value as any;
          if (typeof v?.enabled === "boolean") jurisprudenceEnabled = v.enabled;
        }
      }
    } catch (e) {
      console.warn("Falha lendo app_settings, usando padrão");
    }

    const activeProviders = providers.filter((p) => p.enabled);
    if (activeProviders.length === 0) {
      throw new Error("Nenhum provedor de IA habilitado. Configure em Admin → Configurações.");
    }

    const buildBody = (msgs: any[], stream: boolean, withTools: boolean) => ({
      model: "",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...msgs],
      stream,
      ...(withTools && jurisprudenceEnabled ? { tools: TOOLS, tool_choice: "auto" as const } : {}),
    });

    const callProvider = async (cfg: ProviderCfg, body: any) => {
      let endpoint: string;
      let apiKey: string | undefined;
      if (cfg.provider === "openai") {
        endpoint = "https://api.openai.com/v1/chat/completions";
        apiKey = Deno.env.get("OPENAI_API_KEY");
      } else {
        endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
        apiKey = Deno.env.get("LOVABLE_API_KEY");
      }
      if (!apiKey) return { ok: false, status: 500, missingKey: true } as any;
      return fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model: cfg.model }),
      });
    };

    let workingMessages = [...messages];
    let lastError = "";
    let chosenProvider: ProviderCfg | null = null;

    // ETAPA 1 — chamada não-streaming com tools para detectar uso de jurisprudência
    if (jurisprudenceEnabled) {
      for (const cfg of activeProviders) {
        const resp: any = await callProvider(cfg, buildBody(workingMessages, false, true));
        if (resp?.missingKey) {
          lastError = `${cfg.provider}: API key ausente`;
          continue;
        }
        if (resp.status === 429 || resp.status === 402) {
          return new Response(
            JSON.stringify({
              error:
                resp.status === 429
                  ? "Limite de requisições excedido. Tente novamente em alguns instantes."
                  : "Créditos esgotados. Adicione créditos em Configurações > Workspace > Uso.",
            }),
            { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (!resp.ok) {
          lastError = `${cfg.provider} ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
          continue;
        }
        const data = await resp.json();
        const msg = data?.choices?.[0]?.message;
        chosenProvider = cfg;

        const toolCalls = msg?.tool_calls ?? [];
        if (toolCalls.length > 0) {
          console.log(`[tools] ${toolCalls.length} chamada(s) detectada(s)`);
          workingMessages.push(msg);
          for (const tc of toolCalls) {
            if (tc.function?.name === "search_jurisprudence") {
              let args: any = {};
              try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch {}
              const result = await callJurisprudenceTool(args);
              workingMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result).slice(0, 12000),
              });
            }
          }
        } else if (msg?.content) {
          // Resposta direta sem tools — devolvemos como SSE para o frontend
          const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: msg.content } }] })}\n\ndata: [DONE]\n\n`;
          return new Response(sse, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
              "X-AI-Provider": cfg.provider,
              "X-AI-Model": cfg.model,
            },
          });
        }
        break;
      }
    }

    // ETAPA 2 — streaming final (com contexto de tools, se houve)
    const provs = chosenProvider ? [chosenProvider, ...activeProviders.filter(p => p !== chosenProvider)] : activeProviders;
    for (const cfg of provs) {
      const resp: any = await callProvider(cfg, buildBody(workingMessages, true, false));
      if (resp?.missingKey) { lastError = `${cfg.provider}: API key ausente`; continue; }
      if (resp.status === 429 || resp.status === 402) {
        return new Response(
          JSON.stringify({
            error: resp.status === 429
              ? "Limite de requisições excedido."
              : "Créditos esgotados.",
          }),
          { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.ok) {
        return new Response(resp.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "X-AI-Provider": cfg.provider,
            "X-AI-Model": cfg.model,
          },
        });
      }
      lastError = `${cfg.provider} ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
    }

    return new Response(JSON.stringify({ error: `Todos os provedores falharam. Último erro: ${lastError}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

