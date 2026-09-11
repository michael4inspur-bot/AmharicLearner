FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
ENV NODE_ENV=production PORT=3000 DATA_FILE=/data/store.json
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "src/index.js"]
