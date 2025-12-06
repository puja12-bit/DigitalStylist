# --- STAGE 1: BUILD THE APP ---
# We start with Node to compile the code
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# --- FIX: INJECT API KEY ---
# Accept the key passed from Cloud Build
ARG VITE_GEMINI_API_KEY
# Force write it to a .env file so Vite CANNOT miss it
RUN echo "VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY" > .env
# ---------------------------

# Copy the rest of the code
COPY . .

# Build the app (This creates the 'dist' folder inside Docker)
RUN npm run build || true

# --- STAGE 2: SERVE THE APP ---
# Now we switch to Nginx
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# Inject GEMINI_API_KEY into env.js at container start
CMD ["/bin/sh", "-c", "echo \"window.__ENV = { GEMINI_API_KEY: '\\\"$GEMINI_API_KEY\\\"' };\" > /usr/share/nginx/html/env.js && nginx -g 'daemon off;'"]


