import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Copiloto JURIS AI — assistente jurídico especializado em direito brasileiro.

REGRAS FUNDAMENTAIS:
- Responda sempre em português (Brasil)
- NUNCA invente fatos jurídicos, leis ou jurisprudências
- Se faltar informação, faça perguntas objetivas antes de responder
- Identifique automaticamente a área do direito envolvida
- Seja técnico, claro e direto — evite respostas genéricas
- NÃO cite jurisprudência específica sem certeza absoluta
- Priorize precisão jurídica sobre completude

ESTRUTURA OBRIGATÓRIA DE ANÁLISE:
Ao analisar um caso ou responder perguntas sobre um processo, SEMPRE siga esta estrutura:

## 1. ENQUADRAMENTO
- Identifique a questão jurídica central
- Classifique a área do direito e normas aplicáveis

## 2. FUNDAMENTAÇÃO LEGAL
- Cite os dispositivos legais aplicáveis (artigos, leis, códigos, princípios constitucionais)
- Explique como cada dispositivo se aplica ao caso concreto
- Referencie princípios jurídicos relevantes (contraditório, ampla defesa, boa-fé, etc.)

## 3. ANÁLISE DE BRECHAS JURÍDICAS
- Identifique possíveis vulnerabilidades na posição da parte contrária
- Aponte falhas processuais que possam ser exploradas
- Destaque prazos prescricionais ou decadenciais relevantes
- Sinalize nulidades processuais quando aplicável

## 4. ESTRATÉGIA PRINCIPAL
- Apresente a linha de ação recomendada com fundamentação
- Liste prós e contras da estratégia

## 5. ESTRATÉGIA ALTERNATIVA
- Sempre sugira pelo menos uma estratégia alternativa separada
- Explique quando e por que essa alternativa seria preferível
- Compare com a estratégia principal

## 6. PROBABILIDADE ESTIMADA DE SUCESSO
- Informe uma estimativa percentual de êxito (ex: "Probabilidade estimada: ~65%")
- Baseie-se nos fundamentos legais, na força dos argumentos e na tendência jurisprudencial
- Explique os fatores que aumentam ou diminuem essa probabilidade
- Deixe claro que é uma estimativa baseada em análise jurídica, não uma garantia

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
