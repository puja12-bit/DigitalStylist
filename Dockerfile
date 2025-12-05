# Stage 1: Build
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy all files (Now including .env since .dockerignore is gone)
COPY . .

# --- DEBUGGING STEP ---
# This will print the first 4 characters of the key in the build logs.
# If you see "Key Check: AIza...", it works.
# If you see "Key Check: ...", it failed.
RUN if [ -f .env ]; then echo "Key Check: Found .env file!"; else echo "Key Check: ERROR - .env file missing!"; fi
RUN cat .env | head -c 19 && echo "..."
# ----------------------

# Build the app
RUN npm run build || true

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
