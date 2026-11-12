import { describe, expect, it, vi } from "vitest";
import { tasteBehandeln, tastenWirkung } from "./tastatur";

const input = (type: string, disabled = false) => ({ tagName: "INPUT", type, disabled, click: vi.fn() });

describe("Tastatur im Assistenten", () => {
  it("Enter schaltet Schalter, Checkboxen und Kacheln (Radio) wie die Leertaste", () => {
    for (const typ of ["checkbox", "radio"]) {
      const el = input(typ);
      expect(tasteBehandeln({ key: "Enter" }, el, () => {})).toBe(true);
      expect(el.click).toHaveBeenCalledOnce();
    }
  });

  it("Enter auf Textfeld, Knopf oder deaktiviertem Schalter bleibt unverändert", () => {
    expect(tastenWirkung({ key: "Enter" }, input("text"))).toBeNull();
    expect(tastenWirkung({ key: "Enter" }, { tagName: "BUTTON", click: () => {} })).toBeNull();
    const aus = input("checkbox", true);
    expect(tasteBehandeln({ key: "Enter" }, aus, () => {})).toBe(false);
    expect(aus.click).not.toHaveBeenCalled();
    expect(tastenWirkung({ key: " " }, input("checkbox"))).toBeNull();
    expect(tastenWirkung({ key: "Enter", isComposing: true }, input("checkbox"))).toBeNull();
    expect(tastenWirkung({ key: "Enter", shiftKey: true }, input("checkbox"))).toBeNull();
  });

  it("Ctrl/Cmd+Enter geht weiter, auch aus einem Textfeld", () => {
    const weiter = vi.fn();
    expect(tasteBehandeln({ key: "Enter", ctrlKey: true }, input("text"), weiter)).toBe(true);
    expect(tasteBehandeln({ key: "Enter", metaKey: true }, null, weiter)).toBe(true);
    expect(weiter).toHaveBeenCalledTimes(2);
  });
});
