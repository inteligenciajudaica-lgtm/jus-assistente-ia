import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewCaseDialog } from "@/components/NewCaseDialog";
import { GenerateDocumentDialog } from "@/components/GenerateDocumentDialog";

interface DashboardHeaderProps {
  onCaseCreated?: () => void;
}

export function DashboardHeader({ onCaseCreated }: DashboardHeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-6 lg:px-8 shrink-0 sticky top-0 z-30">
      <div className="flex items-center flex-1 max-w-xl">
        <div className="w-full flex items-center bg-background border border-border rounded-md px-3 py-2 surface-interactive focus-within:border-accent/50 focus-within:shadow-[var(--shadow-focus)]">
          <Search className="size-4 text-muted-foreground mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar processos, clientes ou jurisprudência..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden sm:inline-flex items-center text-muted-foreground text-[10px] font-mono ml-2 px-1.5 py-0.5 rounded border border-border bg-muted/50">/</kbd>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <Button variant="ghost" size="icon" className="relative rounded-md hover:bg-muted">
          <Bell className="size-4" />
          <span className="absolute top-2 right-2 size-1.5 bg-accent rounded-full" />
        </Button>
        <div className="h-6 w-px bg-border mx-1" />
        <GenerateDocumentDialog />
        <NewCaseDialog onCreated={onCaseCreated} />
      </div>
    </header>
  );
}
