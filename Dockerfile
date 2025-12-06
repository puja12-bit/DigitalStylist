# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# On container start, generate env.js from GEMINI_API_KEY env var, then start nginx
CMD ["/bin/sh", "-c", "printf 'window.__ENV = { GEMINI_API_KEY: \"%s\" };\n' \"$GEMINI_API_KEY\" > /usr/share/nginx/html/env.js && nginx -g 'daemon off;'"]
