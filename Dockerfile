FROM node:20-alpine

WORKDIR /app

# Primero solo los manifiestos: aprovecha la caché de capas de Docker
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "src/server.js"]