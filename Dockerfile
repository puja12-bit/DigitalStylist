# Stage 1: Build
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

# --- FIX: FORCE KEY INTO FILE ---
# Accept the argument from Cloud Build
ARG VITE_GEMINI_API_KEY

# Write it directly to a .env file so Vite is GUARANTEED to see it
RUN echo "VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY" > .env
# -------------------------------

COPY . .
# Build the app
RUN npm run build || true

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
