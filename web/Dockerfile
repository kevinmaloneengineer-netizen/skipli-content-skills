# Build context: the repo root (see deploy/docker-compose.yml), so the image also gets skills/.
# Build the React client, then run the Node API (which also serves client/dist).
FROM node:24-alpine AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/vite.config.js ./
COPY web/client ./client
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 SKILLS_DIR=/skills PYTHON=python3
# The scan scripts (skills/*/scripts, Python) and the "AI xem video" step (yt-dlp + ffmpeg) run in here.
RUN apk add --no-cache python3 py3-numpy py3-pillow ffmpeg tzdata yt-dlp
COPY web/package.json web/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY web/server ./server
COPY skills /skills
COPY --from=build /app/client/dist ./client/dist
# videos + uploads (mount a volume here to keep them)
RUN mkdir -p /app/.data && chown node /app/.data
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
