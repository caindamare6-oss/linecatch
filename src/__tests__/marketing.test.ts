import { describe, it, expect } from "vitest";
import { marketingState } from "@/lib/marketing";
import { keyword } from "@/lib/opt-out";

describe("SMS marketing state", () => {
  it("is the barber's switch", () => {
    expect(marketingState(false)).toBe("off");
    expect(marketingState(true)).toBe("on");
  });

});

describe("opt-out keywords", () => {
  it("ignore case, punctuation, accents and spacing", () => {
    for (const t of ["STOP", "Stop.", " stop ", "STOP!", "stop!!"]) expect(keyword(t)).toBe("stop");
    expect(keyword("Párar")).toBe("parar");
    expect(keyword("please stop texting")).toBe("please stop texting");
  });
});
