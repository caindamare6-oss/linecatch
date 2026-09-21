import { describe, it, expect } from "vitest";

function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

const SYSTEM_TEMPLATES: Record<string, Record<string, string>> = {
  missed_call: {
    en: "Hey {first_name}, sorry we missed you! Book your next cut: {link}",
    es: "Hola {first_name}, no pudimos atenderte. Reserva aqui: {link}",
    pt: "Oi {first_name}, não conseguimos atender. Agende aqui: {link}",
  },
  booking_confirm: {
    en: "You're booked, {first_name}! See you at {shop_name}.",
    es: "Reservado, {first_name}! Te esperamos en {shop_name}.",
    pt: "Agendado, {first_name}! Te esperamos na {shop_name}.",
  },
  reminder_24h: {
    en: "Reminder: your cut at {shop_name} is tomorrow.",
    es: "Recordatorio: tu corte en {shop_name} es mañana.",
    pt: "Lembrete: seu corte na {shop_name} é amanhã.",
  },
  reminder_2h: {
    en: "Heads up: your cut at {shop_name} is in 2 hours!",
    es: "Aviso: tu corte en {shop_name} es en 2 horas!",
    pt: "Aviso: seu corte na {shop_name} é em 2 horas!",
  },
  cancelled: {
    en: "Your appointment at {shop_name} has been cancelled.",
    es: "Tu cita en {shop_name} fue cancelada.",
    pt: "Seu agendamento na {shop_name} foi cancelado.",
  },
  rescheduled: {
    en: "Your cut at {shop_name} has been rescheduled.",
    es: "Tu corte en {shop_name} fue reprogramado.",
    pt: "Seu corte na {shop_name} foi reagendado.",
  },
  wednesday_dropin: {
    en: "Hey {first_name}! It's been a while. Drop in at {shop_name} this week!",
    es: "Hola {first_name}! Hace tiempo que no vienes. Pasa por {shop_name} esta semana!",
    pt: "Oi {first_name}! Faz tempo que não vem. Passe na {shop_name} esta semana!",
  },
  loyalty_earned: {
    en: "Nice, {first_name}! You earned $5 off your next cut at {shop_name}!",
    es: "Genial, {first_name}! Ganaste $5 de descuento en {shop_name}!",
    pt: "Parabéns, {first_name}! Você ganhou $5 de desconto na {shop_name}!",
  },
  loyalty_progress: {
    en: "{first_name}, {cuts_until} more cuts until your $5 reward at {shop_name}!",
    es: "{first_name}, {cuts_until} cortes más para tu descuento en {shop_name}!",
    pt: "{first_name}, faltam {cuts_until} cortes para seu desconto na {shop_name}!",
  },
};

const vars = {
  first_name: "Mike",
  shop_name: "Ace Cuts",
  link: "https://book.linecatch.com/abc",
  cuts_until: "2",
};

describe("template rendering — all templates in en/es/pt", () => {
  for (const [key, langs] of Object.entries(SYSTEM_TEMPLATES)) {
    for (const [lang, template] of Object.entries(langs)) {
      it(`${key} (${lang}) renders without unresolved placeholders`, () => {
        const rendered = interpolateTemplate(template, vars);
        expect(rendered).not.toMatch(/\{first_name\}/);
        expect(rendered).not.toMatch(/\{shop_name\}/);
        expect(rendered).not.toMatch(/\{link\}/);
        expect(rendered).not.toMatch(/\{cuts_until\}/);
      });

      it(`${key} (${lang}) is under 160 chars`, () => {
        const rendered = interpolateTemplate(template, vars);
        expect(rendered.length).toBeLessThanOrEqual(160);
      });
    }
  }

  it("interpolation replaces all occurrences of a variable", () => {
    const tpl = "{first_name} booked at {shop_name}. See you at {shop_name}!";
    const result = interpolateTemplate(tpl, vars);
    expect(result).toBe("Mike booked at Ace Cuts. See you at Ace Cuts!");
  });

  it("missing variable leaves placeholder intact", () => {
    const tpl = "Hey {first_name}, your code is {promo_code}";
    const result = interpolateTemplate(tpl, { first_name: "Mike" });
    expect(result).toContain("{promo_code}");
    expect(result).toContain("Mike");
  });
});
