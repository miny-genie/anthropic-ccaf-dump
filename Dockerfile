FROM node:24-bookworm-slim AS build

WORKDIR /app
ENV CI=true

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json .npmrc ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/exam-practice/package.json artifacts/exam-practice/package.json
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY scripts/package.json scripts/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build:host

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/
ENV CLIENT_DIST_DIR=/app/artifacts/exam-practice/dist/public
ENV TIDB_CA_PATH=/app/certs/isrgrootx1.pem

RUN corepack enable

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/artifacts/api-server ./artifacts/api-server
COPY --from=build /app/artifacts/exam-practice/dist ./artifacts/exam-practice/dist
COPY --from=build /app/lib ./lib
COPY --from=build /app/certs ./certs

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
