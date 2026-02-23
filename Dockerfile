# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy source code
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build
RUN cd backend && npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY --from=builder /app/backend/dist/ ./backend/dist/
COPY --from=builder /app/shared/ ./shared/

ENV NODE_ENV=production
ENV PORT=4001

EXPOSE 4001

CMD ["node", "backend/dist/main"]
