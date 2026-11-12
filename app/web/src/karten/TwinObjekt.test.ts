import { describe, expect, it } from "vitest";
import { kurzId } from "./TwinObjekt";

describe("kurzId", () => {
  it("kürzt UUIDs und zählt weitere Bauteile", () => {
    expect(kurzId(["72a2bc4d-1744-4221-a521-ac1504e86000"])).toBe("72a2bc4d");
    expect(kurzId(["72a2bc4d-1744-4221-a521-ac1504e86000", "11111111-2222-3333-4444-555555555555"])).toBe("72a2bc4d +1");
    expect(kurzId([])).toBe("–");
    expect(kurzId(["b1"])).toBe("b1");
  });
});
