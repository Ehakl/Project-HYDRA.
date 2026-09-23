# --- STAGE 1: BUILD THE REACT APP ---
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the production-ready static files (creates the /app/dist folder)
RUN npm run build

# --- STAGE 2: SERVE WITH NGINX ---
FROM nginx:alpine

# Copy the built files from Stage 1 to Nginx's web root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx config (we will create this next)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]