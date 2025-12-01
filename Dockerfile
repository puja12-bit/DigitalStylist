cat << 'EOF' > Dockerfile
# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app source
COPY . .

# Build the Vite app
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine

# Use our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static build output
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run will send traffic to this port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
EOF
