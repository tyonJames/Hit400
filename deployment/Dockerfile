# =============================================================================
# blockland-backend/Dockerfile
# Multi-stage build: deps → build → production
# The "development" target is used by docker-compose for local dev with hot reload.
# =============================================================================

# Stage 1: Install all dependencies (including devDependencies for build)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build TypeScript → JavaScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production — only production deps + compiled output
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3001}/health | grep -q '"status":"ok"' || exit 1

EXPOSE ${PORT:-3001}
CMD ["node", "dist/main.js"]

# Stage 4: Development (used by docker-compose)
FROM node:20-alpine AS development
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]
