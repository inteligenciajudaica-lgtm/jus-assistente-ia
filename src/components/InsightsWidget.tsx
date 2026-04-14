export function InsightsWidget() {
  return (
    <div className="bg-card border border-border p-5 rounded-sm">
      <h3 className="font-medium text-sm mb-4">Inteligência Jurisprudencial</h3>
      <div className="p-4 bg-foreground text-background rounded-sm font-mono text-[11px] leading-relaxed space-y-1">
        <p className="font-semibold text-xs mb-2">Análise Preditiva [Processo 5003421]</p>
        <p>&gt; Probabilidade de êxito: 74.2%</p>
        <p>&gt; Tese principal: Prescrição Intercorrente</p>
        <p>&gt; 12 precedentes idênticos no TJSP</p>
        <p>&gt; Tempo estimado: 184 dias</p>
      </div>
    </div>
  );
}
