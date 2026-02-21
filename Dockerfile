# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install and build the backend
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Install and build the frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./public

RUN npm install --production

EXPOSE 8080

CMD ["npm", "start"]
