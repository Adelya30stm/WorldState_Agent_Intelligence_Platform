# syntax=docker/dockerfile:1.4

# ========================================
# Stage 1: Frontend Application Build
# ========================================
FROM node:23-slim AS frontend-compiler

# Production build configuration
ENV NODE_ENV=production
ENV VITE_BUILD_MEMORY_LIMIT=4096
ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app/ui

# Install build essentials
RUN apt-get update && apt-get install -y \
    ca-certificates \
    tzdata \
    gcc \
    g++ \
    make \
    git

# GraphQL schema for code generation
COPY ./backend/pkg/graph/schema.graphqls ../backend/pkg/graph/

# Cache bust token — pass --build-arg FRONTEND_CACHE_BUST=$(date +%s) to force
# rebuilding only the frontend stage without touching the slow Go backend.
# Default value keeps normal cache behaviour when the arg is not provided.
ARG FRONTEND_CACHE_BUST=0

# Application source code (invalidated by FRONTEND_CACHE_BUST or real file changes)
COPY frontend/ .

# Install dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# Generate license report for frontend dependencies
RUN npm install -g license-checker && \
    mkdir -p /licenses/frontend && \
    license-checker --production --json > /licenses/frontend/licenses.json && \
    license-checker --production --csv > /licenses/frontend/licenses.csv

# Build frontend
RUN npm run build -- \
    --mode production \
    --minify esbuild \
    --outDir dist \
    --emptyOutDir \
    --sourcemap false \
    --target es2020

# ========================================
# Stage 2: Backend Services Compilation
# ========================================
FROM golang:1.24-bookworm AS api-builder

# Version injection arguments
ARG PACKAGE_VER=develop
ARG PACKAGE_REV=

# Static binary compilation settings
ENV CGO_ENABLED=0
ENV GO111MODULE=on

# Install compilation toolchain and dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    tzdata \
    gcc \
    g++ \
    make \
    git \
    musl-dev

WORKDIR /app/backend

COPY backend/ .

# Fetch Go module dependencies (cached for faster rebuilds)
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download && go mod verify

# Install go-licenses tool for license extraction (best-effort: the license CSV
# step below already tolerates its absence, so a transient install failure here
# must not fail the whole image build).
RUN --mount=type=cache,target=/go/pkg/mod \
    go install github.com/google/go-licenses@latest || true

# Generate license reports for backend dependencies
RUN mkdir -p /licenses/backend && \
    go list -m all > /licenses/backend/dependencies.txt && \
    GOROOT=$(go env GOROOT) GOTOOLCHAIN=auto go-licenses csv ./cmd/pentagi > /licenses/backend/licenses.csv 2>/dev/null || true

# Compile main application binary with embedded version metadata
RUN go build -trimpath \
    -ldflags "\
        -X pentagi/pkg/version.PackageName=redscope \
        -X pentagi/pkg/version.PackageVer=${PACKAGE_VER} \
        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV}" \
    -o /redscope ./cmd/pentagi

# Build ctester utility
RUN go build -trimpath \
    -ldflags "\
        -X pentagi/pkg/version.PackageName=ctester \
        -X pentagi/pkg/version.PackageVer=${PACKAGE_VER} \
        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV}" \
    -o /ctester ./cmd/ctester

# Build ftester utility
RUN go build -trimpath \
    -ldflags "\
        -X pentagi/pkg/version.PackageName=ftester \
        -X pentagi/pkg/version.PackageVer=${PACKAGE_VER} \
        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV}" \
    -o /ftester ./cmd/ftester

# Build etester utility
RUN go build -trimpath \
    -ldflags "\
        -X pentagi/pkg/version.PackageName=etester \
        -X pentagi/pkg/version.PackageVer=${PACKAGE_VER} \
        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV}" \
    -o /etester ./cmd/etester

# ========================================
# Stage 3: Production Runtime Environment
# ========================================
FROM alpine:3.23.3

# Establish non-privileged execution context with docker socket access
RUN addgroup -g 998 docker && \
    addgroup -S redscope && \
    adduser -S redscope -G redscope && \
    addgroup redscope docker

# Install required packages
RUN apk --no-cache add ca-certificates openssl openssh-keygen shadow

ADD scripts/entrypoint.sh /opt/redscope/bin/

RUN sed -i 's/\r//' /opt/redscope/bin/entrypoint.sh && \
    chmod +x /opt/redscope/bin/entrypoint.sh

RUN mkdir -p \
    /root/.ollama \
    /opt/redscope/bin \
    /opt/redscope/ssl \
    /opt/redscope/fe \
    /opt/redscope/logs \
    /opt/redscope/data \
    /opt/redscope/conf && \
    chmod 777 /root/.ollama

COPY --from=api-builder /redscope /opt/redscope/bin/redscope
COPY --from=api-builder /ctester /opt/redscope/bin/ctester
COPY --from=api-builder /ftester /opt/redscope/bin/ftester
COPY --from=api-builder /etester /opt/redscope/bin/etester
COPY --from=frontend-compiler /app/ui/dist /opt/redscope/fe
COPY --from=api-builder /licenses/backend /opt/redscope/licenses/backend
COPY --from=frontend-compiler /licenses/frontend /opt/redscope/licenses/frontend

# Copy provider configuration files
COPY examples/configs/custom-openai.provider.yml /opt/redscope/conf/
COPY examples/configs/deepinfra.provider.yml /opt/redscope/conf/
COPY examples/configs/deepseek.provider.yml /opt/redscope/conf/
COPY examples/configs/moonshot.provider.yml /opt/redscope/conf/
COPY examples/configs/ollama-cloud.provider.yml /opt/redscope/conf/
COPY examples/configs/ollama-llama318b-instruct.provider.yml /opt/redscope/conf/
COPY examples/configs/ollama-llama318b.provider.yml /opt/redscope/conf/
COPY examples/configs/ollama-qwen332b-fp16-tc.provider.yml /opt/redscope/conf/
COPY examples/configs/ollama-qwq32b-fp16-tc.provider.yml /opt/redscope/conf/
COPY examples/configs/openrouter.provider.yml /opt/redscope/conf/
COPY examples/configs/novita.provider.yml /opt/redscope/conf/
COPY examples/configs/vllm-qwen3.5-27b-fp8.provider.yml /opt/redscope/conf/
COPY examples/configs/vllm-qwen3.5-27b-fp8-no-think.provider.yml /opt/redscope/conf/
COPY examples/configs/vllm-qwen332b-fp16.provider.yml /opt/redscope/conf/

COPY LICENSE /opt/redscope/LICENSE
COPY NOTICE /opt/redscope/NOTICE
COPY EULA.md /opt/redscope/EULA
COPY EULA.md /opt/redscope/fe/EULA.md

RUN chown -R redscope:redscope /opt/redscope

WORKDIR /opt/redscope

USER redscope

ENTRYPOINT ["/opt/redscope/bin/entrypoint.sh", "/opt/redscope/bin/redscope"]

LABEL org.opencontainers.image.title="redscope"
LABEL org.opencontainers.image.description="Automated penetration testing platform powered by AI agents — RedScope by Безопасная Разработка"
LABEL org.opencontainers.image.vendor="Безопасная Разработка"
LABEL org.opencontainers.image.authors="Adelya Ibragimova <adelina.30stm666@gmail.com>"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.licenses="MIT"
