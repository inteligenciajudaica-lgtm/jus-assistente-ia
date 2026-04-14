const cases = [
  {
    number: "5003421-88.2023.8.21.0001",
    client: "Construtora Vale do Sol S/A",
    court: "TJSP - 4ª Vara Cível",
    status: "Petição Protocolada",
    statusColor: "bg-info",
    updated: "14:22 — Hoje",
  },
  {
    number: "0800122-45.2024.4.03.6100",
    client: "Marina Albuquerque",
    court: "TRF3 - 1ª Vara Federal",
    status: "Aguardando Despacho",
    statusColor: "bg-warning",
    updated: "09:45 — Ontem",
  },
  {
    number: "1002994-33.2022.8.26.0100",
    client: "TechLog Soluções Digitais",
    court: "TJSP - Foro Central",
    status: "Acordo Homologado",
    statusColor: "bg-success",
    updated: "18:12 — 14 Out",
  },
  {
    number: "5011244-90.2023.8.21.0012",
    client: "Eduardo Silveira Santos",
    court: "TJRJ - 2ª Vara Família",
    status: "Audiência Designada",
    statusColor: "bg-muted-foreground/40",
    updated: "11:30 — 12 Out",
  },
];

export function CasesTable() {
  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground font-medium">
          <tr>
            <th className="font-medium px-4 py-3">Nº Processo</th>
            <th className="font-medium px-4 py-3">Cliente</th>
            <th className="font-medium px-4 py-3">Tribunal</th>
            <th className="font-medium px-4 py-3">Status</th>
            <th className="font-medium px-4 py-3 text-right">Última Atualização</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cases.map((c) => (
            <tr key={c.number} className="hover:bg-muted/50 transition-colors cursor-pointer">
              <td className="px-4 py-3 font-mono text-xs font-medium">{c.number}</td>
              <td className="px-4 py-3">{c.client}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.court}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <div className={`size-1.5 rounded-full ${c.statusColor}`} />
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{c.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
