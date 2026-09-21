import { describe, it, expect } from "vitest";

// Test the localized opt-out keyword logic from /api/twilio/sms

const STOP_KEYWORDS_EN = ["stop", "unsubscribe", "cancel", "end", "quit"];
const STOP_KEYWORDS_ES = ["parar", "alto", "salir", "cancelar"];
const STOP_KEYWORDS_PT = ["sair", "cancelar"];
const START_KEYWORDS = ["start", "unstop"];

const LANGUAGE_KEYWORDS: Record<string, string> = {
  en: "en", english: "en",
  es: "es", spanish: "es",
  pt: "pt", portuguese: "pt",
};

type Action =
  | { type: "opt_out"; language: string }
  | { type: "opt_in" }
  | { type: "language_change"; language: string }
  | { type: "help" }
  | { type: "none" };

function classifyInboundSMS(body: string, clientLanguage?: string): Action {
  const normalized = body.trim().toLowerCase();

  if (STOP_KEYWORDS_EN.includes(normalized)) return { type: "opt_out", language: "en" };

  // CANCELAR is ambiguous (ES and PT). Use client's existing language, default to ES.
  if (normalized === "cancelar") {
    const lang = clientLanguage === "pt" ? "pt" : "es";
    return { type: "opt_out", language: lang };
  }

  if (STOP_KEYWORDS_ES.includes(normalized)) return { type: "opt_out", language: "es" };
  if (STOP_KEYWORDS_PT.includes(normalized)) return { type: "opt_out", language: "pt" };
  if (normalized === "help") return { type: "help" };
  if (START_KEYWORDS.includes(normalized)) return { type: "opt_in" };
  if (LANGUAGE_KEYWORDS[normalized]) return { type: "language_change", language: LANGUAGE_KEYWORDS[normalized] };

  return { type: "none" };
}

describe("localized opt-out", () => {
  it("STOP triggers English opt-out", () => {
    const result = classifyInboundSMS("STOP");
    expect(result).toEqual({ type: "opt_out", language: "en" });
  });

  it("PARAR triggers Spanish opt-out", () => {
    const result = classifyInboundSMS("PARAR");
    expect(result).toEqual({ type: "opt_out", language: "es" });
  });

  it("ALTO triggers Spanish opt-out", () => {
    const result = classifyInboundSMS("ALTO");
    expect(result).toEqual({ type: "opt_out", language: "es" });
  });

  it("SALIR triggers Spanish opt-out", () => {
    const result = classifyInboundSMS("SALIR");
    expect(result).toEqual({ type: "opt_out", language: "es" });
  });

  it("SAIR triggers Portuguese opt-out", () => {
    const result = classifyInboundSMS("SAIR");
    expect(result).toEqual({ type: "opt_out", language: "pt" });
  });

  it("CANCELAR defaults to Spanish when no language set", () => {
    const result = classifyInboundSMS("cancelar");
    expect(result).toEqual({ type: "opt_out", language: "es" });
  });

  it("CANCELAR uses Portuguese when client language is PT", () => {
    const result = classifyInboundSMS("cancelar", "pt");
    expect(result).toEqual({ type: "opt_out", language: "pt" });
  });

  it("CANCELAR uses Spanish when client language is ES", () => {
    const result = classifyInboundSMS("cancelar", "es");
    expect(result).toEqual({ type: "opt_out", language: "es" });
  });

  it("START triggers opt-in", () => {
    const result = classifyInboundSMS("START");
    expect(result).toEqual({ type: "opt_in" });
  });

  it("ES triggers language change to Spanish", () => {
    const result = classifyInboundSMS("ES");
    expect(result).toEqual({ type: "language_change", language: "es" });
  });

  it("PORTUGUESE triggers language change to Portuguese", () => {
    const result = classifyInboundSMS("PORTUGUESE");
    expect(result).toEqual({ type: "language_change", language: "pt" });
  });

  it("HELP triggers help response", () => {
    const result = classifyInboundSMS("HELP");
    expect(result).toEqual({ type: "help" });
  });

  it("random text returns none", () => {
    const result = classifyInboundSMS("Hey when are you open?");
    expect(result).toEqual({ type: "none" });
  });

  it("is case-insensitive", () => {
    expect(classifyInboundSMS("stop")).toEqual({ type: "opt_out", language: "en" });
    expect(classifyInboundSMS("Parar")).toEqual({ type: "opt_out", language: "es" });
    expect(classifyInboundSMS("sAiR")).toEqual({ type: "opt_out", language: "pt" });
  });
});
