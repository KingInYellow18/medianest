# MediaNest Backend Dockerfile
# Implements :ContainerOrchestration pattern for :Flask v3.x + :Python v3.11+
# Supports development workflow with hot-reload capabilities

# Use Python 3.11+ official slim image for security and size optimization
FROM python:3.11-slim

# Set environment variables for Python optimization and Flask configuration
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    FLASK_APP=app.py \
    FLASK_ENV=development \
    FLASK_DEBUG=1

# Create non-root user for security (:SecurityFirst principle)
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

# Set working directory
WORKDIR /app

# Install system dependencies required for Python packages
# Update package lists and install essential build tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libc6-dev \
        libffi-dev \
        libssl-dev \
        curl \
        && rm -rf /var/lib/apt/lists/* \
        && apt-get clean

# Copy requirements file first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
# Use --no-cache-dir to reduce image size and avoid :MemoryLeak
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create necessary directories with proper permissions
RUN mkdir -p /app/config /app/logs && \
    chown -R appuser:appuser /app

# Switch to non-root user (:SecurityFirst - mitigate :SecurityVulnerability)
USER appuser

# Copy application code (excluding sensitive files via .dockerignore)
COPY --chown=appuser:appuser . .

# Expose Flask development server port
EXPOSE 5000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Default command for Flask development server with hot-reload
# Supports development workflow with volume mounting
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000", "--reload"]