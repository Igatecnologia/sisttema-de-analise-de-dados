FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml ./
RUN uv venv .venv && \
    . .venv/bin/activate && \
    uv pip install --no-cache -e ".[dev]"

COPY iga_ai ./iga_ai

# ============================================================

FROM python:3.12-slim AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=builder /app /app

# Non-root user
RUN useradd --create-home --shell /bin/bash iga && \
    chown -R iga:iga /app
USER iga

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:4000/health/live').raise_for_status()" || exit 1

CMD ["uvicorn", "iga_ai.main:app", "--host", "0.0.0.0", "--port", "4000"]
