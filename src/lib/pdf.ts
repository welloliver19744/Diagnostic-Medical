import jsPDF from "jspdf";
import logoUrl from "@/assets/diagnostic-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type SC = Tables<"service_calls"> & {
  report_type?: string | null;
  report_number?: string | null;
  equipment_type?: string | null;
  equipment_serial?: string | null;
  responsible_employee?: string | null;
  installed_at?: string | null;
  in_warranty?: boolean | null;
  in_contract?: boolean | null;
  transformer_serial?: string | null;
  counter_odometer?: string | null;
  lot_number?: string | null;
  working_before?: boolean | null;
  verified_tested?: boolean | null;
  working_after?: boolean | null;
  approved_by?: string | null;
  client_signature?: string | null;
  parts_used?: any;
  parts_requested?: any;
  parts_priority?: string | null;
};

const fmtDate = (d?: string | null) => d ? new Date(d + "T00:00").toLocaleDateString("pt-BR") : "";

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
  } catch { return null; }
}

export async function generateServiceCallPDF(
  c: SC,
  preloaded?: { techName?: string | null; techSignatureUrl?: string | null }
) {
  let techSignature: string | null = null;
  let clientSignature: string | null = null;
  let techName = c.technician ?? "";

  // Preload signatures
  if (preloaded) {
    techName = techName || preloaded.techName || "";
    if (preloaded.techSignatureUrl) techSignature = await urlToDataUrl(preloaded.techSignatureUrl);
  } else {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;
    if (currentUser && (!c.technician || c.technician === currentUser.user_metadata?.full_name)) {
      techName = techName || currentUser.user_metadata?.full_name || "";
      const sig = currentUser.user_metadata?.signature_url;
      if (sig) techSignature = sig.startsWith("http") ? await urlToDataUrl(sig) : sig;
    }
    if (!techSignature && (c as any).assigned_to) {
      const { data } = await supabase.from("profiles").select("full_name, signature_url").eq("id", (c as any).assigned_to).maybeSingle();
      if (data) {
        techName = techName || data.full_name || "";
        const sig = (data as any).signature_url;
        if (sig) techSignature = sig.startsWith("http") ? await urlToDataUrl(sig) : sig;
      }
    }
  }
  if (c.client_signature) {
    clientSignature = c.client_signature.startsWith("http") ? await urlToDataUrl(c.client_signature) : c.client_signature;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 10, RW = W - 2 * M;

  // ---- Main Page Border ----
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.rect(M, M, RW, H - 2 * M);

  // ---- Header ----
  doc.rect(M, M, RW, 22);
  try { doc.addImage(logoUrl, "JPEG", M + 1, M + 1, 30, 20); } catch {}
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("SISTEMA DE GESTÃO DA QUALIDADE", W / 2, M + 7, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Setor: Administrativo / Assistência Técnica", W / 2, M + 12, { align: "center" });
  
  const rx = W - M - 50;
  doc.rect(rx, M, 50, 22);
  doc.line(rx + 25, M, rx + 25, M + 15);
  doc.line(rx, M + 8, rx + 50, M + 8);
  doc.line(rx, M + 15, rx + 50, M + 15);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("Versão", rx + 12.5, M + 4, { align: "center" }); doc.text("002", rx + 19, M + 4);
  doc.text("Revisão", rx + 37.5, M + 4, { align: "center" }); doc.text("005", rx + 44, M + 4);
  doc.text("25/07/ 2021", rx + 12.5, M + 12, { align: "center" });
  doc.text("05/06/2024", rx + 37.5, M + 12, { align: "center" });
  doc.text("Datas", rx + 25, M + 20, { align: "center" });

  let y = M + 22;
  doc.rect(M, y, RW, 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Título: F: 024; RELATÓRIO DE CHAMADA DE SERVIÇO (AT)", M + 20, y + 5.5);
  doc.rect(W - M - 25, y, 25, 8);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Nº página", W - M - 23, y + 5.5);
  doc.setFont("helvetica", "bold"); doc.text("1/1", W - M - 2, y + 5.5, { align: "right" });
  y += 8;

  const cellH = 8.5;
  const drawCell = (x: number, yy: number, w: number, h: number, label: string, val?: string | null) => {
    doc.rect(x, yy, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(6); doc.setTextColor(80);
    doc.text(label, x + 1.2, yy + 2.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(0);
    doc.text(doc.splitTextToSize(val ?? "", w - 2.4).slice(0, 1), x + 1.2, yy + 6.5);
  };

  const drawCheck = (x: number, yy: number, w: number, h: number, label: string, val?: boolean | null) => {
    doc.rect(x, yy, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text(label, x + 1.2, yy + h/2 + 1);
    const tw = doc.getTextWidth(label);
    const bs = 2.4, by = yy + h/2 - bs/2, ty = yy + h/2 + 1;
    doc.rect(x + tw + 3, by, bs, bs); doc.text("SIM", x + tw + 6.5, ty);
    if (val === true) doc.text("X", x + tw + 3.5, ty - 0.2);
    doc.rect(x + tw + 15, by, bs, bs); doc.text("NÃO", x + tw + 18.5, ty);
    if (val === false) doc.text("X", x + tw + 15.5, ty - 0.2);
  };

  drawCell(M, y, RW * 0.45, cellH, "Técnico executor:", techName);
  drawCell(M + RW * 0.45, y, RW * 0.55, cellH, "Endereço:", c.address); y += cellH;
  drawCell(M, y, RW * 0.5, cellH, "Cliente:", c.client_name);
  drawCell(M + RW * 0.5, y, RW * 0.22, cellH, "Data:", fmtDate(c.service_date));
  doc.rect(M + RW * 0.72, y, RW * 0.28, cellH);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("RELATÓRIO", M + RW * 0.86, y + 3.5, { align: "center" });
  doc.text(`Nº ${c.report_number || "—"}`, M + RW * 0.86, y + 7.5, { align: "center" }); y += cellH;
  drawCell(M, y, RW * 0.5, cellH, "Tipo de equipamento:", c.equipment_type);
  drawCell(M + RW * 0.5, y, RW * 0.5, cellH, "Número de série:", c.equipment_serial); y += cellH;
  drawCell(M, y, RW * 0.5, cellH, "Colaborador responsável em atender:", c.responsible_employee);
  drawCell(M + RW * 0.5, y, RW * 0.5, cellH, "Instalado em:", fmtDate(c.installed_at)); y += cellH;
  drawCheck(M, y, RW * 0.5, cellH, "Em garantia:", c.in_warranty);
  drawCheck(M + RW * 0.5, y, RW * 0.5, cellH, "Em contrato de manutenção:", c.in_contract); y += cellH;
  drawCell(M, y, RW * 0.5, cellH, "Nº de Série do Transformador Principal:", c.transformer_serial);
  drawCell(M + RW * 0.5, y, RW * 0.5, cellH, "Contador / Odômetro:", c.counter_odometer); y += cellH;
  drawCell(M, y, RW, cellH, "Para o caso de problemas com consumíveis especificar o número do lote:", c.lot_number); y += cellH;
  drawCheck(M, y, RW, cellH, "O equipamento estava em funcionamento antes do reparo?", c.working_before); y += cellH;

  const drawBlock = (label: string, val: string | null | undefined, h: number) => {
    doc.rect(M, y, RW, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(label, M + 1.2, y + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(val ?? "", RW - 4), M + 1.2, y + 8.5, { lineHeightFactor: 1.1 });
    y += h;
  };

  drawBlock("Descrição do problema:", c.reported_defect, 32);
  drawBlock("Causa diagnosticada e ação corretiva / reparo realizado:", c.service_performed, 55);

  doc.rect(M, y, RW, 10);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("Verificado e testado?", M + 1.2, y + 4);
  doc.rect(M + 35, y + 2, 2.4, 2.4); doc.text("SIM", M + 38.5, y + 4);
  if (c.verified_tested === true) doc.text("X", M + 35.5, y + 3.9);
  doc.rect(M + 47, y + 2, 2.4, 2.4); doc.text("NÃO", M + 50.5, y + 4);
  if (c.verified_tested === false) doc.text("X", M + 47.5, y + 3.9);
  doc.setFontSize(6); doc.setFont("helvetica", "normal");
  doc.text("(Indicar o número do Relatório de Resultados de teste com base nas especificações do produto)", M + 65, y + 4); y += 10;

  doc.rect(M, y, RW, 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("O equipamento voltou a funcionar após o reparo?", M + 1.2, y + 5);
  doc.rect(M + 75, y + 3, 2.4, 2.4); doc.text("SIM", M + 78.5, y + 5);
  if (c.working_after === true) doc.text("X", M + 75.5, y + 4.9);
  doc.rect(M + 87, y + 3, 2.4, 2.4); doc.text("NÃO", M + 90.5, y + 5);
  if (c.working_after === false) doc.text("X", M + 87.5, y + 4.9); y += 8;

  if (c.report_type === "laser") {
    const drawP = (title: string, rows: any[]) => {
      doc.rect(M, y, RW, 5); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.text(title, M + 1.2, y + 3.5); y += 5;
      (rows?.slice(0, 2) || [{}, {}]).forEach(r => {
        doc.rect(M, y, RW, 4.5); doc.setFont("helvetica", "normal");
        doc.text(`${r.number??""} - ${r.description??""} (${r.qty??""})`, M + 1.2, y + 3.2); y += 4.5;
      });
    };
    drawP("Peças Utilizadas do Estoque", c.parts_used);
    drawP("Peças a serem requisitadas", c.parts_requested);
  } else if (c.parts_replaced) {
    drawBlock("Peças trocadas:", c.parts_replaced, 15);
  }

  drawBlock("Observações:", c.notes, 20);

  // ---- Footer fixo no final ----
  y = H - M - 40;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Relatório aprovado por:", M, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(techName || "—", M + 38 + 36, y + 5, { align: "center" });
  doc.line(M + 38, y + 5.5, M + 110, y + 5.5);
  
  y += 15;
  doc.setFont("helvetica", "bold");
  doc.text("Assinatura do técnico:", M, y + 5);
  doc.line(M + 35, y + 5.5, M + 100, y + 5.5);
  doc.text("Assinatura do cliente:", M + 105, y + 5);
  doc.line(M + 140, y + 5.5, M + 195, y + 5.5);

  if (techSignature) try { doc.addImage(techSignature, "PNG", M + 45, y - 10, 45, 14); } catch {}
  if (clientSignature) try { doc.addImage(clientSignature, "PNG", M + 145, y - 10, 45, 14); } catch {}
  
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(c.client_name || "—", M + 167.5, y + 9, { align: "center" }); y += 10;

  doc.rect(M, y, RW, 15);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("INVESTIGAÇÃO (PARA USO DA GESTÃO DA QUALIDADE):", M + 1.2, y + 4);
  y += 15;
  doc.rect(M, y, RW, 7);
  doc.text("Realizou Ação Corretiva/Preventiva?", M + 1.2, y + 5);
  doc.rect(M + 55, y + 2.3, 2.4, 2.4); doc.text("NÃO", M + 58.5, y + 5);
  doc.rect(M + 67, y + 2.3, 2.4, 2.4); doc.text("SIM", M + 70.5, y + 5);
  doc.text("Nº:", M + 80, y + 5); doc.line(M + 85, y + 5.5, M + 115, y + 5.5);
  doc.text("Data: ___/___/______", M + 125, y + 5);

  doc.save(`Relatorio-${(c.report_type||"OS").toUpperCase()}-${(c.client_name||"cliente").replace(/\s+/g,"_")}-${c.service_date}.pdf`);
}
