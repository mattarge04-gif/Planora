# Bauen vom Repository-Root: docker build -f betrieb/backup/Dockerfile .
FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS bau
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/tsconfig.json ./
COPY app/src ./src
RUN node node_modules/typescript/bin/tsc -p src/betrieb/backup/tsconfig.json && npm prune --omit=dev

FROM postgres:18-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl bzip2 libstdc++6 && rm -rf /var/lib/apt/lists/* \
 && curl --fail --location --output /tmp/restic.bz2 https://github.com/restic/restic/releases/download/v0.19.1/restic_0.19.1_linux_amd64.bz2 \
 && echo 'f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c  /tmp/restic.bz2' | sha256sum -c - \
 && bunzip2 /tmp/restic.bz2 && install -m 755 /tmp/restic /usr/local/bin/restic && rm /tmp/restic \
 && curl --fail --location --output /tmp/age.tar.gz https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz \
 && echo 'cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10  /tmp/age.tar.gz' | sha256sum -c - \
 && tar xzf /tmp/age.tar.gz -C /tmp && install -m 755 /tmp/age/age /tmp/age/age-keygen /usr/local/bin/ && rm -rf /tmp/age /tmp/age.tar.gz \
 && useradd --uid 10001 --create-home planora && mkdir /staging /ziel /dokumente && chown planora:planora /staging /ziel /dokumente
COPY --from=bau /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=bau /app/package.json ./
COPY --from=bau /app/node_modules ./node_modules
COPY --from=bau /app/dist ./dist
COPY app/src/db/migrationen ./dist/db/migrationen
USER 10001:10001
ENTRYPOINT ["node", "dist/betrieb/backup/cli.js"]
