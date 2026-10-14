import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { interpolateTemplate } from "@/lib/messages";
import { rewardVars, rewardText } from "@/lib/loyalty";

const HALF = { enabled: true, reward: "half" as const };
const FREE = { enabled: true, reward: "free" as const };

// The exact default copy shipped in the deploy-time migration.
const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260930b_template_copy.sql"), "utf8");
function applyCopy(original: string, key: string, column: "custom_message" | "custom_message_es"): string {
  let out = original;
  const re = new RegExp(
    `set ${column} = replace\\(${column}, '((?:[^']|'')*)', '((?:[^']|'')*)'\\)\\s*where user_id is null and template_key = '${key}'`,
    "g"
  );
  for (const m of sql.matchAll(re)) out = out.replace(m[1].replace(/''/g, "'"), m[2].replace(/''/g, "'"));
  const setRe = new RegExp(`set custom_message = '((?:[^']|'')*)',\\s*custom_message_es = '((?:[^']|'')*)'\\s*where user_id is null and template_key = '${key}'`);
  const set = sql.match(setRe);
  if (set) out = (column === "custom_message" ? set[1] : set[2]).replace(/''/g, "'");
  return out;
}

const confirmEn = applyCopy("You're in. {date} at {time}. If anything comes up, move it here: {link}", "booking_confirm", "custom_message");
const confirmEs = applyCopy("Listo. {date} a las {time}. Si necesitas cambiarlo: {link}", "booking_confirm", "custom_message_es");
const twoHourEn = applyCopy("Chair's yours at {time}. See you in a couple hours.", "reminder_2h", "custom_message");
const progressEn = applyCopy("", "loyalty_progress", "custom_message");
const earnedEn = applyCopy("", "loyalty_earned", "custom_message");

const base = { date: "Friday", time: "3pm", link: "https://x.co/m", party: "", party_es: "" };

describe("client texts after the template-copy migration", () => {
  it("confirmation says 50% off this cut when the 10th cut is due", () => {
    expect(interpolateTemplate(confirmEn, { ...base, ...rewardVars(true, HALF, 1750) })).toBe(
      "You're in. Friday at 3pm. 50% off this cut ($17.50), it's your 10th. If anything comes up, move it here: https://x.co/m"
    );
  });

  it("or that it's free, when the barber picked a free 10th cut", () => {
    expect(interpolateTemplate(confirmEn, { ...base, ...rewardVars(true, FREE, 3500) })).toBe(
      "You're in. Friday at 3pm. This cut is free, it's your 10th. If anything comes up, move it here: https://x.co/m"
    );
  });

  it("confirmation is unchanged when no reward is due", () => {
    expect(interpolateTemplate(confirmEn, { ...base, ...rewardVars(false, HALF, 1750) })).toBe(
      "You're in. Friday at 3pm. If anything comes up, move it here: https://x.co/m"
    );
  });

  it("group confirmation with a reward", () => {
    expect(interpolateTemplate(confirmEn, { ...base, party: ", party of 3", ...rewardVars(true, FREE, 3000) })).toBe(
      "You're in, party of 3. Friday at 3pm. This cut is free, it's your 10th. If anything comes up, move it here: https://x.co/m"
    );
  });

  it("Spanish confirmation with a reward", () => {
    expect(interpolateTemplate(confirmEs, { ...base, ...rewardVars(true, HALF, 1750) })).toBe(
      "Listo. Friday a las 3pm. 50% de descuento en este corte ($17.50), es tu 10.º. Si necesitas cambiarlo: https://x.co/m"
    );
  });

  it("2-hour reminder names the reward", () => {
    expect(interpolateTemplate(twoHourEn, { time: "3pm", ...rewardVars(true, FREE, 3000) })).toBe(
      "Chair's yours at 3pm. This cut is free, it's your 10th. See you in a couple hours."
    );
  });

  it("progress text names the right cut", () => {
    expect(interpolateTemplate(progressEn, { cuts: "3", next_cut: "4" })).toBe("That's 3 cuts. Cut #4 is $5 off.");
  });

  it("earned text", () => {
    expect(interpolateTemplate(earnedEn, { next_cut: "7" })).toBe("Your $5 off was applied today. Your next $5 off is cut #7.");
  });

  it("an unfilled placeholder never reaches the client", () => {
    expect(interpolateTemplate("Hi {first_name}.{reward} Bye", { first_name: "Ana" })).toBe("Hi Ana. Bye");
  });
});

describe("copy update for the repeating re-engagement", () => {
  const f = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261002f_winback_copy.sql"), "utf8");
  it("the last win-back no longer promises it's the last text", () => {
    expect(f).toMatch(/template_key = 'winback_final'/);
    expect(f).toMatch(/template_key = 'winback_final_offer'/);
    expect(f.split("\n").filter((l) => !l.startsWith("--")).join("\n")).not.toMatch(/Last one|Último mensaje/);
  });
  it("progress text reads right after one cut", () => {
    const m = f.match(/set custom_message = '([^']+)',\s*custom_message_es = '([^']+)',[^;]*template_key = 'loyalty_progress'/);
    expect(interpolateTemplate(m![1], { cuts: "1", next_cut: "3" })).toBe("Cuts so far: 1. Cut #3 is $5 off.");
    expect(interpolateTemplate(m![2], { cuts: "1", next_cut: "3" })).toBe("Cortes hasta ahora: 1. El corte #3 lleva $5 de descuento.");
  });
});

describe("10-cut card: the one loyalty text, after the 9th cut", () => {
  const f = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261012b_loyalty_ten_cut_card.sql"), "utf8");
  const m = f.match(/set custom_message = '((?:[^']|'')+)',\s*custom_message_es = '((?:[^']|'')+)'\s*where user_id is null and template_key = 'loyalty_progress'/)!;
  const en = m[1].replace(/''/g, "'");
  const es = m[2].replace(/''/g, "'");
  const vars = { shop_name: "Kings Cuts", link: "https://x.co/b" };

  it("50% off", () => {
    expect(interpolateTemplate(en, { ...vars, ...rewardText(HALF) })).toBe("Thanks for coming in. Your next cut at Kings Cuts is 50% off. Book it here: https://x.co/b");
    expect(interpolateTemplate(es, { ...vars, ...rewardText(HALF) })).toBe("Gracias por venir. Tu próximo corte en Kings Cuts va con 50% de descuento. Resérvalo aquí: https://x.co/b");
  });

  it("free", () => {
    expect(interpolateTemplate(en, { ...vars, ...rewardText(FREE) })).toBe("Thanks for coming in. Your next cut at Kings Cuts is free. Book it here: https://x.co/b");
    expect(interpolateTemplate(es, { ...vars, ...rewardText(FREE) })).toBe("Gracias por venir. Tu próximo corte en Kings Cuts va gratis. Resérvalo aquí: https://x.co/b");
  });

  it("the 'reward used' text is gone", () => {
    expect(f).toMatch(/delete from public.message_templates where template_key = 'loyalty_earned'/);
  });
});
