# ── Stage 1: Node.js build ───────────────────────────────────────────────────
FROM node:20-alpine AS node-builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Final image (Node + Python in same Alpine) ───────────────────────
FROM node:20-alpine

# Install Python 3 + build deps needed by matplotlib/numpy
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    py3-wheel \
    gcc \
    musl-dev \
    python3-dev \
    freetype-dev \
    libpng-dev \
    openblas-dev \
    lapack-dev \
    g++

ENV NODE_ENV=development
WORKDIR /app

# Node artefacts
COPY --from=node-builder /app/package*.json ./
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/frontend/dist ./public
RUN npm install --production

# Python sidecar source
COPY charts-service/ ./charts-service/

# Install Python deps directly into the Alpine system Python
# (avoids cross-distro site-packages path mismatch)
RUN pip3 install --no-cache-dir --break-system-packages \
    fastapi==0.111.0 \
    "uvicorn[standard]==0.29.0" \
    matplotlib==3.9.0 \
    seaborn==0.13.2 \
    numpy==1.26.4 \
    networkx==3.3 \
    pandas==2.2.2 \
    Pillow==10.3.0 \
    pydantic==2.7.1 \
    plotly==5.22.0 \
    kaleido==0.2.1

# Startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 8080

CMD ["./start.sh"]
