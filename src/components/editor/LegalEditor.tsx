import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useEditor, EditorContent, Editor, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { supabase } from "@/integrations/supabase/client";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, Check, Loader2, AlertCircle, Sparkles,
  X, ChevronRight, ChevronLeft, ListChecks, History, RotateCcw, Save, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface DocumentVersion {
  id: string;
  content: string;
  label: string | null;
  created_at: string;
}

interface LegalEditorProps {
  documentId: string;
  initialContent: string;
  title: string;
  documentType: string;
}

interface Suggestion {
  id: string;
  from: number;
  to: number;
  text: string;
  reason: string;
  replacement?: string;
}

// Termos jurídicos comumente mal-escritos / arcaísmos a destacar
// `replacement` opcional permite "Aceitar" com 1 clique.
const REVISION_PATTERNS: { regex: RegExp; reason: string; replacement?: string }[] = [
  { regex: /\bm\.m\.?\s*juiz\b/gi, reason: "Prefira 'Meritíssimo Juiz' por extenso", replacement: "Meritíssimo Juiz" },
  { regex: /\bdata\s+vênia\b/gi, reason: "Forma latina sem acento: 'data venia'", replacement: "data venia" },
  { regex: /\bsupra\s*citado\b/gi, reason: "Forma correta: 'supracitado' (junto)", replacement: "supracitado" },
  { regex: /\bin\s+casu\b/gi, reason: "Latinismo — considere 'no caso em tela'", replacement: "no caso em tela" },
  { regex: /\bdestarte\b/gi, reason: "Arcaísmo — prefira 'desse modo'", replacement: "desse modo" },
  { regex: /\boutrossim\b/gi, reason: "Arcaísmo — prefira 'além disso'", replacement: "além disso" },
  { regex: /\bpor\s+derradeiro\b/gi, reason: "Arcaísmo — prefira 'por fim'", replacement: "por fim" },
];

const revisionPluginKey = new PluginKey<RevisionState>("legal-revision");

interface RevisionState {
  decos: DecorationSet;
  suggestions: Suggestion[];
  dismissed: Set<string>; // chave estável: `${reason}|${textoNormalizado}`
}

function dismissKey(reason: string, text: string) {
  return `${reason}|${text.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function buildSuggestions(doc: any, dismissed: Set<string>): { decos: DecorationSet; suggestions: Suggestion[] } {
  const decorations: Decoration[] = [];
  const suggestions: Suggestion[] = [];
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

const createRevisionExtension = (onChange: (s: Suggestion[]) => void) =>
  Extension.create({
    name: "revisionHighlight",
    addProseMirrorPlugins() {
      return [
        new Plugin<RevisionState>({
          key: revisionPluginKey,
          state: {
            init(_, { doc }) {
              const dismissed = new Set<string>();
              const { decos, suggestions } = buildSuggestions(doc, dismissed);
              queueMicrotask(() => onChange(suggestions));
              return { decos, suggestions, dismissed };
            },
            apply(tr, old) {
              const meta = tr.getMeta(revisionPluginKey) as { dismiss?: string; reset?: boolean } | undefined;
              const dismissed = new Set(old.dismissed);
              if (meta?.reset) dismissed.clear();
              if (meta?.dismiss) dismissed.add(meta.dismiss);
              if (!tr.docChanged && !meta) return old;
              const { decos, suggestions } = buildSuggestions(tr.doc, dismissed);
              queueMicrotask(() => onChange(suggestions));
              return { decos, suggestions, dismissed };
            },
          },
          props: {
            decorations(state) {
              return this.getState(state)?.decos;
            },
          },
        }),
      ];
    },
  });

export function LegalEditor({ documentId, initialContent, title, documentType }: LegalEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [wordCount, setWordCount] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<DocumentVersion | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>(initialContent);
  const lastSnapshotRef = useRef<string>(initialContent);

  const initialHTML = initialContent.includes("<p>") || initialContent.includes("<h")
    ? initialContent
    : initialContent
        .split(/\n\n+/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: "Comece a escrever sua peça jurídica..." }),
      createRevisionExtension(setSuggestions),
    ],
    content: initialHTML,
    editorProps: {
      attributes: { class: "legal-editor-content focus:outline-none" },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
      scheduleAutosave(editor);
      scheduleSnapshot(editor);
    },
  });

  const createSnapshot = useCallback(async (html: string, label?: string) => {
    if (!user) return;
    if (html === lastSnapshotRef.current) return;
    const { error } = await supabase.from("document_versions").insert({
      document_id: documentId,
      user_id: user.id,
      content: html,
      label: label ?? null,
    });
    if (!error) lastSnapshotRef.current = html;
  }, [documentId, user]);

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
      if (error) setSaveStatus("error");
      else { lastSavedRef.current = html; setSaveStatus("saved"); }
    }, 2000);
  }, [documentId]);

  // Snapshot automático após ~30s de inatividade (apenas se houve mudança real)
  const scheduleSnapshot = useCallback((ed: Editor) => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      createSnapshot(ed.getHTML());
    }, 30000);
  }, [createSnapshot]);

  const loadVersions = useCallback(async () => {
    setVersionsLoading(true);
    const { data, error } = await supabase
      .from("document_versions")
      .select("id, content, label, created_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setVersions(data as DocumentVersion[]);
    setVersionsLoading(false);
  }, [documentId]);

  useEffect(() => {
    if (historyOpen) loadVersions();
  }, [historyOpen, loadVersions]);

  const saveManualSnapshot = useCallback(async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const label = `Versão manual — ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;
    lastSnapshotRef.current = "__force__";
    await createSnapshot(html, label);
    toast({ title: "Versão salva", description: label });
    if (historyOpen) loadVersions();
  }, [editor, createSnapshot, toast, historyOpen, loadVersions]);

  const restoreVersion = useCallback(async (v: DocumentVersion) => {
    if (!editor) return;
    const current = editor.getHTML();
    lastSnapshotRef.current = "__force__";
    await createSnapshot(current, `Antes de restaurar — ${new Date().toLocaleString("pt-BR")}`);
    editor.commands.setContent(v.content, { emitUpdate: true });
    setHistoryOpen(false);
    setRestoreCandidate(null);
    toast({ title: "Versão restaurada", description: new Date(v.created_at).toLocaleString("pt-BR") });
  }, [editor, createSnapshot, toast]);

  const deleteVersion = useCallback(async (v: DocumentVersion) => {
    const { error } = await supabase.from("document_versions").delete().eq("id", v.id);
    if (!error) {
      setVersions((prev) => prev.filter((x) => x.id !== v.id));
      toast({ title: "Versão removida" });
    }
  }, [toast]);

  useEffect(() => {
    if (!editor) return;
    const text = editor.getText();
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  }, [editor]);

  // Snapshot inicial se for o primeiro acesso ao documento
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { count } = await supabase
        .from("document_versions")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId);
      if ((count ?? 0) === 0 && initialContent) {
        await createSnapshot(initialHTML, "Versão inicial");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, documentId]);

  const acceptSuggestion = useCallback((s: Suggestion) => {
    if (!editor || !s.replacement) return;
    const replacement = /^[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]/.test(s.text)
      ? s.replacement.charAt(0).toUpperCase() + s.replacement.slice(1)
      : s.replacement;
    editor.chain().focus().insertContentAt({ from: s.from, to: s.to }, replacement).run();
  }, [editor]);

  const rejectSuggestion = useCallback((s: Suggestion) => {
    if (!editor) return;
    const tr = editor.state.tr.setMeta(revisionPluginKey, { dismiss: dismissKey(s.reason, s.text) });
    editor.view.dispatch(tr);
  }, [editor]);

  const acceptAll = useCallback(() => {
    if (!editor) return;
    // Aplicar de trás pra frente para preservar offsets
    const ordered = [...suggestions].filter((s) => s.replacement).sort((a, b) => b.from - a.from);
    let chain = editor.chain().focus();
    ordered.forEach((s) => {
      const replacement = /^[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]/.test(s.text)
        ? s.replacement!.charAt(0).toUpperCase() + s.replacement!.slice(1)
        : s.replacement!;
      chain = chain.insertContentAt({ from: s.from, to: s.to }, replacement);
    });
    chain.run();
  }, [editor, suggestions]);

  const rejectAll = useCallback(() => {
    if (!editor) return;
    let tr = editor.state.tr;
    suggestions.forEach((s) => {
      tr = tr.setMeta(revisionPluginKey, { dismiss: dismissKey(s.reason, s.text) });
      editor.view.dispatch(tr);
      tr = editor.state.tr;
    });
  }, [editor, suggestions]);

  const focusSuggestion = useCallback((s: Suggestion) => {
    if (!editor) return;
    setActiveId(s.id);
    editor.commands.focus();
    editor.commands.setTextSelection({ from: s.from, to: s.to });
    // scroll into view
    const { node } = editor.view.domAtPos(s.from);
    (node as HTMLElement)?.parentElement?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [editor]);

  const acceptableCount = useMemo(() => suggestions.filter((s) => s.replacement).length, [suggestions]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex min-h-0 bg-muted/40 relative">
      {/* Coluna principal */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Toolbar flutuante */}
        <div className="sticky top-0 z-20 flex justify-center pt-4 px-4 pointer-events-none">
          <div className="surface-glass pointer-events-auto rounded-xl shadow-lg border border-border/60 backdrop-blur-xl bg-card/80 px-2 py-1.5 flex items-center gap-0.5 flex-wrap max-w-full">
            <ToolbarGroup>
              <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer"><Undo2 className="size-3.5" /></ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer"><Redo2 className="size-3.5" /></ToolBtn>
            </ToolbarGroup>
            <ToolbarGroup>
              <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1"><Heading1 className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2"><Heading2 className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3"><Heading3 className="size-3.5" /></ToolBtn>
            </ToolbarGroup>
            <ToolbarGroup>
              <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><Bold className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><Italic className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado"><UnderlineIcon className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><Strikethrough className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Destacar"><Sparkles className="size-3.5" /></ToolBtn>
            </ToolbarGroup>
            <ToolbarGroup>
              <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Esquerda"><AlignLeft className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centro"><AlignCenter className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Direita"><AlignRight className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justificar"><AlignJustify className="size-3.5" /></ToolBtn>
            </ToolbarGroup>
            <ToolbarGroup>
              <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><List className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered className="size-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote className="size-3.5" /></ToolBtn>
            </ToolbarGroup>
            <ToolbarGroup last>
              <ToolBtn
                active={panelOpen}
                onClick={() => setPanelOpen((o) => !o)}
                title="Painel de revisão"
              >
                <ListChecks className="size-3.5" />
              </ToolBtn>
            </ToolbarGroup>
          </div>
        </div>

        {/* Folha A4 */}
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-[820px] mx-auto">
            <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <div className="flex items-center gap-2">
                <span className="font-mono uppercase tracking-wider">{documentType}</span>
                <span>·</span>
                <span className="font-medium text-foreground/80 truncate max-w-[300px]">{title}</span>
              </div>
              <SaveIndicator status={saveStatus} />
            </div>

            <div className="bg-card border border-border rounded-md shadow-xl shadow-black/5 dark:shadow-black/30 min-h-[1000px] px-[80px] py-[72px] legal-paper">
              <EditorContent editor={editor} />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <div className="flex items-center gap-3">
                <span>{wordCount} palavras</span>
                {suggestions.length > 0 && (
                  <button
                    onClick={() => setPanelOpen(true)}
                    className="flex items-center gap-1 text-warning hover:underline"
                  >
                    <AlertCircle className="size-3" />
                    {suggestions.length} {suggestions.length === 1 ? "sugestão" : "sugestões"} de revisão
                  </button>
                )}
              </div>
              <span className="font-mono">A4 · 210 × 297 mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Botão flutuante para reabrir painel */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute right-4 top-20 z-10 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border shadow-md hover:shadow-lg text-xs font-medium transition-all"
        >
          <ChevronLeft className="size-3.5" />
          Revisão
          {suggestions.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-semibold">
              {suggestions.length}
            </span>
          )}
        </button>
      )}

      {/* Painel lateral de revisão */}
      {panelOpen && (
        <aside className="w-[320px] shrink-0 border-l border-border bg-card flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <ListChecks className="size-4 text-accent" />
                Revisão jurídica
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {suggestions.length === 0
                  ? "Nenhuma sugestão pendente"
                  : `${suggestions.length} ${suggestions.length === 1 ? "sugestão" : "sugestões"}`}
              </p>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="size-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
              title="Recolher painel"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="px-4 py-2 border-b border-border flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs"
                onClick={acceptAll}
                disabled={acceptableCount === 0}
              >
                <Check className="size-3" />
                Aceitar todas {acceptableCount > 0 && `(${acceptableCount})`}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-8 text-xs"
                onClick={rejectAll}
              >
                <X className="size-3" />
                Ignorar todas
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {suggestions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="size-12 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-3">
                  <Check className="size-5 text-success" />
                </div>
                <p className="text-sm font-medium">Tudo certo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum problema detectado no texto.
                </p>
              </div>
            ) : (
              suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  active={activeId === s.id}
                  onFocus={() => focusSuggestion(s)}
                  onAccept={() => acceptSuggestion(s)}
                  onReject={() => rejectSuggestion(s)}
                />
              ))
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion, active, onFocus, onAccept, onReject,
}: {
  suggestion: Suggestion;
  active: boolean;
  onFocus: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      className={cn(
        "group rounded-lg border bg-background p-3 cursor-pointer transition-all",
        active
          ? "border-accent shadow-sm ring-1 ring-accent/30"
          : "border-border hover:border-accent/50 hover:shadow-sm"
      )}
      onClick={onFocus}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="size-3.5 text-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug">
            {suggestion.reason}
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline gap-1.5 text-[11px]">
              <span className="text-muted-foreground/70 shrink-0">Atual:</span>
              <span className="font-mono text-destructive line-through truncate">
                {suggestion.text}
              </span>
            </div>
            {suggestion.replacement && (
              <div className="flex items-baseline gap-1.5 text-[11px]">
                <span className="text-muted-foreground/70 shrink-0">Sugestão:</span>
                <span className="font-mono text-success truncate">
                  {suggestion.replacement}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        {suggestion.replacement && (
          <Button
            size="sm"
            variant="default"
            className="flex-1 h-7 text-xs"
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
          >
            <Check className="size-3" />
            Aceitar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className={cn("h-7 text-xs", suggestion.replacement ? "" : "flex-1")}
          onClick={(e) => { e.stopPropagation(); onReject(); }}
        >
          <X className="size-3" />
          Ignorar
        </Button>
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
      <Loader2 className="size-3 animate-spin" /> Salvando...
    </span>
  );
  if (status === "saved") return (
    <span className="flex items-center gap-1.5 text-success">
      <Check className="size-3" /> Salvo automaticamente
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-destructive">
      <AlertCircle className="size-3" /> Erro ao salvar
    </span>
  );
}
