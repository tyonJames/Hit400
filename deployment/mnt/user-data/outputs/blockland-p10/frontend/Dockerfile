# =============================================================================
# blockland-frontend/Dockerfile
# Next.js 14 with output: 'standalone' — optimal Docker image size.
# The standalone output copies only what Next.js needs, not all node_modules.
# =============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (NEXT_PUBLIC_ are baked in at build, so must be provided here)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STACKS_NETWORK=testnet
ARG NEXT_PUBLIC_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_CONTRACT_NAME=blockland
ARG NEXT_PUBLIC_STACKS_EXPLORER=https://explorer.hiro.so
ARG NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STACKS_NETWORK=$NEXT_PUBLIC_STACKS_NETWORK
ENV NEXT_PUBLIC_CONTRACT_ADDRESS=$NEXT_PUBLIC_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_CONTRACT_NAME=$NEXT_PUBLIC_CONTRACT_NAME
ENV NEXT_PUBLIC_STACKS_EXPLORER=$NEXT_PUBLIC_STACKS_EXPLORER
ENV NEXT_PUBLIC_IPFS_GATEWAY=$NEXT_PUBLIC_IPFS_GATEWAY

RUN npm run build

# Production: minimal Next.js standalone image
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy the standalone server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]

# Development stage
FROM node:20-alpine AS development
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
