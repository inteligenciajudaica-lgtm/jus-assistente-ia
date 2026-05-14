import { describe, it, expect } from "vitest";
import { Schema, DOMParser } from "@tiptap/pm/model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { JSDOM } from "jsdom";
import { buildSuggestions, dismissKey, REVISION_PATTERNS } from "./revisionEngine";

// Reuse a minimal schema with paragraph + text from prosemirror-schema-basic
const schema = new Schema({
  nodes: basicSchema.spec.nodes,
  marks: basicSchema.spec.marks,
});

function makeDoc(html: string) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  return DOMParser.fromSchema(schema).parse(dom.window.document.body);
}

describe("revisionEngine — anti-loop e estabilidade dos highlights", () => {
  it("não duplica highlights quando o mesmo texto contém múltiplas ocorrências", () => {
    const doc = makeDoc(
      "<p>Destarte, destarte e novamente destarte deveriam virar 'desse modo'.</p>"
    );
    const { suggestions, decos } = buildSuggestions(doc, new Set());
    expect(suggestions).toHaveLength(3);
    // ids únicos
    const ids = new Set(suggestions.map((s) => s.id));
    expect(ids.size).toBe(3);
    // ranges não se sobrepõem
    const sorted = [...suggestions].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].from).toBeGreaterThanOrEqual(sorted[i - 1].to);
    }
    expect(decos.find().length).toBe(3);
  });

  it("é idempotente: rodar várias vezes mantém a mesma contagem de revisões", () => {
    const doc = makeDoc(
      "<p>M.M. Juiz, data vênia, supra citado in casu destarte outrossim por derradeiro.</p>"
    );
    const r1 = buildSuggestions(doc, new Set());
    const r2 = buildSuggestions(doc, new Set());
    const r3 = buildSuggestions(doc, new Set());
    expect(r1.suggestions.length).toBe(REVISION_PATTERNS.length);
    expect(r2.suggestions.length).toBe(r1.suggestions.length);
    expect(r3.suggestions.length).toBe(r1.suggestions.length);
    expect(r2.suggestions.map((s) => s.id)).toEqual(r1.suggestions.map((s) => s.id));
  });

  it("respeita dismissed: sugestões descartadas não reaparecem em re-execuções", () => {
    const doc = makeDoc("<p>destarte e outrossim convivem aqui.</p>");
    const { suggestions } = buildSuggestions(doc, new Set());
    expect(suggestions).toHaveLength(2);

    const dismissed = new Set<string>();
    const target = suggestions.find((s) => s.text.toLowerCase() === "destarte")!;
    dismissed.add(dismissKey(target.reason, target.text));

    const r2 = buildSuggestions(doc, dismissed);
    expect(r2.suggestions).toHaveLength(1);
    expect(r2.suggestions[0].text.toLowerCase()).toBe("outrossim");

    // segunda passada com mesmo dismissed permanece estável
    const r3 = buildSuggestions(doc, dismissed);
    expect(r3.suggestions.map((s) => s.id)).toEqual(r2.suggestions.map((s) => s.id));
  });

  it("dismissKey é estável independente de caixa e espaços (evita loop de re-emissão)", () => {
    const k1 = dismissKey("motivo X", "Destarte");
    const k2 = dismissKey("motivo X", "  destarte  ");
    const k3 = dismissKey("motivo X", "DESTARTE");
    expect(k1).toBe(k2);
    expect(k2).toBe(k3);
  });

  it("texto sem padrões não gera highlights nem decorações fantasma", () => {
    const doc = makeDoc("<p>Petição inicial limpa, sem arcaísmos.</p>");
    const { suggestions, decos } = buildSuggestions(doc, new Set());
    expect(suggestions).toHaveLength(0);
    expect(decos.find().length).toBe(0);
  });

  it("aplicar a substituição do replacement não recria a sugestão (sem ciclo aceita→reaparece)", () => {
    // Antes: "destarte" gera 1 sugestão. Depois de substituir por "desse modo", não há mais match.
    const before = makeDoc("<p>destarte é arcaico.</p>");
    const after = makeDoc("<p>desse modo é arcaico.</p>");
    const r1 = buildSuggestions(before, new Set());
    const r2 = buildSuggestions(after, new Set());
    expect(r1.suggestions).toHaveLength(1);
    expect(r2.suggestions).toHaveLength(0);
  });
});
