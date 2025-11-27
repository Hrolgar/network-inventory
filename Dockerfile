# Stage 1: Frontend Builder
FROM oven/bun:latest AS frontend_builder

WORKDIR /app/frontend

COPY frontend/package.json .
COPY frontend/tsconfig.json .
COPY frontend/vite.config.ts .
COPY frontend/bun.lock .
COPY frontend/index.html .

RUN bun install --frozen-lockfile

COPY frontend/src ./src

RUN bun run build

# Stage 2: Python Application
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nmap \
    graphviz \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY inventory_scanner.py .

# Copy built frontend from frontend_builder stage
COPY --from=frontend_builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/health')"

# Run the application
CMD ["python", "app.py"]