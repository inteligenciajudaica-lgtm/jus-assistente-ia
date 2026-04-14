import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, PageBreak, BorderStyle, TabStopType, TabStopPosition, PageNumber } from "https://esm.sh/docx@9.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DocRequest {
  document_type: string;
  title: string;
  court?: string;
  court_division?: string;
  parties?: { author: string; defendant: string };
  facts: string;
  legal_basis?: string;
  requests?: string[];
  case_id?: string;
}

function buildHeader(profile: any): Header {
  const children: Paragraph[] = [];

  // Office name or lawyer name
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({
      text: profile.office_name || profile.full_name || "Escritório de Advocacia",
      bold: true, font: "Arial", size: 28, // 14pt
    })],
  }));

  // Lawyer name (if office name exists)
  if (profile.office_name && profile.full_name) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({
        text: profile.full_name,
        font: "Arial", size: 22,
      })],
    }));
  }

  // OAB info
  if (profile.oab_number) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({
        text: `OAB/${profile.oab_state || "SP"} ${profile.oab_number}`,
        font: "Arial", size: 20, italics: true,
      })],
    }));
  }

  // Separator line
  children.push(new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1a365d", space: 1 } },
    children: [],
  }));

  return new Header({ children });
}

function buildFooter(profile: any): Footer {
  const contactParts: string[] = [];
  if (profile.phone) contactParts.push(profile.phone);
  
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "1a365d", space: 1 } },
        spacing: { before: 100 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: contactParts.length > 0 ? contactParts.join(" | ") : (profile.full_name || ""),
          font: "Arial", size: 16, color: "666666",
        })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Página ", font: "Arial", size: 16, color: "666666" }),
          new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "666666" }),
        ],
      }),
    ],
  });
}

function buildDocumentContent(data: DocRequest): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Title
  paragraphs.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 400 },
    children: [new TextRun({
      text: data.title || data.document_type.toUpperCase(),
      bold: true, font: "Arial", size: 28, allCaps: true,
    })],
  }));

  // Court
  if (data.court) {
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({
        text: `${data.court}${data.court_division ? ` - ${data.court_division}` : ""}`,
        bold: true, font: "Arial", size: 24,
      })],
    }));
  }

  // Parties
  if (data.parties) {
    paragraphs.push(new Paragraph({ spacing: { after: 100 }, children: [
      new TextRun({ text: "AUTOR: ", bold: true, font: "Arial", size: 24 }),
      new TextRun({ text: data.parties.author, font: "Arial", size: 24 }),
    ]}));
    paragraphs.push(new Paragraph({ spacing: { after: 200 }, children: [
      new TextRun({ text: "RÉU: ", bold: true, font: "Arial", size: 24 }),
      new TextRun({ text: data.parties.defendant, font: "Arial", size: 24 }),
    ]}));
  }

  // Facts section
  paragraphs.push(new Paragraph({
    spacing: { before: 300, after: 200 },
    children: [new TextRun({ text: "I - DOS FATOS", bold: true, font: "Arial", size: 24 })],
  }));

  // Split facts by newlines into paragraphs
  const factLines = data.facts.split("\n").filter(l => l.trim());
  for (const line of factLines) {
    paragraphs.push(new Paragraph({
      spacing: { after: 120 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: line.trim(), font: "Arial", size: 24 })],
    }));
  }

  // Legal basis
  if (data.legal_basis) {
    paragraphs.push(new Paragraph({
      spacing: { before: 300, after: 200 },
      children: [new TextRun({ text: "II - DO DIREITO", bold: true, font: "Arial", size: 24 })],
    }));
    const basisLines = data.legal_basis.split("\n").filter(l => l.trim());
    for (const line of basisLines) {
      paragraphs.push(new Paragraph({
        spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: line.trim(), font: "Arial", size: 24 })],
      }));
    }
  }

  // Requests
  if (data.requests && data.requests.length > 0) {
    paragraphs.push(new Paragraph({
      spacing: { before: 300, after: 200 },
      children: [new TextRun({ text: "III - DOS PEDIDOS", bold: true, font: "Arial", size: 24 })],
    }));
    paragraphs.push(new Paragraph({
      spacing: { after: 120 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: "Ante o exposto, requer:", font: "Arial", size: 24 })],
    }));
    for (let i = 0; i < data.requests.length; i++) {
      paragraphs.push(new Paragraph({
        spacing: { after: 100 },
        indent: { left: 720 },
        children: [new TextRun({ text: `${String.fromCharCode(97 + i)}) ${data.requests[i]}`, font: "Arial", size: 24 })],
      }));
    }
  }

  // Closing
  paragraphs.push(new Paragraph({
    spacing: { before: 400, after: 200 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({
      text: "Nestes termos, pede deferimento.",
      font: "Arial", size: 24,
    })],
  }));

  // Date
  const now = new Date();
  const months = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  paragraphs.push(new Paragraph({
    spacing: { before: 400, after: 400 },
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({
      text: `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`,
      font: "Arial", size: 24,
    })],
  }));

  // Signature line
  paragraphs.push(new Paragraph({
    spacing: { before: 600 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "________________________________________", font: "Arial", size: 24 })],
  }));

  return paragraphs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docData: DocRequest = await req.json();

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const profileData = profile || { full_name: user.email, oab_number: null, oab_state: null, office_name: null, phone: null };

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1800, right: 1440, bottom: 1440, left: 1800 },
          },
        },
        headers: { default: buildHeader(profileData) },
        footers: { default: buildFooter(profileData) },
        children: buildDocumentContent(docData),
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${docData.document_type || "documento"}.docx"`,
      },
    });
  } catch (e) {
    console.error("Error generating document:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao gerar documento" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
