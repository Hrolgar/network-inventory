.PHONY: help install test lint format clean dev build docker-build docker-up docker-down

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Installation
install: ## Install all dependencies (backend + frontend)
	pip install -r requirements.txt
	cd frontend && bun install

install-dev: install ## Install all dependencies including dev tools
	pre-commit install
	@echo "✅ All dependencies installed!"
	@echo "✅ Pre-commit hooks installed"

# Testing
test: ## Run all tests (backend + frontend)
	@echo "Running backend tests..."
	pytest -v
	@echo "\nRunning frontend tests..."
	cd frontend && bun test

test-cov: ## Run tests with coverage
	@echo "Running backend tests with coverage..."
	pytest --cov=. --cov-report=html --cov-report=term
	@echo "\nRunning frontend tests with coverage..."
	cd frontend && bun test:coverage

test-backend: ## Run only backend tests
	pytest -v

test-frontend: ## Run only frontend tests
	cd frontend && bun test

# Code Quality
lint: ## Run all linters
	@echo "No linters configured (linting handled by pre-commit hooks)"

lint-fix: ## Run linters with auto-fix
	@echo "No linters configured (linting handled by pre-commit hooks)"

format: lint-fix ## Alias for lint-fix

# Development
dev-backend: ## Run backend development server
	python3 app.py

dev-frontend: ## Run frontend development server
	cd frontend && bun start

dev: ## Run both backend and frontend (requires tmux or run in separate terminals)
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals"

# Build
build-frontend: ## Build frontend for production
	cd frontend && bun run build

build: build-frontend ## Build everything for production

# Docker
docker-build: ## Build Docker image locally
	docker compose build

docker-up: ## Start Docker containers
	docker compose up -d

docker-down: ## Stop Docker containers
	docker compose down

docker-logs: ## View Docker container logs
	docker compose logs -f

docker-rebuild: ## Rebuild and restart Docker containers
	docker compose down
	docker compose build --no-cache
	docker compose up -d

# Database
db-cleanup: ## Cleanup old historical data (30 days)
	@echo "Cleaning up data older than 30 days..."
	curl -X POST http://localhost:5000/api/history/cleanup?days=30

# Cleaning
clean: ## Clean generated files and caches
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf htmlcov/ .coverage coverage.xml
	rm -rf frontend/dist/ frontend/coverage/ frontend/.vitest/
	@echo "Cleaned build artifacts and caches"

clean-all: clean ## Clean everything including logs and database
	rm -rf logs/ data/
	@echo "Cleaned all generated files"

# Validation
validate: ## Validate configuration
	python3 config_validator.py

# Quick start
quickstart: install build ## Install, build, and provide next steps
	@echo "\n✅ Setup complete!"
	@echo "\nNext steps:"
	@echo "  1. Copy .env.example to .env and configure"
	@echo "  2. Run 'make dev-backend' to start the backend"
	@echo "  3. Run 'make dev-frontend' in another terminal for development"
	@echo "  4. Or run 'make docker-up' to use Docker"

# CI/CD simulation
ci: test ## Run CI/CD checks locally
	@echo "\n✅ All CI checks passed!"
