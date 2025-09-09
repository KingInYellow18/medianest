# ==============================================================================
# 🐳 MEDIANEST DOCKER BAKE CONFIGURATION
# ==============================================================================
# Advanced BuildKit configuration with multi-architecture support,
# sophisticated caching, and comprehensive build matrices
# ==============================================================================

variable "NODE_VERSION" {
  default = "20"
}

variable "ALPINE_VERSION" {
  default = "3.18"
}

variable "NGINX_VERSION" {
  default = "1.25"
}

variable "PYTHON_VERSION" {
  default = "3.11"
}

variable "TAG_PREFIX" {
  default = "medianest"
}

variable "REGISTRY" {
  default = "ghcr.io/medianest"
}

variable "PLATFORMS" {
  default = ["linux/amd64", "linux/arm64"]
}

variable "SECURITY_LEVEL" {
  default = "standard"
}

variable "BUILD_VERSION" {
  default = "dev"
}

variable "CACHE_REGISTRY" {
  default = "ghcr.io/medianest/cache"
}

# ==============================================================================
# 🎯 BUILD GROUPS
# ==============================================================================
group "default" {
  targets = ["backend-production", "frontend-production"]
}

group "all" {
  targets = [
    "backend-production", 
    "frontend-production", 
    "nginx-production",
    "security-hardened"
  ]
}

group "development" {
  targets = ["development", "test-runner"]
}

group "production" {
  targets = [
    "backend-production", 
    "frontend-production", 
    "nginx-production"
  ]
}

group "security" {
  targets = ["security-hardened", "security-scanner"]
}

group "utilities" {
  targets = [
    "migration-runner",
    "build-tools",
    "security-scanner"
  ]
}

# ==============================================================================
# 🔧 BASE TARGET CONFIGURATION
# ==============================================================================
target "_base" {
  dockerfile = "Dockerfile"
  contexts = {
    src = "."
  }
  
  args = {
    NODE_VERSION = NODE_VERSION
    ALPINE_VERSION = ALPINE_VERSION
    NGINX_VERSION = NGINX_VERSION
    PYTHON_VERSION = PYTHON_VERSION
    BUILD_VERSION = BUILD_VERSION
  }
  
  labels = {
    "org.opencontainers.image.title" = "MediaNest"
    "org.opencontainers.image.description" = "Advanced Media Management Platform"
    "org.opencontainers.image.version" = BUILD_VERSION
    "org.opencontainers.image.authors" = "MediaNest Team"
    "org.opencontainers.image.vendor" = "MediaNest"
    "org.opencontainers.image.url" = "https://medianest.com"
    "org.opencontainers.image.documentation" = "https://docs.medianest.com"
    "org.opencontainers.image.source" = "https://github.com/medianest/medianest"
    "org.opencontainers.image.created" = "${formatdate("YYYY-MM-DD'T'hh:mm:ss'Z'", timestamp())}"
    "build.version" = BUILD_VERSION
  }
  
  platforms = PLATFORMS
}

# ==============================================================================
# 🚀 PRODUCTION TARGETS
# ==============================================================================
target "backend-production" {
  inherits = ["_base"]
  target = "backend-production"
  tags = [
    "${TAG_PREFIX}:backend",
    "${TAG_PREFIX}:backend-${BUILD_VERSION}",
    equal(BUILD_VERSION, "latest") ? "${REGISTRY}:backend" : "${REGISTRY}:backend-${BUILD_VERSION}"
  ]
  
  args = {
    NODE_ENV = "production"
    BUILD_TARGET = "backend-production"
    SECURITY_LEVEL = SECURITY_LEVEL
    OPTIMIZATION_LEVEL = "size"
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:backend-production",
    "type=gha,scope=backend-production"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:backend-production,mode=max",
    "type=gha,scope=backend-production,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "backend-production"
    "build.optimization" = "size"
  }
}

target "frontend-production" {
  inherits = ["_base"]
  target = "frontend-production"
  tags = [
    "${TAG_PREFIX}:frontend",
    "${TAG_PREFIX}:frontend-${BUILD_VERSION}",
    equal(BUILD_VERSION, "latest") ? "${REGISTRY}:frontend" : "${REGISTRY}:frontend-${BUILD_VERSION}"
  ]
  
  args = {
    NODE_ENV = "production"
    BUILD_TARGET = "frontend-production"
    OPTIMIZATION_LEVEL = "size"
    ENABLE_TELEMETRY = "false"
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:frontend-production",
    "type=gha,scope=frontend-production"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:frontend-production,mode=max",
    "type=gha,scope=frontend-production,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "frontend-production"
    "build.framework" = "nextjs"
  }
}

target "nginx-production" {
  inherits = ["_base"]
  target = "nginx-production"
  tags = [
    "${TAG_PREFIX}:nginx",
    "${TAG_PREFIX}:nginx-${BUILD_VERSION}",
    equal(BUILD_VERSION, "latest") ? "${REGISTRY}:nginx" : "${REGISTRY}:nginx-${BUILD_VERSION}"
  ]
  
  args = {
    NGINX_VERSION = NGINX_VERSION
    SECURITY_LEVEL = SECURITY_LEVEL
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:nginx-production",
    "type=gha,scope=nginx-production"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:nginx-production,mode=max",
    "type=gha,scope=nginx-production,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "nginx-production"
    "build.proxy" = "reverse-proxy"
  }
}

# ==============================================================================
# 🔒 SECURITY TARGETS
# ==============================================================================
target "security-hardened" {
  inherits = ["_base"]
  target = "security-hardened"
  tags = [
    "${TAG_PREFIX}:secure",
    "${TAG_PREFIX}:secure-${BUILD_VERSION}",
    equal(BUILD_VERSION, "latest") ? "${REGISTRY}:secure" : "${REGISTRY}:secure-${BUILD_VERSION}"
  ]
  
  args = {
    NODE_ENV = "production"
    BUILD_TARGET = "security-hardened"
    SECURITY_LEVEL = "hardened"
    ENABLE_SECURITY_SCANNING = "true"
    OPTIMIZATION_LEVEL = "security"
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:security-hardened",
    "type=gha,scope=security-hardened"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:security-hardened,mode=max",
    "type=gha,scope=security-hardened,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "security-hardened"
    "build.security" = "hardened"
    "security.level" = "maximum"
  }
}

target "security-scanner" {
  inherits = ["_base"]
  target = "security-scanner"
  tags = [
    "${TAG_PREFIX}:scanner",
    "${TAG_PREFIX}:scanner-${BUILD_VERSION}"
  ]
  
  args = {
    ALPINE_VERSION = ALPINE_VERSION
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:security-scanner"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:security-scanner,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "security-scanner"
    "build.purpose" = "security-scanning"
  }
}

# ==============================================================================
# 🛠️ DEVELOPMENT TARGETS
# ==============================================================================
target "development" {
  inherits = ["_base"]
  target = "development"
  tags = [
    "${TAG_PREFIX}:dev",
    "${TAG_PREFIX}:development"
  ]
  
  args = {
    NODE_ENV = "development"
    BUILD_TARGET = "development"
    ENABLE_DEBUG = "true"
    ENABLE_HOT_RELOAD = "true"
    ENABLE_MONITORING = "true"
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:development",
    "type=gha,scope=development"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:development,mode=max",
    "type=gha,scope=development,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "development"
    "build.environment" = "development"
    "build.hot-reload" = "enabled"
  }
}

target "test-runner" {
  inherits = ["_base"]
  target = "test-runner"
  tags = [
    "${TAG_PREFIX}:test",
    "${TAG_PREFIX}:test-${BUILD_VERSION}"
  ]
  
  args = {
    NODE_ENV = "test"
    BUILD_TARGET = "test-runner"
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:test-runner"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:test-runner,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "test-runner"
    "build.purpose" = "testing"
  }
}

# ==============================================================================
# 📚 DOCUMENTATION TARGET
# ==============================================================================
target "docs-builder" {
  inherits = ["_base"]
  target = "docs-builder"
  tags = [
    "${TAG_PREFIX}:docs",
    "${TAG_PREFIX}:docs-${BUILD_VERSION}"
  ]
  
  args = {
    PYTHON_VERSION = PYTHON_VERSION
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:docs-builder"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:docs-builder,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "docs-builder"
    "build.purpose" = "documentation"
    "docs.generator" = "mkdocs"
  }
}

# ==============================================================================
# 🔧 UTILITY TARGETS
# ==============================================================================
target "migration-runner" {
  inherits = ["_base"]
  target = "migration-runner"
  tags = [
    "${TAG_PREFIX}:migrate",
    "${TAG_PREFIX}:migrate-${BUILD_VERSION}"
  ]
  
  args = {
    NODE_ENV = "production"
    BUILD_TARGET = "migration-runner"
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:migration-runner"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:migration-runner,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "migration-runner"
    "build.purpose" = "database-migration"
  }
}

target "build-tools" {
  inherits = ["_base"]
  target = "build-tools"
  tags = [
    "${TAG_PREFIX}:tools",
    "${TAG_PREFIX}:build-tools"
  ]
  
  args = {
    NODE_ENV = "production"
    BUILD_TARGET = "build-tools"
  }
  
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}:build-tools"
  ]
  
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}:build-tools,mode=max"
  ]
  
  output = ["type=docker"]
  
  labels = {
    "build.target" = "build-tools"
    "build.purpose" = "ci-cd-tools"
  }
}

# ==============================================================================
# 🌍 MULTI-ARCHITECTURE MATRIX
# ==============================================================================
target "backend-production-amd64" {
  inherits = ["backend-production"]
  platforms = ["linux/amd64"]
  tags = ["${TAG_PREFIX}:backend-amd64"]
}

target "backend-production-arm64" {
  inherits = ["backend-production"]
  platforms = ["linux/arm64"]
  tags = ["${TAG_PREFIX}:backend-arm64"]
}

target "frontend-production-amd64" {
  inherits = ["frontend-production"]
  platforms = ["linux/amd64"]
  tags = ["${TAG_PREFIX}:frontend-amd64"]
}

target "frontend-production-arm64" {
  inherits = ["frontend-production"]
  platforms = ["linux/arm64"]
  tags = ["${TAG_PREFIX}:frontend-arm64"]
}

# ==============================================================================
# 📊 ENVIRONMENT-SPECIFIC BUILDS
# ==============================================================================
target "staging" {
  inherits = ["_base"]
  target = "backend-production"
  tags = [
    "${TAG_PREFIX}:staging",
    "${REGISTRY}:staging"
  ]
  
  args = {
    NODE_ENV = "staging"
    BUILD_TARGET = "backend-production"
    SECURITY_LEVEL = "standard"
    ENABLE_MONITORING = "true"
  }
  
  labels = {
    "build.environment" = "staging"
    "build.monitoring" = "enabled"
  }
}

target "production-release" {
  inherits = ["_base"]
  target = "security-hardened"
  tags = [
    "${TAG_PREFIX}:latest",
    "${TAG_PREFIX}:${BUILD_VERSION}",
    "${REGISTRY}:latest",
    "${REGISTRY}:${BUILD_VERSION}"
  ]
  
  args = {
    NODE_ENV = "production"
    BUILD_TARGET = "security-hardened"
    SECURITY_LEVEL = "hardened"
    ENABLE_SECURITY_SCANNING = "true"
    OPTIMIZATION_LEVEL = "size"
  }
  
  attestations = ["type=provenance,mode=max", "type=sbom"]
  
  labels = {
    "build.environment" = "production"
    "build.release" = "true"
    "security.hardened" = "true"
  }
}

# ==============================================================================
# 🚀 CI/CD OPTIMIZED BUILDS
# ==============================================================================
target "ci-backend" {
  inherits = ["backend-production"]
  output = ["type=registry"]
  
  cache-from = [
    "type=gha,scope=ci-backend"
  ]
  
  cache-to = [
    "type=gha,scope=ci-backend,mode=max"
  ]
}

target "ci-frontend" {
  inherits = ["frontend-production"]
  output = ["type=registry"]
  
  cache-from = [
    "type=gha,scope=ci-frontend"
  ]
  
  cache-to = [
    "type=gha,scope=ci-frontend,mode=max"
  ]
}

target "ci-all" {
  inherits = ["_base"]
  target = "backend-production"
  output = ["type=registry"]
  
  cache-from = [
    "type=gha,scope=ci-all",
    "type=registry,ref=${CACHE_REGISTRY}:ci-cache"
  ]
  
  cache-to = [
    "type=gha,scope=ci-all,mode=max",
    "type=registry,ref=${CACHE_REGISTRY}:ci-cache,mode=max"
  ]
}

# ==============================================================================
# 🔬 EXPERIMENTAL FEATURES
# ==============================================================================
target "experimental-oci" {
  inherits = ["backend-production"]
  output = ["type=oci,dest=./dist/medianest-backend.tar"]
  platforms = ["linux/amd64"]
  
  labels = {
    "build.experimental" = "oci-export"
  }
}

target "experimental-attestation" {
  inherits = ["security-hardened"]
  attestations = [
    "type=provenance,mode=max",
    "type=sbom,generator=docker/buildx-action@v3"
  ]
  
  labels = {
    "build.attestations" = "enabled"
    "build.provenance" = "full"
  }
}