import { useState, type FormEvent } from "react";
import { ApiFehler, loginFehlertext, sendeJson } from "../api";

export function Login({ onAngemeldet }: { onAngemeldet: () => void }) {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const senden = async (e: FormEvent) => {
    e.preventDefault(); setFehler(null); setLaeuft(true);
    try { await sendeJson("/api/auth/sign-in/email", { email, password: passwort }); onAngemeldet(); }
    catch (x) { setFehler(x instanceof ApiFehler ? loginFehlertext(x.status) : "Server nicht erreichbar."); }
    finally { setLaeuft(false); }
  };
  return (
    <main className="login">
      <form onSubmit={senden} className="karte">
        <h1>Planora</h1>
        <label>E-Mail<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Passwort<input type="password" autoComplete="current-password" required value={passwort} onChange={(e) => setPasswort(e.target.value)} /></label>
        {fehler && <p className="fehler" role="alert">{fehler}</p>}
        <button type="submit" disabled={laeuft}>{laeuft ? "Anmelden …" : "Anmelden"}</button>
      </form>
    </main>
  );
}
