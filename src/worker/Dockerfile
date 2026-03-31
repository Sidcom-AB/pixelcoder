FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY knexfile.js ./
COPY migrations/ ./migrations/
COPY src/shared/ ./src/shared/
COPY src/worker/ ./src/worker/
COPY src/soul/ ./src/soul/

CMD ["node", "src/worker/worker.js"]
