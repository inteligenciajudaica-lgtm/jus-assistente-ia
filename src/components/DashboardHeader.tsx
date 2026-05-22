import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewCaseDialog } from "@/components/NewCaseDialog";
import { GenerateDocumentDialog } from "@/components/GenerateDocumentDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNavTrigger } from "@/components/AppSidebar";
import { SystemNoticesPopover } from "@/components/SystemNoticesPopover";

interface DashboardHeaderProps {
  onCaseCreated?: () => void;
}

export function DashboardHeader({ onCaseCreated }: DashboardHeaderProps) {
  return (
    <header className="h-14 md:h-16 border-b border-border surface-glass flex items-center justify-between gap-2 px-3 md:px-6 lg:px-8 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xl">
        <MobileNavTrigger />
        <div className="w-full flex items-center bg-background/60 border border-border rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 surface-interactive focus-within:border-accent/60 focus-within:shadow-[var(--shadow-focus)] min-w-0">
          <Search className="size-4 text-muted-foreground mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60 min-w-0"
          />
          <kbd className="hidden sm:inline-flex items-center text-muted-foreground text-[10px] font-mono ml-2 px-1.5 py-0.5 rounded border border-border bg-muted/50">/</kbd>
        </div>
      </div>
      <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
        <div className="hidden sm:inline-flex"><ThemeToggle /></div>
        <SystemNoticesPopover />
        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
        <GenerateDocumentDialog />
        <NewCaseDialog onCreated={onCaseCreated} />
      </div>
    </header>
  );
}
