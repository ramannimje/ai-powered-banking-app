#!/bin/bash

# AI Smart Bank - Quick Start Script
# Run this to get everything up and running

set -e

echo "🚀 AI Smart Bank - Setting up..."

# Check for .env
if [ ! -f backend/.env ]; then
  echo "📝 Creating .env from example..."
  cp backend/.env.example backend/.env
  echo "⚠️  Please fill in your .env file with real values (especially OPENAI_API_KEY and Google OAuth credentials)"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker Desktop first."
  exit 1
fi

echo "🐳 Starting Docker services (Postgres, Redis, RabbitMQ)..."
docker compose up -d postgres redis rabbitmq

echo "⏳ Waiting for services to be healthy..."
sleep 5

echo "📦 Installing backend dependencies..."
cd backend
pip install -q -r requirements.txt 2>/dev/null || true

echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env with your API keys"
echo "  2. Run: docker compose up"
echo "  3. In another terminal: cd frontend && npm run dev"
echo ""
echo "Services:"
echo "  API:      http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  RabbitMQ: http://localhost:15672 (admin/aisb_secret)"
echo "  pgAdmin:  http://localhost:5050"
echo ""