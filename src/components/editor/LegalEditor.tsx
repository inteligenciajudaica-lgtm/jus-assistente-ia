import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { supabase } from "@/integrations/supabase/client";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, Check, Loader2, AlertCircle, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface LegalEditorProps {
  documentId: string;
  initialContent: string;
  title: string;
  documentType: string;
}

// Termos jurídicos comumente mal-escritos / arcaísmos a destacar
const REVISION_PATTERNS: { regex: RegExp; reason: string }[] = [
  { regex: /\bm\.m\.?\s*juiz\b/gi, reason: "Prefira 'Meritíssimo Juiz' por extenso" },
  { regex: /\bdata\s+vênia\b/gi, reason: "Verificar uso: 'data venia' (sem acento, latim)" },
  { regex: /\bsupra\s*citado\b/gi, reason: "Forma correta: 'supracitado' (junto)" },
  { regex: /\bin\s+casu\b/gi, reason: "Latinismo — considere 'no caso em tela'" },
  { regex: /\bdestarte\b/gi, reason: "Arcaísmo — prefira 'desse modo' ou 'assim'" },
  { regex: /\boutrossim\b/gi, reason: "Arcaísmo — prefira 'além disso' ou 'também'" },
  { regex: /\bpor\s+derradeiro\b/gi, reason: "Arcaísmo — prefira 'por fim'" },
];


export function LegalEditor({ documentId, initialContent, title, documentType }: LegalEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [wordCount, setWordCount] = useState(0);
  const [revisionCount, setRevisionCount] = useState(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>(initialContent);

  // Converte texto plano (legado) para HTML com parágrafos
  const initialHTML = initialContent.includes("<p>") || initialContent.includes("<h")
    ? initialContent
    : initialContent
        .split(/\n\n+/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder: "Comece a escrever sua peça jurídica...",
      }),
    ],
    content: initialHTML,
    editorProps: {
      attributes: {
        class: "legal-editor-content focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length);

      // Conta revisões visuais
      let count = 0;
      REVISION_PATTERNS.forEach(({ regex }) => {
        const matches = text.match(regex);
        if (matches) count += matches.length;
      });
      setRevisionCount(count);

      scheduleAutosave(editor);
    },
  });

  const scheduleAutosave = useCallback((ed: Editor) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      const html = ed.getHTML();
      if (html === lastSavedRef.current) {
        setSaveStatus("saved");
        return;
      }
      const { error } = await supabase
        .from("generated_documents")
        .update({ content: html })
        .eq("id", documentId);
      if (error) {
        setSaveStatus("error");
      } else {
        lastSavedRef.current = html;
        setSaveStatus("saved");
      }
    }, 2000);
  }, [documentId]);

  // Aplica destaque visual de revisão (overlay no DOM, sem alterar estado do TipTap)
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;

    const applyHighlights = () => {
      dom.querySelectorAll("span.legal-revision").forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ""), el);
          parent.normalize();
        }
      });

      let count = 0;
      const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (parent?.closest(".legal-revision")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      const textNodes: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) textNodes.push(n as Text);

      textNodes.forEach((textNode) => {
        const text = textNode.textContent || "";
        const matches: { start: number; end: number; reason: string }[] = [];
        REVISION_PATTERNS.forEach(({ regex, reason }) => {
          const re = new RegExp(regex.source, regex.flags);
          let m;
          while ((m = re.exec(text)) !== null) {
            matches.push({ start: m.index, end: m.index + m[0].length, reason });
          }
        });
        if (!matches.length) return;
        matches.sort((a, b) => a.start - b.start);

        const frag = document.createDocumentFragment();
        let cursor = 0;
        matches.forEach((match) => {
          if (match.start < cursor) return;
          if (match.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, match.start)));
          const span = document.createElement("span");
          span.className = "legal-revision";
          span.setAttribute("data-reason", match.reason);
          span.setAttribute("contenteditable", "false");
          span.textContent = text.slice(match.start, match.end);
          frag.appendChild(span);
          cursor = match.end;
          count++;
        });
        if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
        textNode.parentNode?.replaceChild(frag, textNode);
      });

      setRevisionCount(count);
    };

    let timer: NodeJS.Timeout;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(applyHighlights, 600);
    };

    editor.on("update", debounced);
    applyHighlights();

    const text = editor.getText();
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);

    return () => {
      clearTimeout(timer);
      editor.off("update", debounced);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-muted/40 relative">
      {/* Toolbar flutuante glassmorphism */}
      <div className="sticky top-0 z-20 flex justify-center pt-4 px-4 pointer-events-none">
        <div className="surface-glass pointer-events-auto rounded-xl shadow-lg border border-border/60 backdrop-blur-xl bg-card/80 px-2 py-1.5 flex items-center gap-0.5 flex-wrap max-w-full">
          <ToolbarGroup>
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer">
              <Undo2 className="size-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer">
              <Redo2 className="size-3.5" />
            </ToolBtn>
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1">
              <Heading1 className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2">
              <Heading2 className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3">
              <Heading3 className="size-3.5" />
            </ToolBtn>
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
              <Bold className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
              <Italic className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)">
              <UnderlineIcon className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
              <Strikethrough className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Destacar">
              <Sparkles className="size-3.5" />
            </ToolBtn>
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Esquerda">
              <AlignLeft className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centro">
              <AlignCenter className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Direita">
              <AlignRight className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justificar">
              <AlignJustify className="size-3.5" />
            </ToolBtn>
          </ToolbarGroup>

          <ToolbarGroup last>
            <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
              <List className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
              <ListOrdered className="size-3.5" />
            </ToolBtn>
            <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">
              <Quote className="size-3.5" />
            </ToolBtn>
          </ToolbarGroup>
        </div>
      </div>

      {/* Folha A4 centralizada */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-[820px] mx-auto">
          {/* Cabeçalho do documento */}
          <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <div className="flex items-center gap-2">
              <span className="font-mono uppercase tracking-wider">{documentType}</span>
              <span>·</span>
              <span className="font-medium text-foreground/80 truncate max-w-[300px]">{title}</span>
            </div>
            <SaveIndicator status={saveStatus} />
          </div>

          {/* Página */}
          <div className="bg-card border border-border rounded-md shadow-xl shadow-black/5 dark:shadow-black/30 min-h-[1000px] px-[80px] py-[72px] legal-paper">
            <EditorContent editor={editor} />
          </div>

          {/* Rodapé info */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <div className="flex items-center gap-3">
              <span>{wordCount} palavras</span>
              {revisionCount > 0 && (
                <span className="flex items-center gap-1 text-warning">
                  <AlertCircle className="size-3" />
                  {revisionCount} {revisionCount === 1 ? "sugestão" : "sugestões"} de revisão
                </span>
              )}
            </div>
            <span className="font-mono">A4 · 210 × 297 mm</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarGroup({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex items-center gap-0.5 px-1", !last && "border-r border-border/60")}>
      {children}
    </div>
  );
}

function ToolBtn({
  children, onClick, active, disabled, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "size-7 rounded-md flex items-center justify-center transition-all",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:opacity-30 disabled:pointer-events-none",
        active && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
      )}
    >
      {children}
    </button>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return <span className="text-muted-foreground/60">Pronto</span>;
  if (status === "saving") return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      Salvando...
    </span>
  );
  if (status === "saved") return (
    <span className="flex items-center gap-1.5 text-success">
      <Check className="size-3" />
      Salvo automaticamente
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-destructive">
      <AlertCircle className="size-3" />
      Erro ao salvar
    </span>
  );
}
