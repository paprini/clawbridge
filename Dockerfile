FROM node:18-alpine

# Don't run as root
RUN addgroup -S a2a && adduser -S a2a -G a2a

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install production deps only
RUN npm ci --omit=dev && npm cache clean --force

# Copy source
COPY src/ ./src/

# Default config (can be overridden via volume mount)
COPY config/ ./config/

# Own everything by the non-root user
RUN chown -R a2a:a2a /app

USER a2a

EXPOSE 9100

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:9100/health || exit 1

CMD ["node", "src/server.js"]
