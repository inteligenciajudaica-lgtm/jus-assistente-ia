import { useState, useRef, useEffect, useCallback } from "react";
import { Send, RotateCcw, Link2, FolderOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

function extractQuestions(content: string): string[] {
  const lines = content.split("\n");
  const questions: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines that end with "?" and are likely questions from the AI
    if (trimmed.endsWith("?") && trimmed.length > 10 && trimmed.length < 200) {
      // Remove markdown formatting like **, -, numbers etc
      const clean = trimmed.replace(/^[-*•\d.)\s]+/, "").replace(/\*\*/g, "").trim();
      if (clean.endsWith("?") && clean.length > 10) {
        questions.push(clean);
      }
    }
  }
  return questions;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/legal-chat`;

interface AIChatPanelProps {
  caseId?: string | null;
  caseName?: string | null;
  caseDescription?: string | null;
  documents?: string[];
  missingFields?: string[];
  caseData?: {
    court: string | null;
    court_division: string | null;
    area_of_law: string | null;
    state: string | null;
    case_number: string | null;
  };
  onDocumentGenerated?: () => void;
}

export function AIChatPanel({ caseId, caseName, caseDescription, documents, missingFields, caseData, onDocumentGenerated }: AIChatPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const welcomeMessage = useCallback((): Message => {
    if (!caseId || !caseName) {
      return { role: "assistant", content: "Olá! Sou o Copiloto JURIS AI. Selecione um processo para começar." };
    }

    const hasMissing = missingFields && missingFields.length > 0;
    let content = `Olá! Estou analisando o processo **${caseName}**${caseDescription ? `:\n\n> ${caseDescription.slice(0, 200)}${caseDescription.length > 200 ? "..." : ""}` : "."}`;
    content += documents && documents.length > 0 ? `\n\n📎 **${documents.length} documento(s)** vinculado(s).` : "";

    if (hasMissing) {
      content += `\n\n⚠️ **Dados incompletos detectados:** ${missingFields.join(", ")}.\nPreciso coletar essas informações antes de gerar qualquer peça. Vamos começar?`;
    } else {
      content += `\n\n✅ Todos os dados do processo estão preenchidos. Como posso ajudar?\n- Analisar o caso e identificar brechas\n- Gerar peças jurídicas\n- Pesquisar fundamentação legal\n- Estimar probabilidade de êxito`;
    }

    return { role: "assistant", content };
  }, [caseId, caseName, caseDescription, documents, missingFields]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load or create conversation when caseId changes
  useEffect(() => {
    if (!user) return;

    const loadConversation = async () => {
      if (!caseId) {
        setConversationId(null);
        setMessages([welcomeMessage()]);
        return;
      }

      setLoadingHistory(true);
      const { data: conv } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("case_id", caseId)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conv) {
        setConversationId(conv.id);
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("role, content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });

        if (msgs && msgs.length > 0) {
          setMessages(msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
        } else {
          setMessages([welcomeMessage()]);
        }
      } else {
        const { data: newConv } = await supabase
          .from("chat_conversations")
          .insert({ user_id: user.id, case_id: caseId, title: caseName || "Conversa" })
          .select("id")
          .single();

        if (newConv) setConversationId(newConv.id);
        setMessages([welcomeMessage()]);
      }
      setLoadingHistory(false);
    };

    loadConversation();
  }, [caseId, user]);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    if (!user) return null;

    const { data } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, case_id: caseId || null, title: caseName || "Conversa geral" })
      .select("id")
      .single();

    if (data) {
      setConversationId(data.id);
      return data.id;
    }
    return null;
  }, [conversationId, user, caseId, caseName]);

  // Detect if AI generated a document and save it
  const detectAndSaveDocument = useCallback(async (content: string, convId: string | null) => {
    if (!user || !caseId) return;

    // Check for document generation patterns in AI response
    const docPatterns = [
      /(?:PETIÇÃO|CONTESTAÇÃO|RECURSO|PARECER|CONTRATO|PROCURAÇÃO|NOTIFICAÇÃO|HABEAS CORPUS|PEÇA|MINUTA)/i,
    ];
    const hasDocumentMarker = content.includes("---") && docPatterns.some(p => p.test(content));

    // Also check if content has structured legal document format
    const isStructuredDoc = (
      (content.includes("EXCELENTÍSSIMO") || content.includes("ILUSTRÍSSIMO") || content.includes("AO JUÍZO")) &&
      content.length > 500
    );

    if (hasDocumentMarker || isStructuredDoc) {
      // Extract document type
      let docType = "peça jurídica";
      const typeMatch = content.match(/(?:petição\s*inicial|contestação|recurso|parecer|contrato|procuração|notificação|habeas\s*corpus)/i);
      if (typeMatch) docType = typeMatch[0].toLowerCase();

      // Extract title
      let title = `${docType.charAt(0).toUpperCase() + docType.slice(1)} - ${caseName || "Processo"}`;

      await supabase.from("generated_documents").insert({
        user_id: user.id,
        case_id: caseId,
        conversation_id: convId,
        title,
        document_type: docType,
        content,
      });

      onDocumentGenerated?.();
      toast({ title: "Peça salva!", description: `"${title}" foi adicionada às Peças Geradas.` });
    }
  }, [user, caseId, caseName, onDocumentGenerated, toast]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: input };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    const convId = await ensureConversation();
    if (convId && user) {
      await supabase.from("chat_messages").insert({
        conversation_id: convId, user_id: user.id, role: "user", content: input,
      });
    }

    // Build context-enriched messages for AI
    const contextMessages = [...allMessages];
    if (caseId && allMessages.length <= 2) {
      const caseInfo = [
        `Processo: ${caseName || "Sem nome"}`,
        caseData?.case_number ? `Número: ${caseData.case_number}` : null,
        caseData?.court ? `Tribunal: ${caseData.court}` : null,
        caseData?.court_division ? `Vara: ${caseData.court_division}` : null,
        caseData?.area_of_law ? `Área: ${caseData.area_of_law}` : null,
        caseData?.state ? `Estado: ${caseData.state}` : null,
        caseDescription ? `Descrição: ${caseDescription}` : null,
        `Documentos: ${documents?.join(", ") || "nenhum"}`,
      ].filter(Boolean).join("\n");

      const missingInfo = missingFields && missingFields.length > 0
        ? `\n\nINFORMAÇÕES FALTANTES NO CADASTRO: ${missingFields.join(", ")}.\nIMPORTANTE: Antes de gerar qualquer peça, você DEVE perguntar ao advogado sobre cada informação faltante, uma por uma, em perguntas sequenciais. Só pergunte sobre qual documento gerar DEPOIS de coletar todos os dados necessários.`
        : "";

      const contextMsg: Message = {
        role: "user",
        content: `[CONTEXTO DO PROCESSO - NÃO RESPONDA A ESTA MENSAGEM DIRETAMENTE]\n${caseInfo}${missingInfo}\n[FIM DO CONTEXTO]`,
      };
      contextMessages.splice(0, 0, contextMsg);
    }

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: contextMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > allMessages.length) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev.slice(0, allMessages.length), { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant response
      if (assistantSoFar && convId && user) {
        await supabase.from("chat_messages").insert({
          conversation_id: convId, user_id: user.id, role: "assistant", content: assistantSoFar,
        });
        await supabase.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

        // Check if AI generated a legal document
        await detectAndSaveDocument(assistantSoFar, convId);
      }
    } catch (e: any) {
      toast({ title: "Erro na IA", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = async () => {
    setConversationId(null);
    setMessages([welcomeMessage()]);
    if (caseId && user) {
      const { data } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, case_id: caseId, title: caseName || "Nova conversa" })
        .select("id")
        .single();
      if (data) setConversationId(data.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: "Analisar Caso", prompt: "Analise este processo, identifique as questões jurídicas centrais, possíveis brechas e estime a probabilidade de sucesso." },
    { label: "Gerar Petição", prompt: "Preciso gerar uma petição inicial para este processo. Use os dados do caso e gere a peça completa." },
    { label: "Gerar Recurso", prompt: "Preciso gerar um recurso para este processo. Use os dados e elabore a peça." },
    { label: "Fundamentação Legal", prompt: "Pesquise e apresente toda a fundamentação legal aplicável a este caso, com artigos de lei e princípios." },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-bold text-primary-foreground">IA</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Copiloto Jurídico</h2>
            {caseId && caseName ? (
              <p className="text-[11px] text-primary flex items-center gap-1">
                <Link2 className="size-3" />
                {caseName}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Selecione um processo</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleNewChat} title="Nova conversa">
            <RotateCcw className="size-3" />
            Nova conversa
          </Button>
          <span className={`size-2 rounded-full ${isLoading ? "bg-warning animate-pulse" : "bg-success"}`} />
        </div>
      </div>

      {/* Messages */}
      {loadingHistory ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Carregando histórico...
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className="max-w-3xl mx-auto">
              {msg.role === "assistant" ? (
                <div className="flex gap-3 items-start">
                  <div className="size-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <span className="text-[10px] font-bold text-primary-foreground">IA</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="rounded-lg rounded-tl-none bg-card border border-border shadow-sm overflow-hidden">
                      <div className="px-6 py-5 text-[14px] leading-[1.75] prose prose-sm max-w-none dark:prose-invert chat-prose">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    {/* Clickable questions - only on the last assistant message */}
                    {i === messages.length - 1 && !isLoading && (() => {
                      const questions = extractQuestions(msg.content);
                      if (questions.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {questions.map((q, qi) => (
                            <button
                              key={qi}
                              onClick={() => { setInput(q); }}
                              className="px-3.5 py-2 bg-card border border-border rounded-lg text-xs text-left font-medium hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm transition-all max-w-full"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="px-5 py-3.5 bg-primary text-primary-foreground rounded-lg rounded-br-none text-sm max-w-[85%] shadow-sm">
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="max-w-3xl mx-auto flex gap-3 items-start">
              <div className="size-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-[10px] font-bold text-primary-foreground">IA</span>
              </div>
              <div className="px-5 py-4 bg-card border border-border rounded-lg rounded-tl-none shadow-sm text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                  </span>
                  <span className="text-muted-foreground">Analisando...</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions on fresh chat */}
          {messages.length <= 1 && caseId && (
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-2 flex-wrap justify-center mt-4">
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => setInput(qa.prompt)}
                    className="px-4 py-2.5 bg-card border border-border rounded-lg text-xs font-medium hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-border bg-card shrink-0">
        <div className="max-w-3xl mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={caseId ? `Pergunte sobre ${caseName || "este processo"}...` : "Selecione um processo para iniciar..."}
            className="w-full bg-background border border-border rounded-sm p-4 pr-14 text-sm focus:outline-none focus:ring-1 focus:ring-ring/30 h-24 resize-none placeholder:text-muted-foreground/50"
            disabled={isLoading || !caseId}
          />
          <Button
            size="icon"
            className="absolute bottom-4 right-4 size-8"
            disabled={!input.trim() || isLoading || !caseId}
            onClick={sendMessage}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
