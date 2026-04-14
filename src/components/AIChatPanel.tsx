import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const initialMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Olá, Dr. Ricardo! Identifiquei um erro processual na movimentação 142 do processo Vale do Sol. Deseja que eu redija um embargo de declaração com base no Art. 1.022 do CPC?",
  },
];

export function AIChatPanel() {
  const [messages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  return (
    <aside className="w-96 border-l border-border flex flex-col bg-card shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-border bg-muted">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight uppercase">Copiloto Jurídico</h2>
          <span className="size-2 rounded-full bg-success animate-pulse" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Assistente de análise e redação</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className="space-y-2">
            {msg.role === "assistant" && (
              <div className="flex gap-3 items-start">
                <div className="size-6 bg-muted border border-border flex items-center justify-center shrink-0 rounded-sm">
                  <span className="text-[9px] font-bold">IA</span>
                </div>
                <div className="p-3 bg-muted border border-border rounded-sm text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            )}
            {msg.role === "user" && (
              <div className="flex justify-end">
                <div className="p-3 bg-primary text-primary-foreground rounded-sm text-sm max-w-[80%]">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <button className="px-3 py-1.5 bg-muted border border-border rounded-sm text-xs font-medium hover:bg-muted/80 transition-colors">
            Gerar Rascunho
          </button>
          <button className="px-3 py-1.5 bg-muted border border-border rounded-sm text-xs font-medium hover:bg-muted/80 transition-colors">
            Analisar Caso
          </button>
          <button className="px-3 py-1.5 bg-muted border border-border rounded-sm text-xs font-medium hover:bg-muted/80 transition-colors">
            Pesquisar Jurisprudência
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo sobre este caso..."
            className="w-full bg-background border border-border rounded-sm p-3 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-ring/30 h-20 resize-none placeholder:text-muted-foreground/50"
          />
          <Button
            size="icon"
            className="absolute bottom-3 right-3 size-7"
            disabled={!input.trim()}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
        <div className="mt-2 flex justify-between items-center text-[10px] text-muted-foreground font-mono">
          <span>CMD + K para atalhos</span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 bg-success rounded-full" />
            IA Ativa
          </span>
        </div>
      </div>
    </aside>
  );
}
