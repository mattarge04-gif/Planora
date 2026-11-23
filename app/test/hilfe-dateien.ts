// Testdateien als Buffer (nie auf Platte). Inhalt per `zusatz` eindeutig machen: gleicher sha256 im Gebaeude = Duplikat.
const NL = String.fromCharCode(10);
export const pdf = (seiten = 1, zusatz = "") => Buffer.from(["%PDF-1.7",
  ...Array.from({ length: seiten }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj`),
  `2 0 obj << /Type /Pages /Count ${seiten} >> endobj`, zusatz + "%%EOF"].join(NL));
