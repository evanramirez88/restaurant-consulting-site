# =============================================================================
# BROWSER-SERVICE - Playwright + Puppeteer Headless Chrome
# =============================================================================
# Multi-browser automation service with:
# - Playwright (primary): reliable automation, modern APIs
# - Puppeteer (secondary): network interception, legacy support
# =============================================================================

FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Set working directory
WORKDIR /app

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r browser && useradd -r -g browser -G audio,video browser \
    && mkdir -p /home/browser/Downloads \
    && chown -R browser:browser /home/browser

# Copy package files first for Docker layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p /data/screenshots /data/sessions \
    && chown -R browser:browser /data \
    && chown -R browser:browser /app

# Switch to non-root user
USER browser

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -q --spider http://localhost:3000/health || exit 1

# Expose API port
EXPOSE 3000

# Use dumb-init to handle signals properly (zombie process prevention)
ENTRYPOINT ["dumb-init", "--"]

# Start the service
CMD ["node", "src/server.js"]
