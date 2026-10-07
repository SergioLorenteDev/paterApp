FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
RUN pnpm install --frozen-lockfile --filter backend...

FROM deps AS builder
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN pnpm prisma:generate
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-eng

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
