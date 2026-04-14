const docs = [
  { title: "Recurso de Apelação", client: "Vale do Sol S/A", progress: 82 },
  { title: "Contrato de Prestação", client: "Rascunho Inicial", progress: 25 },
  { title: "Procuração Ad Judicia", client: "Marina Albuquerque", progress: 100 },
];

export function DocumentsWidget() {
  return (
    <div className="bg-card border border-border p-5 rounded-sm">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-medium text-sm">Documentos em Produção</h3>
      </div>
      <div className="space-y-3">
        {docs.map((doc) => (
          <div
            key={doc.title}
            className="flex items-center justify-between p-3 border border-border bg-muted/30 rounded-sm hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <div>
              <p className="text-sm font-medium">{doc.title}</p>
              <p className="text-xs text-muted-foreground">{doc.client}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono">{doc.progress}%</p>
              <div className="w-20 h-1 bg-border mt-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${doc.progress}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
