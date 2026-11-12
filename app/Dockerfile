# Planora App-Image: ein Image, drei Startbefehle (api = Standard, worker, migrator) plus Host-Konsole.
# Basis mit Digest gepinnt (kein latest). Bei Aktualisierung Tag UND Digest gemeinsam aendern.
ARG NODE_IMAGE=node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9

# --- Bau: TypeScript -> JavaScript mit tsc. Begruendung (statt tsx zur Laufzeit): im Laufzeit-Image liegen weder
# Compiler noch esbuild noch Dev-Abhaengigkeiten; Typfehler brechen den Build, nicht den Start beim Kunden.
FROM ${NODE_IMAGE} AS bau
WORKDIR /bau
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
RUN npx tsc --outDir dist --rootDir src --target ES2023 --module NodeNext --moduleResolution NodeNext \
      --strict --esModuleInterop --skipLibCheck $(find src -name '*.ts') \
 && mkdir -p dist/db && cp -r src/db/migrationen dist/db/migrationen

# --- Frontend: Vite-Build, nur das Ergebnis dist/ geht ins Laufzeit-Image (keine Build-Werkzeuge).
FROM ${NODE_IMAGE} AS web-bau
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web ./
RUN npm run build

# --- Laufzeit-Abhaengigkeiten ohne Dev-Pakete, exakt nach Lockfile
FROM ${NODE_IMAGE} AS abh
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 # better-auth hat vitest als optionalen Peer; npm behandelt dessen Baum als devOptional.
 # Explizites Entfernen verhindert, dass Test-/Buildwerkzeuge ins Produktionsimage gelangen.
 && npm rm --no-save --omit=dev --omit=peer --no-audit --no-fund vitest tsx \
 && npm cache clean --force

# --- Laufzeit
FROM ${NODE_IMAGE}
ARG PLANORA_RELEASE=dev
ENV NODE_ENV=production PLANORA_RELEASE=${PLANORA_RELEASE}
WORKDIR /app
COPY --from=abh /app/node_modules ./node_modules
COPY --from=abh /app/package.json ./package.json
COPY --from=bau /bau/dist ./dist
COPY --from=web-bau /web/dist ./web
ENV PLANORA_WEB_DIR=/app/web
# Ablagewurzel = Mountpunkt des Volumes `dokumente` (Spec §6, PP8-6): nur fuer den App-Benutzer beschreibbar.
RUN mkdir -p /daten/dokumente && chown node:node /daten/dokumente && chmod 0700 /daten/dokumente
USER node
EXPOSE 3000
# Gilt fuer api; worker/migrator/konsole schalten den Healthcheck in compose.yaml ab.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PLANORA_PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/start/api.js"]
