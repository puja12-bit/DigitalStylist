# Stage 1: Build the App inside Docker
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# --- KEY INJECTION STRATEGY ---
# 1. Accept the key from Cloud Build
ARG VITE_GEMINI_API_KEY
# 2. Write it to a file so Vite GUARANTEED sees it
RUN echo "VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY" > .env
# ------------------------------

COPY . .

# Build the app (Vite will read the .env file we just made)
RUN npm run build || true

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Now we copy from 'build' stage, so 'dist' is guaranteed to exist
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
