# Stage 1: Build
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

# --- CRITICAL CHANGE START ---
# Define the argument (variable) that will be passed during build
ARG VITE_GEMINI_API_KEY

# Set it as an environment variable so the 'npm run build' process can see it
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
# --- CRITICAL CHANGE END ---

COPY . .
# Now when Vite builds, it will see the key and bake it in
RUN npm run build || true

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
