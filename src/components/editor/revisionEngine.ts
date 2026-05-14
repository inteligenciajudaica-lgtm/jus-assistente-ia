import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface Suggestion {
  id: string;
  from: number;
  to: number;
  text: string;
  reason: string;
  replacement?: string;
}

export const REVISION_PATTERNS: { regex: RegExp; reason: string; replacement?: string }[] = [
  { regex: /\bm\.m\.?\s*juiz\b/gi, reason: "Prefira 'Meritíssimo Juiz' por extenso", replacement: "Meritíssimo Juiz" },
  { regex: /\bdata\s+vênia\b/gi, reason: "Forma latina sem acento: 'data venia'", replacement: "data venia" },
  { regex: /\bsupra\s*citado\b/gi, reason: "Forma correta: 'supracitado' (junto)", replacement: "supracitado" },
  { regex: /\bin\s+casu\b/gi, reason: "Latinismo — considere 'no caso em tela'", replacement: "no caso em tela" },
  { regex: /\bdestarte\b/gi, reason: "Arcaísmo — prefira 'desse modo'", replacement: "desse modo" },
  { regex: /\boutrossim\b/gi, reason: "Arcaísmo — prefira 'além disso'", replacement: "além disso" },
  { regex: /\bpor\s+derradeiro\b/gi, reason: "Arcaísmo — prefira 'por fim'", replacement: "por fim" },
];

export function dismissKey(reason: string, text: string) {
  return `${reason}|${text.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function buildSuggestions(
  doc: any,
  dismissed: Set<string>
): { decos: DecorationSet; suggestions: Suggestion[] } {
  const decorations: Decoration[] = [];
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text: string = node.text || "";
    REVISION_PATTERNS.forEach(({ regex, reason, replacement }) => {
      const re = new RegExp(regex.source, regex.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const matched = m[0];
        if (dismissed.has(dismissKey(reason, matched))) continue;
        const from = pos + m.index;
        const to = from + matched.length;
        const id = `${from}-${to}-${reason}`;
        if (seen.has(id)) continue;
        seen.add(id);
        suggestions.push({ id, from, to, text: matched, reason, replacement });
        decorations.push(
          Decoration.inline(from, to, {
            class: "legal-revision",
            "data-reason": reason,
            "data-suggestion-id": id,
          })
        );
      }
    });
  });
  return { decos: DecorationSet.create(doc, decorations), suggestions };
}
