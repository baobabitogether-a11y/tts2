FROM node:22-bookworm

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
