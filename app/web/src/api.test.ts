import { describe, it, expect } from "vitest";
import { fehlerMeldungen, loginFehlertext } from "./api";

describe("fehlerMeldungen", () => {
  it("liest Planora-Fehlerlisten", () => {
    expect(fehlerMeldungen({ fehler: [{ pfad: "body/stand", code: "struktur_ungueltig", meldung: "muss Zahl sein" }] })).toEqual(["muss Zahl sein"]);
  });
  it("liest einfache Fehlertexte", () => {
    expect(fehlerMeldungen({ fehler: "nicht gefunden" })).toEqual(["nicht gefunden"]);
  });
  it("liest Better-Auth-Meldungen", () => {
    expect(fehlerMeldungen({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" })).toEqual(["Invalid email or password"]);
  });
  it("leer bei Unbekanntem", () => {
    expect(fehlerMeldungen(null)).toEqual([]);
    expect(fehlerMeldungen("x")).toEqual([]);
  });
});

describe("loginFehlertext", () => {
  it("uebersetzt Statuscodes", () => {
    expect(loginFehlertext(401)).toBe("E-Mail oder Passwort falsch.");
    expect(loginFehlertext(403)).toBe("Konto gesperrt oder noch nicht freigegeben.");
    expect(loginFehlertext(429)).toBe("Zu viele Versuche. Bitte spaeter erneut versuchen.");
    expect(loginFehlertext(500)).toBe("Anmeldung fehlgeschlagen (Status 500).");
  });
});
