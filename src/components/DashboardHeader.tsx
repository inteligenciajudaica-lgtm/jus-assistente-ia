import { Search, Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardHeader() {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center flex-1 max-w-xl">
        <div className="w-full flex items-center bg-background border border-border rounded-sm px-3 py-1.5 focus-within:ring-1 focus-within:ring-ring/30 transition-all">
          <Search className="size-3.5 text-muted-foreground mr-2" />
          <input
            type="text"
            placeholder="Pesquisar processos, clientes ou jurisprudência..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60"
          />
          <span className="text-muted-foreground text-[10px] font-mono ml-2 hidden sm:block">/search</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-2 bg-accent rounded-full" />
        </Button>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Novo Processo
        </Button>
      </div>
    </header>
  );
}
