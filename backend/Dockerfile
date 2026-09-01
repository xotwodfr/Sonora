# ---- build stage: compile TS + build better-sqlite3 native binding ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install build toolchain needed to compile better-sqlite3.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# npm 11+ respects allowScripts in package.json so the native binding builds.
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# FFmpeg/ffprobe are required for metadata probing/streaming transcodes.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy deps + compiled output.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Writable data dir (SQLite + artwork cache) + read-only music mount.
ENV PORT=8787 \
    MUSIC_PATH=/music \
    DATA_PATH=/data \
    HOSTNAME=sonora-backend

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 8787
CMD ["node", "dist/index.js"]
