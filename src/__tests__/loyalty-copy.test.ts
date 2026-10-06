import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { interpolateTemplate } from "@/lib/messages";
import { rewardVars } from "@/lib/loyalty";

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
  it("confirmation says $5 off this visit when a reward is due", () => {
    expect(interpolateTemplate(confirmEn, { ...base, ...rewardVars(true, 500) })).toBe(
      "You're in. Friday at 3pm. $5 off this visit. If anything comes up, move it here: https://x.co/m"
    );
  });

  it("confirmation is unchanged when no reward is due", () => {
    expect(interpolateTemplate(confirmEn, { ...base, ...rewardVars(false, 500) })).toBe(
      "You're in. Friday at 3pm. If anything comes up, move it here: https://x.co/m"
    );
  });

  it("group confirmation with a reward", () => {
    expect(interpolateTemplate(confirmEn, { ...base, party: ", party of 3", ...rewardVars(true, 500) })).toBe(
      "You're in, party of 3. Friday at 3pm. $5 off this visit. If anything comes up, move it here: https://x.co/m"
    );
  });

  it("Spanish confirmation with a reward", () => {
    expect(interpolateTemplate(confirmEs, { ...base, ...rewardVars(true, 500) })).toBe(
      "Listo. Friday a las 3pm. $5 de descuento en esta visita. Si necesitas cambiarlo: https://x.co/m"
    );
  });

  it("2-hour reminder says $5 off this visit", () => {
    expect(interpolateTemplate(twoHourEn, { time: "3pm", ...rewardVars(true, 500) })).toBe(
      "Chair's yours at 3pm. $5 off this visit. See you in a couple hours."
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
