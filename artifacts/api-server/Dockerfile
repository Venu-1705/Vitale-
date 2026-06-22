# ── Build stage ────────────────────────────────────────────────────────────
# Full Node 22 image with glibc so all native binaries install correctly.
# Build context must be the repo root so workspace packages are available.
FROM node:22-slim AS builder
WORKDIR /workspace

RUN corepack enable

# Copy workspace manifests first to maximise layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Only the packages needed to build the API server.
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Install all deps (frozen — identical to the committed lockfile).
RUN pnpm install --frozen-lockfile

# Bundle everything into dist/index.mjs via esbuild.
RUN pnpm --filter @workspace/api-server build

# ── Runtime stage ──────────────────────────────────────────────────────────
# esbuild bundles all dependencies, so no node_modules needed at runtime.
FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=builder /workspace/artifacts/api-server/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
