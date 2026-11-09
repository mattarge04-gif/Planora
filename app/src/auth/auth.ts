import { betterAuth, APIError, BASE_ERROR_CODES } from "better-auth";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, boolean, timestamp, integer, bigint } from "drizzle-orm/pg-core";
import { hash as a2hash, verify as a2verify } from "@node-rs/argon2";
import type pg from "pg";

export const ARGON = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
// timestamptz: Drizzle (node-postgres) schreibt "timestamp" als UTC-Wandzeit, PostgreSQL-now() rechnet in der Sitzungszeitzone -> mit Zeitzone speichern.
const TZ = { withTimezone: true } as const;
export const hashPasswort = (pw: string) => a2hash(pw, ARGON);
const user = pgTable("user", { id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(), emailVerified: boolean("email_verified").notNull(), image: text("image"), createdAt: timestamp("created_at", TZ).notNull(), updatedAt: timestamp("updated_at", TZ).notNull() });
const session = pgTable("session", { id: text("id").primaryKey(), expiresAt: timestamp("expires_at", TZ).notNull(), token: text("token").notNull().unique(), createdAt: timestamp("created_at", TZ).notNull(), updatedAt: timestamp("updated_at", TZ).notNull(), ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull() });
const account = pgTable("account", { id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), userId: text("user_id").notNull(), accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), accessTokenExpiresAt: timestamp("access_token_expires_at", TZ), refreshTokenExpiresAt: timestamp("refresh_token_expires_at", TZ), scope: text("scope"), password: text("password"), createdAt: timestamp("created_at", TZ).notNull(), updatedAt: timestamp("updated_at", TZ).notNull() });
const verification = pgTable("verification", { id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at", TZ).notNull(), createdAt: timestamp("created_at", TZ), updatedAt: timestamp("updated_at", TZ) });
const rateLimit = pgTable("rate_limit", { id: text("id").primaryKey(), key: text("key").notNull().unique(), count: integer("count").notNull(), lastRequest: bigint("last_request", { mode: "number" }).notNull() });
export const authSchema = { user, session, account, verification, rateLimit };

/**
 * Better-Auth-Rate-Limit (zaehlt alle Anfragen je Client-IP und Pfad): Reset 3 / h (Spec §5); Anmeldung nur als
 * Flutschutz 100 / 15 min [A]. Die Fehlversuchssperre 10 / 15 min je Konto und IP aus Spec §5 setzt die eigene Tabelle
 * anmelde_fehlversuch um (Erfolge zaehlen dort nicht, Buero hinter einer NAT-IP wird nicht durch Erfolge gesperrt).
 */
export const RATE_LIMIT = { anmelden: { window: 900, max: 100 }, reset: { window: 3600, max: 3 } } as const;

/** Interner Header mit der vertrauenswuerdigen Client-IP; registriereAuth ueberschreibt jeden vom Client gelieferten Wert. */
export const CLIENT_IP_HEADER = "x-planora-client-ip";

export const normalisiereEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
/** Zaehlschluessel der Fehlversuchssperre: Konto (normalisierte E-Mail, auch unbekannte) und Client-IP aus registriereAuth. */
const anmeldeSchluessel = (ctx: { body?: any; headers?: Headers; request?: Request }) => {
  const ip = ctx.headers?.get(CLIENT_IP_HEADER) ?? ctx.request?.headers.get(CLIENT_IP_HEADER) ?? "unbekannt";
  return [`konto:${normalisiereEmail(ctx.body?.email)}`, `ip:${ip}`];
};
/** Fehler des Triggers session_regeln (Konto nicht aktiv bei Sitzungsanlage) irgendwo in der cause-Kette? */
const istKontoNichtAktiv = (e: unknown): boolean => {
  for (let x: any = e, i = 0; x && i < 5; x = x.cause, i++) if (typeof x.message === "string" && x.message.includes("konto_nicht_aktiv")) return true;
  return false;
};
/** PP7-4: verweigert die DB die Sitzungsanlage (Sperre parallel zum Login), antwortet Better Auth wie bei falschem Passwort statt 500. */
function kontoSperreAlsAnmeldefehler<T extends (...a: any[]) => any>(fabrik: T): T {
  return ((...a: any[]) => {
    const adapter = fabrik(...a);
    return { ...adapter, create: async (args: any) => {
      try { return await adapter.create(args); }
      catch (e) { if (istKontoNichtAktiv(e)) throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD); throw e; }
    } };
  }) as T;
}

export type AuthOptionen = { baseURL: string; secret: string; sendeReset?: (email: string, url: string) => Promise<void> };
export function baueAuth(pool: pg.Pool, o: AuthOptionen) {
  const db = drizzle(pool, { schema: authSchema });
  return betterAuth({
    baseURL: o.baseURL, secret: o.secret, trustedOrigins: [o.baseURL],
    database: kontoSperreAlsAnmeldefehler(drizzleAdapter(db, { provider: "pg", schema: authSchema, transaction: true })),
    session: { expiresIn: 43200, updateAge: 43200, cookieCache: { enabled: false } },
    // Client-IP nur aus dem von registriereAuth gesetzten Header (Quelle: req.ip), nie aus X-Forwarded-For des Clients (PP7-5)
    advanced: { disableOriginCheck: false, disableCSRFCheck: false, ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } },
    // Better Auth 1.7.18 (context/create-context.mjs): rateLimit.enabled-Default = isProduction -> explizit true, wirkt so auch unter NODE_ENV=test.
    // Eingebaute Sonderregel "/sign-in*" = 3 / 10 s ueberschreibt window/max -> eigene customRules (gehen den Sonderregeln vor).
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 100,
      customRules: { "/sign-in/*": RATE_LIMIT.anmelden, "/request-password-reset": RATE_LIMIT.reset },
    },
    logger: { disabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // PP7-1: Passwortwechsel nur mit Entzug aller anderen Sitzungen (Spec §5)
        if (ctx.path === "/change-password" && ctx.body?.revokeOtherSessions !== true) {
          throw APIError.from("BAD_REQUEST", { code: "REVOKE_OTHER_SESSIONS_REQUIRED", message: "Passwortwechsel nur mit revokeOtherSessions: true" });
        }
        if (ctx.path !== "/sign-in/email") return;
        // PP7-5: Fehlversuchssperre je Konto und IP, atomar reserviert vor der Passwortpruefung
        const schluessel = anmeldeSchluessel(ctx);
        const warte = (await pool.query("select anmeldung_reservieren($1) w", [schluessel])).rows[0].w as number;
        if (warte > 0) throw new APIError("TOO_MANY_REQUESTS", { code: "ZU_VIELE_FEHLVERSUCHE", message: "Zu viele Fehlversuche. Bitte spaeter erneut versuchen." }, { "X-Retry-After": String(warte) });
        // Login-Sperre fuer Status != aktiv (gesperrt, zu_bestaetigen; Spec §5, §15.2): gleiche Antwort wie falsches Passwort,
        // Passwort wird trotzdem gehasht (gleiches Zeitverhalten wie der Pfad "Benutzer unbekannt" in Better Auth).
        const r = await pool.query(`select ks.status from konto_status ks join "user" u on u.id = ks.benutzer_id where u.email = $1`, [normalisiereEmail(ctx.body?.email)]);
        if (r.rowCount === 1 && r.rows[0].status !== "aktiv") {
          await hashPasswort(String(ctx.body?.password ?? ""));
          await pool.query("select anmeldung_abschliessen($1, false)", [schluessel]);
          throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const erfolg = !isAPIError(ctx.context.returned) && !!ctx.context.newSession;
        await pool.query("select anmeldung_abschliessen($1, $2)", [anmeldeSchluessel(ctx), erfolg]);
      }),
    },
    emailAndPassword: {
      enabled: true, disableSignUp: true, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => { if (!o.sendeReset) throw new Error("Kein Reset-Versand konfiguriert"); await o.sendeReset(user.email, url); },
      password: { hash: hashPasswort, verify: async ({ hash, password }) => a2verify(hash, password) },
    },
  });
}
export type Auth = ReturnType<typeof baueAuth>;
