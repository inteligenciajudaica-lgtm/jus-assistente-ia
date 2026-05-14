import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Header, Footer, PageNumber, LevelFormat, PageOrientation,
} from "docx";
import { saveAs } from "file-saver";

export interface DocxExportOptions {
  title: string;
  html: string;
  headerText?: string;
  footerText?: string;
  includePageNumber?: boolean;
}

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlight?: "yellow" | "green" | "cyan" | "magenta" | "red" | "blue";
}

function alignmentFromStyle(style?: string | null): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (!style) return undefined;
  const m = /text-align:\s*(left|center|right|justify)/i.exec(style);
  if (!m) return undefined;
  switch (m[1].toLowerCase()) {
    case "center": return AlignmentType.CENTER;
    case "right": return AlignmentType.RIGHT;
    case "justify": return AlignmentType.JUSTIFIED;
    default: return AlignmentType.LEFT;
  }
}

function collectRuns(node: Node, inherited: RunStyle): TextRun[] {
  const runs: TextRun[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (!text) return;
      runs.push(new TextRun({
        text,
        bold: inherited.bold,
        italics: inherited.italics,
        underline: inherited.underline ? {} : undefined,
        strike: inherited.strike,
        highlight: inherited.highlight,
        font: "Times New Roman",
        size: 24, // 12pt
      }));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const next: RunStyle = { ...inherited };
    if (tag === "strong" || tag === "b") next.bold = true;
    if (tag === "em" || tag === "i") next.italics = true;
    if (tag === "u") next.underline = true;
    if (tag === "s" || tag === "strike" || tag === "del") next.strike = true;
    if (tag === "mark") next.highlight = "yellow";
    if (tag === "br") {
      runs.push(new TextRun({ text: "", break: 1 }));
      return;
    }
    runs.push(...collectRuns(el, next));
  });
  return runs;
}

function paragraphFromBlock(
  el: HTMLElement,
  opts: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; numbering?: { reference: string; level: number } } = {}
): Paragraph {
  const align = alignmentFromStyle(el.getAttribute("style"));
  return new Paragraph({
    heading: opts.heading,
    alignment: align,
    numbering: opts.numbering,
    spacing: { after: 160 },
    children: collectRuns(el, {}),
  });
}

function walkBlocks(root: HTMLElement): Paragraph[] {
  const out: Paragraph[] = [];

  const processList = (listEl: HTMLElement, ordered: boolean, level: number) => {
    const ref = ordered ? "ol" : "ul";
    Array.from(listEl.children).forEach((li) => {
      if (li.tagName.toLowerCase() !== "li") return;
      // Tiptap may wrap <li> content in <p>; flatten.
      const paragraphChildren = Array.from(li.children).filter(
        (c) => !["ul", "ol"].includes(c.tagName.toLowerCase())
      );
      const target = paragraphChildren[0] as HTMLElement | undefined;
      const sourceForRuns = target ?? (li as HTMLElement);
      out.push(new Paragraph({
        numbering: { reference: ref, level },
        spacing: { after: 80 },
        children: collectRuns(sourceForRuns, {}),
      }));
      Array.from(li.children).forEach((nested) => {
        const t = nested.tagName.toLowerCase();
        if (t === "ul") processList(nested as HTMLElement, false, level + 1);
        else if (t === "ol") processList(nested as HTMLElement, true, level + 1);
      });
    });
  };

  Array.from(root.children).forEach((node) => {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "h1": out.push(paragraphFromBlock(el, { heading: HeadingLevel.HEADING_1 })); break;
      case "h2": out.push(paragraphFromBlock(el, { heading: HeadingLevel.HEADING_2 })); break;
      case "h3": out.push(paragraphFromBlock(el, { heading: HeadingLevel.HEADING_3 })); break;
      case "p": out.push(paragraphFromBlock(el)); break;
      case "blockquote":
        Array.from(el.children).forEach((child) => {
          out.push(new Paragraph({
            indent: { left: 720 },
            spacing: { after: 160 },
            children: collectRuns(child as HTMLElement, { italics: true }),
          }));
        });
        break;
      case "ul": processList(el, false, 0); break;
      case "ol": processList(el, true, 0); break;
      case "hr":
        out.push(new Paragraph({ border: { bottom: { style: "single", size: 6, color: "CCCCCC", space: 1 } } }));
        break;
      default:
        // Tratar como parágrafo genérico se houver texto
        if (el.textContent?.trim()) out.push(paragraphFromBlock(el));
    }
  });

  return out;
}

function buildHeaderFooter(text: string, withPageNumber = false) {
  const children: (TextRun)[] = [];
  if (text) children.push(new TextRun({ text, font: "Times New Roman", size: 18 }));
  if (withPageNumber) {
    if (text) children.push(new TextRun({ text: "    ", size: 18 }));
    children.push(
      new TextRun({ text: "Página ", size: 18, font: "Times New Roman" }),
      new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Times New Roman" }),
      new TextRun({ text: " de ", size: 18, font: "Times New Roman" }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Times New Roman" }),
    );
  }
  return new Paragraph({ alignment: AlignmentType.CENTER, children });
}

export async function exportDocxFromHtml(opts: DocxExportOptions): Promise<void> {
  const { title, html, headerText = "", footerText = "", includePageNumber = true } = opts;

  const container = document.createElement("div");
  container.innerHTML = html;
  const paragraphs = walkBlocks(container);
  if (paragraphs.length === 0) paragraphs.push(new Paragraph({ children: [new TextRun("")] }));

  const headerParagraph = buildHeaderFooter(headerText, false);
  const footerParagraph = buildHeaderFooter(footerText, includePageNumber);

  const doc = new Document({
    creator: "JURIS AI",
    title,
    styles: {
      default: { document: { run: { font: "Times New Roman", size: 24 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, font: "Times New Roman" },
          paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Times New Roman" },
          paragraph: { spacing: { before: 200, after: 140 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, font: "Times New Roman" },
          paragraph: { spacing: { before: 160, after: 120 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: "ul", levels: [0, 1, 2].map((lvl) => ({
          level: lvl, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720 * (lvl + 1), hanging: 360 } } },
        })) },
        { reference: "ol", levels: [0, 1, 2].map((lvl) => ({
          level: lvl, format: LevelFormat.DECIMAL, text: `%${lvl + 1}.`,
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720 * (lvl + 1), hanging: 360 } } },
        })) },
      ],
    },
    sections: [{
      properties: {
        page: {
          // A4: 11906 x 16838 DXA
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: { default: new Header({ children: [headerParagraph] }) },
      footers: { default: new Footer({ children: [footerParagraph] }) },
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = title.replace(/[^\w\-À-ÿ ]+/g, "").trim() || "documento";
  saveAs(blob, `${safe}.docx`);
}
