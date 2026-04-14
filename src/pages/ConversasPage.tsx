import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Conversation {
  id: string;
  title: string | null;
  case_id: string | null;
  created_at: string;
  updated_at: string;
  case_name?: string;
  message_count: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ConversasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: convs } = await supabase
        .from("chat_conversations")
        .select("id, title, case_id, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (convs) {
        // Get case names and message counts
        const caseIds = [...new Set(convs.filter((c) => c.case_id).map((c) => c.case_id!))];
        const { data: cases } = caseIds.length > 0
          ? await supabase.from("cases").select("id, client_name").in("id", caseIds)
          : { data: [] };
        const caseMap = new Map<string, string>(cases?.map((c) => [c.id, c.client_name] as [string, string]) || []);

        const withCounts = await Promise.all(
          convs.map(async (conv) => {
            const { count } = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id);
            return {
              ...conv,
              case_name: conv.case_id ? (caseMap.get(conv.case_id) || "—") : undefined,
              message_count: count || 0,
            };
          })
        );
        setConversations(withCounts);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.title?.toLowerCase().includes(q)) || (c.case_name?.toLowerCase().includes(q));
  });

  const handleClick = (conv: Conversation) => {
    if (conv.case_id) {
      navigate(`/processos?case=${conv.case_id}`);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <section className="flex-1 overflow-y-auto p-8 space-y-6">
          <h1 className="text-xl font-medium">Conversas com IA</h1>

          <div className="flex items-center bg-card border border-border rounded-sm px-3 py-2 max-w-md">
            <Search className="size-3.5 text-muted-foreground mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar conversas..."
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60"
            />
            <span className="text-xs text-muted-foreground ml-2">{filtered.length}</span>
          </div>

          {loading ? (
            <div className="bg-card border border-border rounded-sm p-8 text-center text-muted-foreground text-sm">
              Carregando conversas...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-sm p-8 text-center text-muted-foreground text-sm">
              {conversations.length === 0 ? "Nenhuma conversa registrada." : "Nenhum resultado encontrado."}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleClick(conv)}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-sm hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="size-9 bg-muted border border-border rounded-sm flex items-center justify-center shrink-0">
                    <MessageSquare className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title || "Conversa sem título"}</p>
                    <p className="text-xs text-muted-foreground">
                      {conv.message_count} mensagens
                      {conv.case_name && <> · <span className="text-primary">{conv.case_name}</span></>}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{formatDate(conv.updated_at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
