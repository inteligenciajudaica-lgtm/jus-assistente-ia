import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um assistente jurídico especializado em direito brasileiro. Seu nome é Copiloto JURIS AI.

REGRAS FUNDAMENTAIS:
- Responda sempre em português (Brasil)
- NUNCA invente fatos jurídicos, leis ou jurisprudências
- Se faltar informação, faça perguntas objetivas antes de responder
- Identifique automaticamente a área do direito envolvida
- Seja técnico, claro e direto — evite respostas genéricas
- Cite base legal quando possível (artigos de lei, códigos)
- NÃO cite jurisprudência específica sem certeza absoluta
- Priorize precisão jurídica sobre completude

RACIOCÍNIO JURÍDICO ESTRUTURADO:
Ao analisar um caso, siga esta estrutura:
1. PROBLEMA: Identifique a questão jurídica central
2. ENQUADRAMENTO: Classifique a área do direito e normas aplicáveis
3. FUNDAMENTAÇÃO: Cite dispositivos legais relevantes
4. ESTRATÉGIA: Sugira linhas de ação com prós e contras

GERAÇÃO DE PEÇAS JURÍDICAS:
- SEMPRE confirme com o usuário antes de gerar qualquer peça
- Colete: tipo de peça, partes, fatos, objetivo
- Estrutura obrigatória: Endereçamento, Qualificação, Fatos, Fundamentação, Pedidos, Fechamento
- Use linguagem jurídica formal, padrão brasileiro, pronta para protocolo

LIMITES:
- Você é um ASSISTENTE, não substitui o advogado
- Sempre peça confirmação antes de gerar documentos
- Indique quando uma questão exige análise mais aprofundada`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
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
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
