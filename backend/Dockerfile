# Backend Dockerfile
# Use Debian-based image instead of Alpine to get OpenSSL 3.x,
# which is compatible with Prisma query engine out of the box.
FROM node:20 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
# Install dependencies (npm ci if lockfile exists, otherwise npm install)
# Use --legacy-peer-deps to handle peer dependency conflicts
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

# Generate Prisma Client
FROM deps AS prisma
RUN npx prisma generate

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy necessary files
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=prisma --chown=nestjs:nodejs /app/prisma ./prisma

# Copy entrypoint script (before USER switch to set permissions)
COPY --from=builder --chown=nestjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Switch to non-root user
USER nestjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]

