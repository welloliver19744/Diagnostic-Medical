import jsPDF from "jspdf";
import type { Tables } from "@/integrations/supabase/types";

type SC = Tables<"service_calls">;

const statusLabel: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em execução",
  waiting_parts: "Aguardando peça",
  completed: "Finalizado",
};

export function generateServiceCallPDF(c: SC, companyName = "FixFlow") {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let y = 18;

  // Header band
  doc.setFillColor(30, 30, 36);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(companyName, 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Ordem de Serviço", 14, 21);
  doc.setFontSize(9);
  doc.text(`OS #${c.id.slice(0, 8).toUpperCase()}`, W - 14, 14, { align: "right" });
  doc.text(new Date(c.service_date + "T00:00").toLocaleDateString("pt-BR"), W - 14, 21, { align: "right" });

  y = 38;
  doc.setTextColor(20, 20, 20);

  const section = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(title.toUpperCase(), 14, y);
    y += 2;
    doc.setDrawColor(220, 220, 225);
    doc.line(14, y, W - 14, y);
    y += 5;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  };

  const field = (label: string, value?: string | null) => {
    if (!value) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(label, 14, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(value, W - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 3;
    if (y > 270) { doc.addPage(); y = 20; }
  };

  section("Cliente");
  field("Nome", c.client_name);
  field("Contato", c.contact);
  field("Endereço", c.address);

  y += 2;
  section("Atendimento");
  field("Data", new Date(c.service_date + "T00:00").toLocaleDateString("pt-BR"));
  field("Técnico", c.technician);
  field("Status", statusLabel[c.status] ?? c.status);

  y += 2;
  section("Descrição técnica");
  field("Defeito reclamado", c.reported_defect);
  field("Serviço realizado", c.service_performed);
  field("Peças trocadas", c.parts_replaced);
  field("Observações", c.notes);

  if (c.value != null) {
    y += 2;
    section("Valor");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`R$ ${Number(c.value).toFixed(2).replace(".", ",")}`, 14, y + 2);
    y += 10;
  }

  // Signatures
  y = Math.max(y, 240);
  doc.setDrawColor(180, 180, 180);
  doc.line(20, y + 20, 90, y + 20);
  doc.line(120, y + 20, 190, y + 20);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Assinatura do Técnico", 55, y + 25, { align: "center" });
  doc.text("Assinatura do Cliente", 155, y + 25, { align: "center" });

  doc.save(`OS-${c.client_name.replace(/\s+/g, "_")}-${c.service_date}.pdf`);
}
