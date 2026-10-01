FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat openssl build-base python3
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Migration runner
FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY scripts ./scripts
COPY lib ./lib
COPY package.json tsconfig.json ./
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# Development image
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Build-time placeholder so the production AUTH_SECRET guard passes during
# page-data collection; the real secret is injected at runtime via env_file.
ENV AUTH_SECRET=build-time-placeholder
RUN npm run build

# Production runner
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

ENV LOCAL_UPLOAD_DIR=/app/uploads
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
