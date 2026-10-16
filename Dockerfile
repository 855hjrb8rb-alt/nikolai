# Para cualquier VPS: docker build -t nikolai . && docker run -d -p 3000:3000 \
#   -e QUANT_PASSWORD=... -e QUANT_SECRET=... -e ANTHROPIC_API_KEY=... -v nikolai-data:/data nikolai
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production QUANT_DATA_DIR=/data QUANT_HOME=1
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
