FROM node:20-slim AS builder
WORKDIR /app

# Copy root workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy core package
COPY packages/core/package.json ./packages/core/
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/core/src ./packages/core/src

# Copy backend app
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/src ./apps/backend/src

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build core package first (backend depends on it)
RUN pnpm --filter core build

# Build backend and verify dist folder exists
RUN pnpm --filter relevx build && \
    ls -la /app/apps/backend/dist

FROM node:20-slim AS runtime
WORKDIR /app

RUN useradd --user-group --create-home --shell /bin/bash nodeuser

# Install pnpm
RUN npm install -g pnpm

# Copy root workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy core package.json for dependency resolution
COPY packages/core/package.json ./packages/core/

# Copy backend package.json
COPY apps/backend/package.json ./apps/backend/

# Install prod dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist

# RUNtime ENV variables
ENV NODE_ENV=development
EXPOSE 8080
USER nodeuser
CMD ["node", "apps/backend/dist/index.js"]
