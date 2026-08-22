FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable
ENV ONNXRUNTIME_NODE_INSTALL=skip

COPY analysis-tools/package.json analysis-tools/pnpm-lock.yaml /app/analysis-tools/
RUN pnpm --dir /app/analysis-tools install --frozen-lockfile

COPY analysis-tools /app/analysis-tools
RUN pnpm --dir /app/analysis-tools build

COPY analysis-service /app/analysis-service

EXPOSE 8090
CMD ["node", "/app/analysis-service/server.mjs"]
