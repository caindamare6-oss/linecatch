export type Lang = "en" | "es";

export const PORTFOLIO_COPY = {
  en: {
    with: "with",
    head1: "Sharp cuts,",
    head2: "clean lines.",
    intro: "Real work from my chair. Look through the cuts, then grab a spot.",
    openToday: "Open today",
    closedToday: "Closed today",
    from: "From",
    theWork: "The work",
    tapToOpen: "Tap a photo to see it bigger",
    noPhotos: "Photos coming soon.",
    howTitle: "Book in a minute",
    steps: [
      { title: "Pick your cut", body: "Choose a service. Bringing someone? Book up to 4 people back to back." },
      { title: "Pick a time", body: "See real openings and tap the one that works." },
      { title: "Show up, pay in person", body: "No card needed. You pay at your appointment." },
    ],
    closing: "Your chair's waiting.",
    cta: "Continue to Booking",
    ctaNote: "Takes about a minute · Pay in person",
    bookThisLook: "Book this look",
    photoOf: (n: number, total: number) => `Photo ${n} of ${total}`,
    close: "Close photo",
    prev: "Previous photo",
    next: "Next photo",
    open: (n: number) => `Open photo ${n}`,
    switchTo: "Español",
    metaTitle: (shop: string) => `${shop} · Book a cut`,
    metaDesc: (shop: string) => `See recent cuts from ${shop} and book in about a minute.`,
  },
  es: {
    with: "con",
    head1: "Cortes precisos,",
    head2: "líneas limpias.",
    intro: "Trabajo real de mi silla. Mira los cortes y reserva tu lugar.",
    openToday: "Abierto hoy",
    closedToday: "Cerrado hoy",
    from: "Desde",
    theWork: "Mis cortes",
    tapToOpen: "Toca una foto para verla más grande",
    noPhotos: "Fotos muy pronto.",
    howTitle: "Reserva en un minuto",
    steps: [
      { title: "Elige tu corte", body: "Escoge un servicio. ¿Vienes con alguien? Reserva hasta 4 personas seguidas." },
      { title: "Elige la hora", body: "Mira los horarios disponibles y toca el que te sirva." },
      { title: "Llega y paga en persona", body: "No necesitas tarjeta. Pagas en tu cita." },
    ],
    closing: "Tu silla te espera.",
    cta: "Continuar a reservar",
    ctaNote: "Toma como un minuto · Pagas en persona",
    bookThisLook: "Quiero este corte",
    photoOf: (n: number, total: number) => `Foto ${n} de ${total}`,
    close: "Cerrar foto",
    prev: "Foto anterior",
    next: "Foto siguiente",
    open: (n: number) => `Abrir foto ${n}`,
    switchTo: "English",
    metaTitle: (shop: string) => `${shop} · Reserva tu corte`,
    metaDesc: (shop: string) => `Mira los cortes recientes de ${shop} y reserva en un minuto.`,
  },
} as const;

export function pickLang(param: unknown, acceptLanguage: string | null): Lang {
  if (param === "es" || param === "en") return param;
  const first = (acceptLanguage || "").split(",")[0]?.trim().toLowerCase() || "";
  return first.startsWith("es") ? "es" : "en";
}
