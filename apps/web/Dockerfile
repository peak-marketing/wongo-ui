# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder
WORKDIR /repo

RUN corepack enable

# Build-time API base for browser (served behind same domain via Caddy)
ARG NEXT_PUBLIC_API_BASE=/api
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm -C apps/web build

# Create a deployable, production-only directory for the web package
RUN pnpm --filter @repo/web deploy --prod /out/web


FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /out/web/ ./

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","node_modules/next/dist/bin/next","start","-p","3000"]
