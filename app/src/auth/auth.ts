import { betterAuth } from "better-auth";
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

/** Spec §5: Login 10 Versuche / 15 min, Reset 3 / h. Better Auth zaehlt je IP und Pfad (alle Versuche, nicht nur Fehlversuche). */
export const RATE_LIMIT = { anmelden: { window: 900, max: 10 }, reset: { window: 3600, max: 3 } } as const;

export type AuthOptionen = { baseURL: string; secret: string; sendeReset?: (email: string, url: string) => Promise<void> };
export function baueAuth(pool: pg.Pool, o: AuthOptionen) {
  const db = drizzle(pool, { schema: authSchema });
  return betterAuth({
    baseURL: o.baseURL, secret: o.secret, trustedOrigins: [o.baseURL],
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema, transaction: true }),
    session: { expiresIn: 43200, updateAge: 43200, cookieCache: { enabled: false } },
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    // Better Auth 1.7.18 (context/create-context.mjs): rateLimit.enabled-Default = isProduction -> explizit true, wirkt so auch unter NODE_ENV=test.
    // Eingebaute Sonderregel "/sign-in*" = 3 / 10 s ueberschreibt window/max -> eigene customRules (gehen den Sonderregeln vor).
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 100,
      customRules: { "/sign-in/*": RATE_LIMIT.anmelden, "/request-password-reset": RATE_LIMIT.reset },
    },
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true, disableSignUp: true, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => { if (!o.sendeReset) throw new Error("Kein Reset-Versand konfiguriert"); await o.sendeReset(user.email, url); },
      password: { hash: hashPasswort, verify: async ({ hash, password }) => a2verify(hash, password) },
    },
  });
}
export type Auth = ReturnType<typeof baueAuth>;
