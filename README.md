# Pentest Automation Platform

AI-powered platform for automated security testing workflows.

This project provides an orchestrated multi-agent system for penetration testing, with:
- Backend API in Go (REST + GraphQL)
- Frontend in React + TypeScript
- Docker-first deployment
- Optional observability and analytics stacks
- Persistent memory via PostgreSQL + pgvector

## Table of Contents
- Overview
- Key Features
- Architecture
- Quick Start
- Configuration
- Development
- Testing Utilities
- Optional Stacks
- Security Notes
- License

## Overview
Pentest Automation Platform helps security teams automate repetitive penetration testing tasks while keeping humans in control of scope and approval. It combines planning, execution, and reporting into one workflow with isolated tool execution.

## Key Features
- Multi-agent workflow for research, planning, and execution
- Isolated command execution in containers
- Built-in support for common pentesting tools
- Long-term vector memory for context reuse
- REST and GraphQL APIs
- Optional Graphiti knowledge graph integration
- Optional Langfuse and OpenTelemetry observability

## Architecture
Core components:
- Frontend: React + TypeScript UI
- Backend: Go service with REST and GraphQL
- Database: PostgreSQL with pgvector
- Queue and async execution pipeline
- Optional services: Graphiti, Langfuse, Grafana stack

Main flow:
1. Create a flow from UI or API.
2. Agents analyze target and plan steps.
3. Commands run in isolated execution environments.
4. Results are stored, indexed, and streamed back to UI.

## Quick Start
### Prerequisites
- Docker and Docker Compose
- At least 4 GB RAM
- At least 20 GB free disk space

### 1) Clone and prepare files
- Copy environment template:
  cp .env.example .env
- Copy provider examples if needed:
  cp examples/configs/custom-openai.provider.yml example.custom.provider.yml
  cp examples/configs/ollama-llama318b.provider.yml example.ollama.provider.yml

### 2) Set required environment values
In .env, configure at least one LLM provider key, for example:
- OPEN_AI_KEY
or
- ANTHROPIC_API_KEY
or
- GEMINI_API_KEY

### 3) Start core stack
- docker compose up -d

### 4) Open the app
- https://localhost:8443

## Configuration
Important environment groups:
- Core server:
  - PUBLIC_URL
  - SERVER_HOST
  - SERVER_PORT
  - SERVER_USE_SSL
- Database:
  - DATABASE_URL
- LLM providers:
  - OPEN_AI_KEY
  - ANTHROPIC_API_KEY
  - GEMINI_API_KEY
  - BEDROCK_* variables
  - OLLAMA_* variables
- Search providers (optional):
  - DUCKDUCKGO_ENABLED
  - GOOGLE_API_KEY / GOOGLE_CX_KEY
  - TAVILY_API_KEY
  - TRAVERSAAL_API_KEY
  - PERPLEXITY_API_KEY
  - SEARXNG_URL
- OAuth (optional):
  - OAUTH_GOOGLE_CLIENT_ID / OAUTH_GOOGLE_CLIENT_SECRET
  - OAUTH_GITHUB_CLIENT_ID / OAUTH_GITHUB_CLIENT_SECRET

## Development
### Backend
From backend directory:
- go mod download
- go build -trimpath -o pentagi ./cmd/pentagi
- go test ./...

Optional generation:
- GraphQL resolvers:
  go run github.com/99designs/gqlgen --config ./gqlgen/gqlgen.yml
- Swagger docs:
  swag init -g ../../pkg/server/router.go -o pkg/server/docs/ --parseDependency --parseInternal --parseDepth 2 -d cmd/pentagi

### Frontend
From frontend directory:
- npm ci
- npm run dev
- npm run build
- npm run lint
- npm run test

GraphQL types:
- npm run graphql:generate

## Testing Utilities
Included helper binaries:
- ctester: LLM and agent behavior validation
- ftester: function-level and flow-context debugging
- etester: embedding and vector-memory diagnostics
- installer: interactive deployment wizard

Examples:
- Backend test suite:
  cd backend && go test ./...
- Run ctester locally:
  cd backend && go run cmd/ctester/*.go -verbose

## Optional Stacks
### Observability
- docker compose -f docker-compose.yml -f docker-compose-observability.yml up -d

### Langfuse analytics
- docker compose -f docker-compose.yml -f docker-compose-langfuse.yml up -d

### Graphiti knowledge graph
- docker compose -f docker-compose.yml -f docker-compose-graphiti.yml up -d

### All stacks together
- docker compose -f docker-compose.yml -f docker-compose-langfuse.yml -f docker-compose-graphiti.yml -f docker-compose-observability.yml up -d

## Security Notes
- Use this software only on systems you are explicitly authorized to test.
- Rotate API keys and tokens regularly.
- Do not commit secrets into version control.
- Keep .env files private.
- For production, review TLS, network exposure, and access control settings before deployment.

## API Access
- GraphQL endpoint:
  /api/v1/graphql
- REST docs:
  /api/v1/swagger/index.html

Use Bearer tokens created in Settings > API Tokens.

## License
This repository is distributed under the MIT License.
See LICENSE, NOTICE, and EULA.md for details.
