# Multi-stage build for smaller final image
# To build run: docker build -f services/scheduler/Dockerfile -t relevx-scheduler .

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Enable corepack for pnpm (built into Node.js)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy core package
COPY packages/core/package.json ./packages/core/
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/core/src ./packages/core/src

# Copy scheduler package
COPY services/scheduler/package.json ./services/scheduler/
COPY services/scheduler/tsconfig.json ./services/scheduler/
COPY services/scheduler/src ./services/scheduler/src


# Install all dependencies and build
ENV CI=true
RUN pnpm install --frozen-lockfile && \
    pnpm --filter core run build && \
    pnpm --filter scheduler run build && \
    pnpm prune --prod && \
    pnpm store prune

# Stage 2: Production stage
FROM node:20-alpine

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy built artifacts and production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder /app/services/scheduler/dist ./services/scheduler/dist
COPY --from=builder /app/services/scheduler/package.json ./services/scheduler/
COPY --from=builder /app/services/scheduler/node_modules ./services/scheduler/node_modules

# Create non-root user and set ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/services/scheduler

ENV NODE_ENV=production
ENV LOG_LEVEL=info

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/services/scheduler/src/index.js"]
