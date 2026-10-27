FROM mcr.microsoft.com/playwright:v1.64.1-noble

ENV CI=true
ENV NODE_ENV=test

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG DOCKER_UID=1000
ARG DOCKER_GID=1000
RUN mkdir -p /workspace/node_modules/.vite /workspace/docker/artifacts \
  && chown "${DOCKER_UID}:${DOCKER_GID}" /workspace \
  && chown -R "${DOCKER_UID}:${DOCKER_GID}" /workspace/node_modules/.vite \
  && chown -R "${DOCKER_UID}:${DOCKER_GID}" /workspace/docker/artifacts

CMD ["npm", "run", "test:e2e"]
