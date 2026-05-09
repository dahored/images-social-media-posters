FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN npm install -g @anthropic-ai/claude-code

COPY package.json package-lock.json ./
RUN npm ci

COPY docker/defaults/ /app/data-defaults/
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]

# dev: source mounted as volume, next dev handles hot reload
FROM base AS deps

# prod: bake the build into the image
FROM base AS prod
ARG BUILD_ID
COPY . .
RUN npm run build
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
