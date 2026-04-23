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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    // Lê configuração de provedor de IA (Lovable ou OpenAI)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Lista de provedores ordenada por prioridade (com fallback)
    type ProviderCfg = { provider: "lovable" | "openai"; model: string; enabled: boolean };
    let providers: ProviderCfg[] = [
      { provider: "lovable", model: "google/gemini-3-flash-preview", enabled: true },
    ];
    try {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_provider")
        .maybeSingle();
      const v = setting?.value as any;
      if (v && Array.isArray(v.providers) && v.providers.length > 0) {
        providers = v.providers;
      } else if (v?.provider) {
        // Compatibilidade com formato antigo
        providers = [{ provider: v.provider, model: v.model, enabled: true }];
      }
    } catch (e) {
      console.warn("Não foi possível ler app_settings, usando padrão Lovable AI");
    }

    const activeProviders = providers.filter((p) => p.enabled);
    if (activeProviders.length === 0) {
      throw new Error("Nenhum provedor de IA está habilitado. Configure em Admin → Configurações.");
    }

    let lastError = "";
    for (const cfg of activeProviders) {
      let endpoint: string;
      let apiKey: string | undefined;

      if (cfg.provider === "openai") {
        endpoint = "https://api.openai.com/v1/chat/completions";
        apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
          lastError = "OPENAI_API_KEY não configurada";
          console.warn(`[fallback] ${lastError}, tentando próximo provedor...`);
          continue;
        }
      } else {
        endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
        apiKey = Deno.env.get("LOVABLE_API_KEY");
        if (!apiKey) {
          lastError = "LOVABLE_API_KEY não configurada";
          console.warn(`[fallback] ${lastError}, tentando próximo provedor...`);
          continue;
        }
      }

      console.log(`[ai] Tentando provedor: ${cfg.provider} (${cfg.model})`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (response.ok) {
        return new Response(response.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "X-AI-Provider": cfg.provider,
            "X-AI-Model": cfg.model,
          },
        });
      }

      // Erros não recuperáveis (rate limit / créditos) — retornar imediatamente
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Configurações > Workspace > Uso." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const t = await response.text();
      lastError = `${cfg.provider} retornou ${response.status}: ${t.slice(0, 200)}`;
      console.error(`[fallback] ${lastError}`);
      // tenta próximo
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
