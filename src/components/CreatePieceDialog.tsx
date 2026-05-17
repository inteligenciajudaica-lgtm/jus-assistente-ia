import { useMemo, useState } from "react";
import { FilePlus2, Search, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GenerateDocumentDialog } from "@/components/GenerateDocumentDialog";

type Category = "pecas" | "contrato" | "extrajudicial" | "ferramentas";
type Area =
  | "civel"
  | "trabalhista"
  | "penal"
  | "previdenciario"
  | "familia"
  | "administrativo"
  | "tributario"
  | "transito";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "pecas", label: "Peças Jurídicas" },
  { id: "contrato", label: "Contrato" },
  { id: "extrajudicial", label: "Extrajudicial" },
  { id: "ferramentas", label: "Ferramentas Auxiliares" },
];

const AREAS: { id: Area; label: string }[] = [
  { id: "civel", label: "Cível" },
  { id: "trabalhista", label: "Trabalhista" },
  { id: "penal", label: "Penal" },
  { id: "previdenciario", label: "Previdenciário" },
  { id: "familia", label: "Família e Sucessões" },
  { id: "administrativo", label: "Administrativo" },
  { id: "tributario", label: "Tributário" },
  { id: "transito", label: "Trânsito" },
];

const HIGHLIGHTS: Record<Area, string[]> = {
  civel: [
    "Tutelas Provisórias",
    "Petição Inicial",
    "Contestação",
    "Impugnação à Contestação (Réplica)",
    "Manifestação Processual",
    "Agravo de Instrumento",
    "Alegações Finais",
    "Embargos de Declaração",
    "Apelação",
    "Cumprimento de Sentença",
    "Recurso Especial",
    "Embargos de Terceiro",
  ],
  trabalhista: ["Reclamação Trabalhista", "Contestação Trabalhista", "Recurso Ordinário"],
  penal: ["Resposta à Acusação", "Alegações Finais Criminais", "Habeas Corpus"],
  previdenciario: ["Ação de Aposentadoria", "Revisão de Benefício"],
  familia: ["Divórcio Consensual", "Ação de Alimentos", "Inventário"],
  administrativo: ["Mandado de Segurança", "Ação Popular"],
  tributario: ["Embargos à Execução Fiscal", "Mandado de Segurança Tributário"],
  transito: ["Defesa Prévia de Trânsito", "Recurso à JARI"],
};

const ALL_PIECES: Record<Area, string[]> = {
  civel: [
    "Ação Cautelar de Sustação de Protesto",
    "Ação de Busca e Apreensão de Menor com Tutela de Urgência",
    "Ação Monitória",
    "Ação Rescisória",
    "Acordo de Alimentos, Guarda e Visitas",
    "Acordo de Divórcio, Partilha, Alimentos, Guarda e Visitas",
    "Acordo Judicial e Pedido de Extinção do Processo",
    "Agravo em Recurso Especial",
    "Agravo Interno",
    "Contraminuta ao Agravo de Instrumento",
    "Contraminuta ao Agravo em Recurso Especial",
    "Contraminuta ao Agravo Interno",
    "Contrarrazões ao Recurso Especial",
    "Contrarrazões ao Recurso Extraordinário",
    "Contrarrazões ao Recurso Inominado",
    "Contrarrazões aos Embargos de Declaração",
    "Contrarrazões de Apelação",
    "Embargos à Ação Monitória",
    "Embargos à Execução",
    "Embargos à Execução Fiscal",
    "Embargos de Divergência",
    "Emenda à Inicial",
    "Exceção de Pré-executividade",
    "Impugnação ao Cumprimento de Sentença",
    "Impugnação ao Laudo Pericial",
    "Impugnação aos Embargos à Execução",
    "Impugnação aos Embargos à Monitória",
    "Impugnação aos Embargos de Divergência",
    "Impugnação aos Embargos de Terceiro",
    "Impugnação à Penhora",
    "Impugnação à Sentença de Homologação dos Cálculos",
    "Inicial de Ação de Adjudicação Compulsória",
    "Inicial de Ação de Execução de Título Extrajudicial",
    "Inventário Judicial",
    "Liquidação Extrajudicial de Bancos: Habilitação de Crédito Administrativa",
    "Liquidação Extrajudicial de Bancos: Habilitação de Crédito Retardatária",
    "Liquidação Extrajudicial de Bancos: Impugnação de Crédito em Liquidação Extrajudicial",
    "Mandado de Segurança",
    "Manifestação à Impugnação ao Cumprimento de Sentença",
    "Manifestação à Impugnação aos Embargos à Execução",
    "Manifestação para Apresentação de Quesitos Periciais",
    "Manifestação para Juntada de Documentos",
    "Manifestação para Produção de Provas",
    "Memoriais Recursais",
    "Memoriais Recursais para Ministro do STJ",
    "Pedido de Cumprimento Provisório de Sentença",
    "Pedido de Desconsideração da Personalidade Jurídica",
    "Pedido de Expedição de Requisição de Pequeno Valor (RPV)",
    "Pedido de Levantamento de Valores",
    "Pedido de Penhora de Faturamento",
    "Pedido de Penhora no Rosto dos Autos",
    "Pedido de Recuperação Judicial",
    "Petição Inicial JEC",
    "Recurso Extraordinário",
    "Recurso Inominado",
    "Recurso Ordinário Constitucional",
    "Tutela Provisória Antecipada Antecedente",
    "Tutela Provisória Antecipada Incidental",
    "Tutela Provisória Cautelar Antecedente",
    "Tutela Provisória Cautelar Incidental",
    "Tutela Provisória da Evidência",
  ],
  trabalhista: [],
  penal: [],
  previdenciario: [],
  familia: [],
  administrativo: [],
  tributario: [],
  transito: [],
};

function PieceCard({ label, onClick, featured }: { label: string; onClick: () => void; featured?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group text-left rounded-lg border border-border p-3 surface-interactive hover:border-accent/60 hover:shadow-[var(--shadow-focus)] hover:-translate-y-0.5 transition-all bg-card/60",
        featured && "bg-gradient-to-br from-accent/5 to-transparent"
      )}
    >
      <div className="flex items-start gap-2">
        {featured && <Sparkles className="size-3.5 text-accent shrink-0 mt-0.5" />}
        <span className="text-sm font-medium leading-snug group-hover:text-accent transition-colors">
          {label}
        </span>
      </div>
    </button>
  );
}

interface CreatePieceDialogProps {
  trigger?: React.ReactNode;
}

export function CreatePieceDialog({ trigger }: CreatePieceDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("pecas");
  const [area, setArea] = useState<Area>("civel");
  const [query, setQuery] = useState("");
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const highlights = HIGHLIGHTS[area] || [];
  const all = ALL_PIECES[area] || [];

  const filteredHighlights = useMemo(
    () => highlights.filter((h) => h.toLowerCase().includes(query.toLowerCase())),
    [highlights, query]
  );
  const filteredAll = useMemo(
    () => all.filter((h) => h.toLowerCase().includes(query.toLowerCase())),
    [all, query]
  );

  const handlePieceClick = (piece: string) => {
    setSelectedPiece(piece);
    setOpen(false);
    setTimeout(() => setFormOpen(true), 50);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" className="gap-2">
              <FilePlus2 className="size-4" />
              Criar Peça
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[88vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Criar uma peça jurídica
            </DialogTitle>
          </DialogHeader>

          {/* Top tabs */}
          <Tabs value={category} onValueChange={(v) => setCategory(v as Category)} className="px-6 pt-3">
            <TabsList className="bg-muted/50">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="text-xs sm:text-sm">
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Area chips */}
          <div className="px-6 pt-3 pb-2 flex flex-wrap gap-1.5">
            {AREAS.map((a) => (
              <button
                key={a.id}
                onClick={() => setArea(a.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border surface-interactive",
                  area === a.id
                    ? "bg-accent text-accent-foreground border-accent shadow-glow"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-accent/40"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-6 py-2">
            <div className="flex items-center bg-background/60 border border-border rounded-lg px-3 py-2 focus-within:border-accent/60">
              <Search className="size-4 text-muted-foreground mr-2 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar funcionalidade..."
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-6 pb-6">
            {category === "pecas" ? (
              <div className="space-y-6">
                {filteredHighlights.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-3">
                      Destaques da área
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {filteredHighlights.map((p) => (
                        <PieceCard key={p} label={p} onClick={() => handlePieceClick(p)} featured />
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-3">
                    Total de funcionalidades da área
                    <span className="ml-2 text-muted-foreground/70 normal-case tracking-normal">
                      ({filteredAll.length})
                    </span>
                  </h3>
                  {filteredAll.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Nenhuma peça encontrada para esta área.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {filteredAll.map((p) => (
                        <PieceCard key={p} label={p} onClick={() => handlePieceClick(p)} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Em breve — modelos de {CATEGORIES.find((c) => c.id === category)?.label.toLowerCase()}.
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <GenerateDocumentDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initialDocType={selectedPiece || undefined}
        initialTitle={selectedPiece || undefined}
        hideTrigger
      />
    </>
  );
}
