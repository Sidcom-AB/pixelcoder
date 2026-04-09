FROM node:20-alpine

WORKDIR /app

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=${BUILD_VERSION}

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY knexfile.js ./
COPY migrations/ ./migrations/
COPY src/shared/ ./src/shared/
COPY src/web/ ./src/web/

EXPOSE 3000

CMD ["node", "src/web/server.js"]
