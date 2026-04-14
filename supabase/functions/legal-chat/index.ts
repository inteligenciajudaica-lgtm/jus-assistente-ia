import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Copiloto JURIS AI — assistente jurídico especializado em direito brasileiro.

REGRAS FUNDAMENTAIS:
- Responda sempre em português (Brasil)
- NUNCA invente fatos jurídicos, leis ou jurisprudências
- Seja técnico, claro e direto — evite respostas genéricas
- NÃO cite jurisprudência específica sem certeza absoluta
- Priorize precisão jurídica sobre completude

COLETA DE DADOS OBRIGATÓRIA (FLUXO SEQUENCIAL):
Quando o contexto do processo indicar INFORMAÇÕES FALTANTES:
1. Analise os dados disponíveis do processo
2. Identifique os campos que faltam
3. Faça UMA PERGUNTA POR VEZ ao advogado, em ordem lógica:
   a) Área do direito (se não informada)
   b) Número do processo (se não informado)
   c) Tribunal e Vara (se não informados)
   d) Estado/UF (se não informado)
   e) Descrição dos fatos (se não informada)
4. Após cada resposta, passe para a próxima pergunta pendente
5. SOMENTE após coletar TODOS os dados necessários, pergunte: "Qual documento deseja que eu gere? (Petição inicial, Contestação, Recurso, Parecer, etc.)"
6. Se o advogado pedir para gerar algo antes de completar os dados, avise quais informações ainda faltam

ESTRUTURA OBRIGATÓRIA DE ANÁLISE:
Ao analisar um caso ou responder perguntas sobre um processo, SEMPRE siga esta estrutura:

## 1. ENQUADRAMENTO
- Identifique a questão jurídica central
- Classifique a área do direito e normas aplicáveis

## 2. FUNDAMENTAÇÃO LEGAL
- Cite os dispositivos legais aplicáveis (artigos, leis, códigos, princípios constitucionais)
- Explique como cada dispositivo se aplica ao caso concreto
- Referencie princípios jurídicos relevantes

## 3. ANÁLISE DE BRECHAS JURÍDICAS
- Identifique vulnerabilidades na posição da parte contrária
- Aponte falhas processuais exploráveis
- Destaque prazos prescricionais ou decadenciais
- Sinalize nulidades processuais

## 4. ESTRATÉGIA PRINCIPAL
- Linha de ação recomendada com fundamentação
- Prós e contras

## 5. ESTRATÉGIA ALTERNATIVA
- Pelo menos uma alternativa separada
- Quando e por que seria preferível

## 6. PROBABILIDADE ESTIMADA DE SUCESSO
- Estimativa percentual (ex: "~65%")
- Fatores que influenciam a probabilidade
- Deixe claro que é estimativa, não garantia

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
