FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN npm run install:all
COPY . .
RUN npm run build --prefix frontend

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_FRONTEND=1
LABEL org.opencontainers.image.source=https://github.com/hualeide/cipher-toolkit
LABEL org.opencontainers.image.description="Cipher Toolkit — 98-algorithm web crypto lab with Chinese-first identification"
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/docs ./docs
COPY --from=build /app/package.json ./
RUN npm install --prefix backend --omit=dev
EXPOSE 3001
CMD ["node", "backend/src/server.js"]
