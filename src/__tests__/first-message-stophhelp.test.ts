import { describe, it, expect } from "vitest";

function getStopHelpLine(lang: string): string {
  if (lang === "es") return "\nResponde PARAR para salir";
  if (lang === "pt") return "\nResponda SAIR para sair";
  return "\nReply STOP to end";
}

function buildMessageBody(
  template: string,
  isFirstMessage: boolean,
  lang: string
): string {
  let msg = template;
  if (isFirstMessage) {
    msg += getStopHelpLine(lang);
  }
  return msg;
}

describe("first-message STOP/HELP tracking", () => {
  const template = "Hey Mike, sorry we missed you! Book here: https://link.com";

  it("first-ever message includes STOP line (English)", () => {
    const msg = buildMessageBody(template, true, "en");
    expect(msg).toContain("Reply STOP to end");
  });

  it("second message does NOT include STOP line", () => {
    const msg = buildMessageBody(template, false, "en");
    expect(msg).not.toContain("STOP");
  });

  it("first message in Spanish includes localized STOP", () => {
    const msg = buildMessageBody(template, true, "es");
    expect(msg).toContain("PARAR");
    expect(msg).not.toContain("Reply STOP");
  });

  it("first message in Portuguese includes localized STOP", () => {
    const msg = buildMessageBody(template, true, "pt");
    expect(msg).toContain("SAIR");
    expect(msg).not.toContain("Reply STOP");
  });

  it("all messages stay under 160 chars without STOP/HELP line", () => {
    const shortTemplate = "Hey Mike, missed your call! Book: link.co/abc";
    const msg = buildMessageBody(shortTemplate, false, "en");
    expect(msg.length).toBeLessThanOrEqual(160);
  });
});
