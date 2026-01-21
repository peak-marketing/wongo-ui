# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder
WORKDIR /repo

# Enable pnpm via Corepack
RUN corepack enable

# Copy workspace
COPY . .

# Install deps (workspace)
RUN pnpm install --no-frozen-lockfile

# Build API
RUN pnpm -C apps/api build

# Create a deployable, production-only directory for the api package
RUN pnpm --filter @repo/api deploy --prod /out/api


FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# tini for signal handling
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /out/api/ ./

EXPOSE 3001
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","dist/src/main"]
