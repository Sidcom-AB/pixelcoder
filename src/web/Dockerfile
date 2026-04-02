FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY knexfile.js ./
COPY migrations/ ./migrations/
COPY seeds/ ./seeds/
COPY src/shared/ ./src/shared/
COPY src/web/ ./src/web/

EXPOSE 3000

CMD ["node", "src/web/server.js"]
