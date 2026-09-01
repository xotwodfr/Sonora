# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime: nginx serves the SPA + proxies /api to the backend ----
FROM nginx:stable-bookworm AS runtime
WORKDIR /usr/share/nginx/html

# Copy the Vite build output.
COPY --from=build /app/dist .

# SPA config: all non-file routes → index.html; /api proxied to backend.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
