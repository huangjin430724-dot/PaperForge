FROM node:20-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci

FROM deps AS build

WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8787 \
    PaperForge_TUNNEL=false \
    PaperForge_DATA_DIR=/app/data

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY apps/backend apps/backend
COPY packages packages
COPY templates templates
COPY static static
COPY --from=build /app/apps/frontend/dist apps/frontend/dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 8787

CMD ["npm", "start"]
