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
- Cite APENAS julgados retornados pela ferramenta (com número CNJ, órgão e data) — NUNCA invente.

🔍 PROTOCOLO DE REVISÃO ANTES DE ENTREGAR (OBRIGATÓRIO):
1. ✅ Identifiquei TODAS as brechas processuais? (prescrição, decadência, nulidades, ilegitimidade, incompetência, cerceamento)
2. ✅ Verifiquei TODAS as teses defensivas/ofensivas?
3. ✅ Há jurisprudência consolidada (Súmulas, repetitivos, repercussão geral)?
4. ✅ Considerei princípios constitucionais aplicáveis?
5. ✅ Apontei riscos contrários e como mitigá-los?

FORMATAÇÃO VISUAL:
- Cabeçalhos H2 (##) com EMOJIS
- Linhas em branco entre parágrafos
- **negrito** para termos-chave
- > blockquotes para leis e jurisprudência
- --- entre grandes seções

ESTRUTURA OBRIGATÓRIA DE ANÁLISE:
## ⚖️ 1. ENQUADRAMENTO JURÍDICO
## 📚 2. FUNDAMENTAÇÃO LEGAL
## 🔓 3. BRECHAS E VULNERABILIDADES
## 📖 4. JURISPRUDÊNCIA APLICÁVEL
## 🎯 5. ESTRATÉGIA PRINCIPAL
## 🔄 6. ESTRATÉGIA ALTERNATIVA
## ⚠️ 7. RISCOS DA PARTE CONTRÁRIA
## 📊 8. PROBABILIDADE ESTIMADA

LIMITES: Você é ASSISTENTE — não substitui o advogado.`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_jurisprudence",
      description:
        "Consulta a API Pública oficial do CNJ (DataJud) para buscar processos e jurisprudência REAIS dos tribunais brasileiros.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termos centrais da pesquisa." },
          tribunais: {
            type: "array",
            items: { type: "string" },
            description: "Códigos dos tribunais (STJ, TJSP, TJRJ, TRF1, TST, etc.).",
          },
          numeroProcesso: { type: "string", description: "Número CNJ específico (opcional)." },
        },
        required: ["query"],
      },
    },
  },
];

async function callJurisprudenceTool(args: any) {
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

type ProviderId = "lovable" | "openai" | "anthropic";
type ProviderCfg = { provider: ProviderId; model: string; enabled: boolean };

// Converte mensagens OpenAI-style para formato Anthropic
function toAnthropicMessages(msgs: any[]) {
  const system = msgs.find((m) => m.role === "system")?.content ?? "";
  const conversation = msgs.filter((m) => m.role !== "system" && m.role !== "tool");
  return {
    system,
    messages: conversation.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
  };
}

// Streaming SSE adapter Anthropic -> formato OpenAI (delta.content) que o frontend já entende
function anthropicToOpenAIStream(anthropicBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = anthropicBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const evt = JSON.parse(json);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            const out = `data: ${JSON.stringify({ choices: [{ delta: { content: evt.delta.text } }] })}\n\n`;
            controller.enqueue(encoder.encode(out));
          }
        } catch {
          // ignora linhas parciais
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let providers: ProviderCfg[] = [
      { provider: "lovable", model: "google/gemini-3-flash-preview", enabled: true },
    ];
    let jurisprudenceEnabled = true;
    let dbApiKeys: { openai?: string; anthropic?: string } = {};

    try {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["ai_provider", "jurisprudence_config", "api_keys"]);
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
        if (s.key === "api_keys") {
          dbApiKeys = (s.value as any) ?? {};
        }
      }
    } catch (e) {
      console.warn("Falha lendo app_settings, usando padrão");
    }

    const activeProviders = providers.filter((p) => p.enabled);
    if (activeProviders.length === 0) {
      throw new Error("Nenhum provedor de IA habilitado. Configure em Admin → Configurações.");
    }

    // Resolve chave: prioriza app_settings (definida pelo admin na UI), depois secret env
    const getApiKey = (provider: ProviderId): string | undefined => {
      if (provider === "lovable") return Deno.env.get("LOVABLE_API_KEY");
      if (provider === "openai") return dbApiKeys.openai || Deno.env.get("OPENAI_API_KEY");
      if (provider === "anthropic") return dbApiKeys.anthropic || Deno.env.get("ANTHROPIC_API_KEY");
      return undefined;
    };

    const buildOpenAIBody = (msgs: any[], stream: boolean, withTools: boolean, model: string) => ({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...msgs],
      stream,
      ...(withTools && jurisprudenceEnabled ? { tools: TOOLS, tool_choice: "auto" as const } : {}),
    });

    // Chamada genérica — devolve Response do fetch (ou objeto com missingKey)
    const callProvider = async (
      cfg: ProviderCfg,
      msgs: any[],
      stream: boolean,
      withTools: boolean,
    ): Promise<Response | { missingKey: true }> => {
      const apiKey = getApiKey(cfg.provider);
      if (!apiKey) return { missingKey: true };

      if (cfg.provider === "anthropic") {
        const { system, messages: anthroMsgs } = toAnthropicMessages([
          { role: "system", content: SYSTEM_PROMPT },
          ...msgs,
        ]);
        return fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: cfg.model,
            max_tokens: 4096,
            system,
            messages: anthroMsgs,
            stream,
          }),
        });
      }

      const endpoint =
        cfg.provider === "openai"
          ? "https://api.openai.com/v1/chat/completions"
          : "https://ai.gateway.lovable.dev/v1/chat/completions";

      return fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildOpenAIBody(msgs, stream, withTools, cfg.model)),
      });
    };

    let workingMessages = [...messages];
    let lastError = "";
    let chosenProvider: ProviderCfg | null = null;

    // ETAPA 1 — tools (apenas Lovable/OpenAI suportam tool calling no formato esperado)
    // Anthropic será usado apenas para resposta final.
    if (jurisprudenceEnabled) {
      const toolCapable = activeProviders.filter((p) => p.provider !== "anthropic");
      for (const cfg of toolCapable) {
        const resp = await callProvider(cfg, workingMessages, false, true);
        if ("missingKey" in resp) {
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

    // ETAPA 2 — streaming final
    const provs = chosenProvider
      ? [chosenProvider, ...activeProviders.filter((p) => p !== chosenProvider)]
      : activeProviders;

    for (const cfg of provs) {
      const resp = await callProvider(cfg, workingMessages, true, false);
      if ("missingKey" in resp) {
        lastError = `${cfg.provider}: API key ausente`;
        continue;
      }
      if (resp.status === 429 || resp.status === 402) {
        return new Response(
          JSON.stringify({
            error: resp.status === 429 ? "Limite de requisições excedido." : "Créditos esgotados.",
          }),
          { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.ok && resp.body) {
        const body =
          cfg.provider === "anthropic"
            ? anthropicToOpenAIStream(resp.body)
            : resp.body;
        return new Response(body, {
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
