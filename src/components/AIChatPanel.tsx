import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/legal-chat`;

export function AIChatPanel() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o Copiloto JURIS AI. Como posso ajudar você hoje? Posso analisar casos, pesquisar jurisprudência ou auxiliar na redação de peças jurídicas.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: input };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
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
    } catch (e: any) {
      toast({ title: "Erro na IA", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: "Analisar Caso", prompt: "Preciso de ajuda para analisar um caso. Vou fornecer os detalhes." },
    { label: "Gerar Peça", prompt: "Preciso gerar uma peça jurídica. Quais informações você precisa?" },
    { label: "Pesquisar Lei", prompt: "Preciso pesquisar a legislação aplicável ao seguinte tema:" },
  ];

  return (
    <aside className="w-96 border-l border-border flex flex-col bg-card shrink-0">
      <div className="p-5 border-b border-border bg-muted">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight uppercase">Copiloto Jurídico</h2>
          <span className={`size-2 rounded-full ${isLoading ? "bg-warning animate-pulse" : "bg-success"}`} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Assistente de análise e redação</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "assistant" ? (
              <div className="flex gap-3 items-start">
                <div className="size-6 bg-muted border border-border flex items-center justify-center shrink-0 rounded-sm">
                  <span className="text-[9px] font-bold">IA</span>
                </div>
                <div className="p-3 bg-muted border border-border rounded-sm text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="p-3 bg-primary text-primary-foreground rounded-sm text-sm max-w-[80%]">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 items-start">
            <div className="size-6 bg-muted border border-border flex items-center justify-center shrink-0 rounded-sm">
              <span className="text-[9px] font-bold">IA</span>
            </div>
            <div className="p-3 bg-muted border border-border rounded-sm text-sm">
              <span className="animate-pulse">Analisando...</span>
            </div>
          </div>
        )}

        {messages.length <= 1 && (
          <div className="flex gap-2 flex-wrap">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => { setInput(qa.prompt); }}
                className="px-3 py-1.5 bg-muted border border-border rounded-sm text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo sobre seu caso..."
            className="w-full bg-background border border-border rounded-sm p-3 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-ring/30 h-20 resize-none placeholder:text-muted-foreground/50"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="absolute bottom-3 right-3 size-7"
            disabled={!input.trim() || isLoading}
            onClick={sendMessage}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
