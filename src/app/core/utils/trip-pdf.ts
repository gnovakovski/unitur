export interface TripPdfContent {
  title: string;
  slug: string;
  destination: string;
  date: string;
  duration: string;
  description?: string;
  summary: string;
  guide: string;
  coordinator: string;
  price: string;
  foreignPrice?: string;
  itinerary: Array<{ day: string; title: string; description: string }>;
  included: string[];
  notIncluded: string[];
  hotels?: Array<{ name: string }>;
  paymentMethods?: Array<{ title: string; description?: string }>;
  cancellationPolicy?: string;
}

/** Carrega a biblioteca apenas quando o visitante pede o PDF. Texto selecionável,
 * quebra de páginas e roteiro completo, independente da expansão na tela. */
export async function createTripPdf(trip: TripPdfContent, url: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ compress: true });
  pdf.setProperties({ title: trip.title, author: 'Unitur', subject: 'Roteiro de viagem' });
  let y = 24;
  const bottom = 273;
  const space = (height: number) => {
    if (y + height > bottom) { pdf.addPage(); y = 24; }
  };
  const text = (value: string, size = 11, bold = false) => {
    if (!value.trim()) return;
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''), 170);
    const lineHeight = size * 0.45;
    for (const line of lines) {
      space(lineHeight);
      pdf.text(line, 20, y);
      y += lineHeight;
    }
    y += 3;
  };
  const heading = (title: string) => {
    space(24);
    y += 5;
    pdf.setTextColor(58, 117, 195);
    text(title, 14, true);
    pdf.setTextColor(35, 40, 50);
  };

  pdf.setTextColor(58, 117, 195);
  text('UNITUR', 22, true);
  pdf.setTextColor(35, 40, 50);
  text(trip.title, 20, true);
  text(`${trip.destination} | ${trip.duration}`);
  text(`Datas: ${trip.date}`, 11, true);
  heading('Experiência');
  text(trip.description || trip.summary);
  if (trip.guide || trip.coordinator) {
    heading('Equipe da viagem');
    if (trip.guide) text(`Guia: ${trip.guide}`);
    if (trip.coordinator) text(`Coordenação: ${trip.coordinator}`);
  }
  if (trip.itinerary.length) {
    heading('Roteiro completo');
    for (const item of trip.itinerary) {
      space(20);
      text(`${item.day} - ${item.title}`, 11, true);
      if (item.description !== item.title) text(item.description);
    }
  }
  for (const [label, items] of [['Incluído', trip.included], ['Não incluído', trip.notIncluded]] as const) {
    if (!items.length) continue;
    heading(label);
    for (const item of items) text(`• ${item}`);
  }
  const hotels = trip.hotels?.filter(hotel => hotel.name.trim()) || [];
  if (hotels.length) {
    heading('Hotéis previstos');
    for (const hotel of hotels) text(hotel.name);
  }
  heading('Valores e pagamento');
  text(`A partir de ${[trip.foreignPrice, trip.price].filter(Boolean).join(' / ')}`);
  for (const method of trip.paymentMethods || []) {
    text([method.title, method.description].filter(Boolean).join(': '));
  }
  if (trip.cancellationPolicy) {
    heading('Política de cancelamento');
    text(trip.cancellationPolicy);
  }
  heading('Saiba mais e reserve');
  text(url, 10);
  text('Valores, disponibilidade e programação sujeitos à confirmação pela Unitur.', 9);

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 105, 115);
    pdf.text('Unitur | www.unitur.com.br', 20, 286);
    pdf.text(`${page} / ${pages}`, 190, 286, { align: 'right' });
  }
  return pdf;
}
