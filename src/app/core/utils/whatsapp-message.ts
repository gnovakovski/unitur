/**
 * Mensagem padrão do botão "Reservar agora" quando a viagem não tem uma
 * mensagem própria cadastrada no admin.
 */
export function defaultWhatsappMessage(tripTitle?: string): string {
  const nome = (tripTitle || '').trim() || 'esta viagem';
  return `Olá, estava vendo o roteiro ${nome} e gostaria de fazer a minha reserva, pode me ajudar?`;
}

/** Mensagem final: a cadastrada na viagem ou, se vazia, o texto padrão. */
export function resolveWhatsappMessage(custom?: string, tripTitle?: string): string {
  return (custom || '').trim() || defaultWhatsappMessage(tripTitle);
}

/**
 * Monta o link do WhatsApp com a mensagem já preenchida. Sem número
 * cadastrado, cai em wa.me/?text= (o cliente escolhe o contato).
 */
export function buildWhatsappLink(whatsappNumber: string, message: string): string {
  const digits = String(whatsappNumber || '').replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}
