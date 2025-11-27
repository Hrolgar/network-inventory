#!/bin/bash

# Network Inventory Dashboard - Quick Start Script

echo "=========================================="
echo "  Network Inventory Dashboard"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env not found!"
    echo ""
    echo "Please create .env first:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    echo ""
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "❌ Docker Compose is not installed!"
    echo "Please install Docker Compose first"
    exit 1
fi

# Build and start
echo "🐳 Building Docker image..."
$COMPOSE_CMD build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "🚀 Starting dashboard..."
$COMPOSE_CMD up -d

if [ $? -ne 0 ]; then
    echo "❌ Start failed!"
    exit 1
fi

echo ""
echo "=========================================="
echo "  Dashboard is running!"
echo "=========================================="
echo ""
echo "  📊 Access at: http://localhost:5000"
echo ""
echo "  Useful commands:"
echo "    View logs:   $COMPOSE_CMD logs -f"
echo "    Stop:        $COMPOSE_CMD down"
echo "    Restart:     $COMPOSE_CMD restart"
echo "    Status:      $COMPOSE_CMD ps"
echo ""
echo "=========================================="
