FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN npm run install:all
COPY . .
RUN npm run build --prefix frontend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/package.json ./
RUN npm install --prefix backend --omit=dev
EXPOSE 3001
CMD ["node", "backend/src/server.js"]
