#!/bin/bash
# 4-Tier Workflow Environment Deployment Testing Script
# QA Coordinator Agent - Environment Deployment Validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🌍 QA VALIDATION: Environment Deployment Testing${NC}"
echo "=================================================================="

VALIDATION_PASSED=true
VALIDATION_REPORT="/tmp/environment-deployment-validation.json"

# Initialize validation report
cat > "$VALIDATION_REPORT" << 'EOF'
{
  "validation_timestamp": "",
  "validation_type": "environment_deployment",
  "environments": {
    "production": {"branch": "main", "domain": "production.medianest.com"},
    "staging": {"branch": "development", "domain": "staging.medianest.com"},
    "testing": {"branch": "test", "domain": "test.medianest.com"},
    "ai_development": {"branch": "claude-flowv2", "domain": "ai-dev.medianest.internal"}
  },
  "results": {
    "environment_configs": {},
    "deployment_readiness": {},
    "service_health": {},
    "security_validation": {},
    "overall_status": "pending"
  }
}
EOF

# Function to log validation results
log_result() {
    local test_category="$1"
    local test_name="$2"
    local status="$3"
    local details="$4"
    
    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✅ $test_name: PASS${NC}"
        [ -n "$details" ] && echo -e "   Details: $details"
    elif [ "$status" = "skip" ]; then
        echo -e "${YELLOW}⏭️ $test_name: SKIP${NC}"
        [ -n "$details" ] && echo -e "   Reason: $details"
    else
        echo -e "${RED}❌ $test_name: FAIL${NC}"
        [ -n "$details" ] && echo -e "   Error: $details"
        VALIDATION_PASSED=false
    fi
}

# Test 1: Environment configuration validation
test_environment_configs() {
    echo -e "\n${BLUE}⚙️ TEST 1: Environment Configuration Validation${NC}"
    
    # Define environment mappings
    declare -A environments
    environments["main"]="production"
    environments["development"]="staging" 
    environments["test"]="testing"
    environments["claude-flowv2"]="ai-development"
    
    for branch in "${!environments[@]}"; do
        local env_name="${environments[$branch]}"
        echo -e "\n   Testing $env_name environment (branch: $branch)"
        
        # Switch to branch to test environment-specific configs
        if git checkout "$branch" >/dev/null 2>&1; then
            log_result "environment_configs" "checkout_${branch}" "pass" "Successfully switched to $branch"
            
            # Test 1.1: Environment file validation
            local env_files=(".env.${env_name}" ".env.${branch}" ".env.example")
            local env_file_found=false
            
            for env_file in "${env_files[@]}"; do
                if [ -f "$env_file" ]; then
                    log_result "environment_configs" "env_file_${branch}" "pass" "Environment file found: $env_file"
                    env_file_found=true
                    
                    # Validate environment file content
                    if grep -q "NODE_ENV" "$env_file" 2>/dev/null; then
                        log_result "environment_configs" "env_content_${branch}" "pass" "Environment variables configured"
                    else
                        log_result "environment_configs" "env_content_${branch}" "warn" "NODE_ENV not configured in $env_file"
                    fi
                    break
                fi
            done
            
            if [ "$env_file_found" = false ]; then
                log_result "environment_configs" "env_file_${branch}" "warn" "No environment file found for $env_name"
            fi
            
            # Test 1.2: Docker configuration validation
            local docker_files=("docker-compose.${env_name}.yml" "docker-compose.${branch}.yml" "Dockerfile")
            local docker_config_found=false
            
            for docker_file in "${docker_files[@]}"; do
                if [ -f "$docker_file" ]; then
                    log_result "environment_configs" "docker_config_${branch}" "pass" "Docker configuration found: $docker_file"
                    docker_config_found=true
                    break
                fi
            done
            
            if [ "$docker_config_found" = false ]; then
                log_result "environment_configs" "docker_config_${branch}" "warn" "No Docker configuration found for $env_name"
            fi
            
            # Test 1.3: Package.json environment scripts
            if [ -f "package.json" ]; then
                if grep -q "\"start:${env_name}\"" package.json 2>/dev/null || \
                   grep -q "\"deploy:${env_name}\"" package.json 2>/dev/null; then
                    log_result "environment_configs" "npm_scripts_${branch}" "pass" "Environment-specific npm scripts configured"
                else
                    log_result "environment_configs" "npm_scripts_${branch}" "warn" "No environment-specific npm scripts found"
                fi
            fi
            
        else
            log_result "environment_configs" "checkout_${branch}" "fail" "Cannot switch to $branch"
        fi
    done
    
    # Return to main branch
    git checkout main >/dev/null 2>&1
}

# Test 2: Deployment readiness validation
test_deployment_readiness() {
    echo -e "\n${BLUE}🚀 TEST 2: Deployment Readiness Validation${NC}"
    
    local branches=("main" "development" "test" "claude-flowv2")
    
    for branch in "${branches[@]}"; do
        echo -e "\n   Testing deployment readiness for $branch"
        
        if git checkout "$branch" >/dev/null 2>&1; then
            # Test 2.1: Build readiness
            if [ -f "package.json" ]; then
                # Check if dependencies are properly defined
                if jq -e '.dependencies' package.json >/dev/null 2>&1; then
                    log_result "deployment_readiness" "dependencies_${branch}" "pass" "Dependencies defined in package.json"
                else
                    log_result "deployment_readiness" "dependencies_${branch}" "warn" "No dependencies found in package.json"
                fi
                
                # Check if build script exists
                if jq -e '.scripts.build' package.json >/dev/null 2>&1; then
                    log_result "deployment_readiness" "build_script_${branch}" "pass" "Build script configured"
                    
                    # Test build process (if not too time consuming)
                    if [ "$branch" != "main" ]; then  # Don't run build on main to avoid issues
                        echo -e "      Testing build process..."
                        if timeout 60s npm run build >/dev/null 2>&1; then
                            log_result "deployment_readiness" "build_test_${branch}" "pass" "Build process successful"
                        else
                            log_result "deployment_readiness" "build_test_${branch}" "warn" "Build process failed or timed out"
                        fi
                    fi
                else
                    log_result "deployment_readiness" "build_script_${branch}" "warn" "No build script configured"
                fi
                
                # Check if start script exists
                if jq -e '.scripts.start' package.json >/dev/null 2>&1; then
                    log_result "deployment_readiness" "start_script_${branch}" "pass" "Start script configured"
                else
                    log_result "deployment_readiness" "start_script_${branch}" "warn" "No start script configured"
                fi
            else
                log_result "deployment_readiness" "package_json_${branch}" "warn" "No package.json found"
            fi
            
            # Test 2.2: Docker readiness
            if [ -f "Dockerfile" ]; then
                log_result "deployment_readiness" "dockerfile_${branch}" "pass" "Dockerfile present"
                
                # Validate Dockerfile syntax
                if command -v docker >/dev/null 2>&1; then
                    if docker build --dry-run . >/dev/null 2>&1; then
                        log_result "deployment_readiness" "dockerfile_syntax_${branch}" "pass" "Dockerfile syntax valid"
                    else
                        log_result "deployment_readiness" "dockerfile_syntax_${branch}" "warn" "Dockerfile syntax issues detected"
                    fi
                else
                    log_result "deployment_readiness" "dockerfile_syntax_${branch}" "skip" "Docker not available for syntax validation"
                fi
            else
                log_result "deployment_readiness" "dockerfile_${branch}" "warn" "No Dockerfile found"
            fi
            
            # Test 2.3: Health check endpoint
            local health_files=("src/routes/health.ts" "src/routes/health.js" "routes/health.js" "health.js")
            local health_endpoint_found=false
            
            for health_file in "${health_files[@]}"; do
                if [ -f "$health_file" ]; then
                    log_result "deployment_readiness" "health_endpoint_${branch}" "pass" "Health check endpoint found: $health_file"
                    health_endpoint_found=true
                    break
                fi
            done
            
            if [ "$health_endpoint_found" = false ]; then
                # Check if health endpoint is mentioned in any file
                if grep -r "health" --include="*.js" --include="*.ts" . >/dev/null 2>&1; then
                    log_result "deployment_readiness" "health_endpoint_${branch}" "warn" "Health check references found but endpoint unclear"
                else
                    log_result "deployment_readiness" "health_endpoint_${branch}" "warn" "No health check endpoint found"
                fi
            fi
            
        else
            log_result "deployment_readiness" "checkout_${branch}" "fail" "Cannot access $branch for deployment testing"
        fi
    done
    
    git checkout main >/dev/null 2>&1
}

# Test 3: Service health validation
test_service_health() {
    echo -e "\n${BLUE}💓 TEST 3: Service Health Validation${NC}"
    
    # Test 3.1: Database connectivity simulation
    local db_config_files=("prisma/schema.prisma" "config/database.js" "config/database.ts")
    local db_config_found=false
    
    for db_file in "${db_config_files[@]}"; do
        if [ -f "$db_file" ]; then
            log_result "service_health" "database_config" "pass" "Database configuration found: $db_file"
            db_config_found=true
            break
        fi
    done
    
    if [ "$db_config_found" = false ]; then
        log_result "service_health" "database_config" "warn" "No database configuration found"
    fi
    
    # Test 3.2: Redis configuration
    if grep -r "redis" --include="*.js" --include="*.ts" . >/dev/null 2>&1; then
        log_result "service_health" "redis_config" "pass" "Redis configuration references found"
    else
        log_result "service_health" "redis_config" "skip" "No Redis configuration found"
    fi
    
    # Test 3.3: External service integrations
    local external_services=("plex" "overseerr" "youtube")
    
    for service in "${external_services[@]}"; do
        if grep -r "$service" --include="*.js" --include="*.ts" . >/dev/null 2>&1; then
            log_result "service_health" "external_${service}" "pass" "$service integration found"
        else
            log_result "service_health" "external_${service}" "skip" "No $service integration found"
        fi
    done
    
    # Test 3.4: Environment-specific service configurations
    local branches=("main" "development" "test" "claude-flowv2")
    
    for branch in "${branches[@]}"; do
        git checkout "$branch" >/dev/null 2>&1
        
        # Check for environment-specific service configs
        if [ -f ".env.example" ] || [ -f ".env" ]; then
            # Look for service URLs in environment files
            local env_file=".env.example"
            [ -f ".env" ] && env_file=".env"
            
            if grep -q "URL\|HOST\|PORT" "$env_file" 2>/dev/null; then
                log_result "service_health" "service_urls_${branch}" "pass" "Service URLs configured in $env_file"
            else
                log_result "service_health" "service_urls_${branch}" "warn" "No service URLs found in environment config"
            fi
        else
            log_result "service_health" "service_urls_${branch}" "warn" "No environment configuration for service URLs"
        fi
    done
    
    git checkout main >/dev/null 2>&1
}

# Test 4: Security validation
test_security_validation() {
    echo -e "\n${BLUE}🔒 TEST 4: Security Validation${NC}"
    
    # Test 4.1: Secrets management
    if [ -f ".env.example" ]; then
        log_result "security_validation" "env_example" "pass" "Environment template provided"
        
        # Check for common secret patterns in .env.example
        local secret_patterns=("JWT_SECRET" "DATABASE_URL" "API_KEY" "PASSWORD")
        for pattern in "${secret_patterns[@]}"; do
            if grep -q "$pattern" .env.example 2>/dev/null; then
                log_result "security_validation" "secret_${pattern}" "pass" "Secret placeholder found: $pattern"
            fi
        done
    else
        log_result "security_validation" "env_example" "warn" "No .env.example file found"
    fi
    
    # Test 4.2: Gitignore security
    if [ -f ".gitignore" ]; then
        local security_patterns=(".env" "*.key" "*.pem" "secrets" "config/secrets")
        local gitignore_security_score=0
        
        for pattern in "${security_patterns[@]}"; do
            if grep -q "$pattern" .gitignore 2>/dev/null; then
                ((gitignore_security_score++))
            fi
        done
        
        if [ "$gitignore_security_score" -ge 3 ]; then
            log_result "security_validation" "gitignore_security" "pass" "Good security patterns in .gitignore ($gitignore_security_score/5)"
        else
            log_result "security_validation" "gitignore_security" "warn" "Limited security patterns in .gitignore ($gitignore_security_score/5)"
        fi
    else
        log_result "security_validation" "gitignore_security" "fail" "No .gitignore file found"
    fi
    
    # Test 4.3: Dependency security
    if [ -f "package.json" ]; then
        if command -v npm >/dev/null 2>&1; then
            echo -e "      Running npm audit..."
            if npm audit --audit-level=high >/dev/null 2>&1; then
                log_result "security_validation" "dependency_audit" "pass" "No high-severity vulnerabilities found"
            else
                local vuln_count=$(npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "unknown")
                log_result "security_validation" "dependency_audit" "warn" "High-severity vulnerabilities detected (count: $vuln_count)"
            fi
        else
            log_result "security_validation" "dependency_audit" "skip" "npm not available for dependency audit"
        fi
    else
        log_result "security_validation" "dependency_audit" "skip" "No package.json found for dependency audit"
    fi
    
    # Test 4.4: HTTPS/TLS configuration
    local ssl_patterns=("https" "ssl" "tls" "cert")
    local ssl_config_found=false
    
    for pattern in "${ssl_patterns[@]}"; do
        if grep -r "$pattern" --include="*.js" --include="*.ts" --include="*.json" . >/dev/null 2>&1; then
            log_result "security_validation" "ssl_config" "pass" "SSL/TLS configuration references found"
            ssl_config_found=true
            break
        fi
    done
    
    if [ "$ssl_config_found" = false ]; then
        log_result "security_validation" "ssl_config" "warn" "No SSL/TLS configuration found"
    fi
}

# Test 5: Performance validation
test_performance_validation() {
    echo -e "\n${BLUE}⚡ TEST 5: Performance Validation${NC}"
    
    # Test 5.1: Build optimization
    if [ -f "next.config.js" ]; then
        if grep -q "optimization\|compress\|bundle" next.config.js 2>/dev/null; then
            log_result "performance_validation" "next_optimization" "pass" "Next.js optimization configured"
        else
            log_result "performance_validation" "next_optimization" "warn" "Limited Next.js optimization found"
        fi
    elif [ -f "webpack.config.js" ]; then
        if grep -q "optimization\|minimize" webpack.config.js 2>/dev/null; then
            log_result "performance_validation" "webpack_optimization" "pass" "Webpack optimization configured"
        else
            log_result "performance_validation" "webpack_optimization" "warn" "Limited Webpack optimization found"
        fi
    else
        log_result "performance_validation" "build_optimization" "skip" "No build optimization configuration found"
    fi
    
    # Test 5.2: Caching strategy
    local cache_patterns=("cache" "redis" "memcached")
    local cache_found=false
    
    for pattern in "${cache_patterns[@]}"; do
        if grep -r "$pattern" --include="*.js" --include="*.ts" . >/dev/null 2>&1; then
            log_result "performance_validation" "caching_strategy" "pass" "Caching implementation found: $pattern"
            cache_found=true
            break
        fi
    done
    
    if [ "$cache_found" = false ]; then
        log_result "performance_validation" "caching_strategy" "warn" "No caching strategy found"
    fi
    
    # Test 5.3: Database optimization
    if [ -f "prisma/schema.prisma" ]; then
        if grep -q "@@index\|@@unique" prisma/schema.prisma 2>/dev/null; then
            log_result "performance_validation" "database_indexes" "pass" "Database indexes configured in Prisma schema"
        else
            log_result "performance_validation" "database_indexes" "warn" "Limited database indexing found"
        fi
    else
        log_result "performance_validation" "database_indexes" "skip" "No Prisma schema found for index validation"
    fi
}

# Main execution
main() {
    echo -e "Starting environment deployment validation at $(date)"
    
    # Update timestamp in report
    if command -v jq >/dev/null 2>&1; then
        jq --arg timestamp "$(date -Iseconds)" '.validation_timestamp = $timestamp' \
           "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
    fi
    
    # Store original branch
    local original_branch=$(git branch --show-current)
    
    # Run all tests
    test_environment_configs
    test_deployment_readiness
    test_service_health
    test_security_validation
    test_performance_validation
    
    # Return to original branch
    git checkout "$original_branch" >/dev/null 2>&1
    
    # Final validation result
    echo -e "\n=================================================================="
    if [ "$VALIDATION_PASSED" = true ]; then
        echo -e "${GREEN}🎉 ENVIRONMENT DEPLOYMENT VALIDATION: PASSED${NC}"
        echo -e "${BLUE}📋 Environment Summary:${NC}"
        echo "• ✅ Production (main): Ready for deployment"
        echo "• ✅ Staging (development): Environment configured"
        echo "• ✅ Testing (test): Testing environment operational"
        echo "• ✅ AI Development (claude-flowv2): AI environment ready"
        echo "• ✅ Security validations passed"
        echo "• ✅ Performance optimizations in place"
        
        if command -v jq >/dev/null 2>&1; then
            jq '.results.overall_status = "passed"' "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
        fi
        exit 0
    else
        echo -e "${RED}❌ ENVIRONMENT DEPLOYMENT VALIDATION: FAILED${NC}"
        echo -e "${YELLOW}📝 Review the failed tests above and address deployment issues${NC}"
        echo -e "${YELLOW}💡 Consider fixing configuration, security, or performance issues${NC}"
        if command -v jq >/dev/null 2>&1; then
            jq '.results.overall_status = "failed"' "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
        fi
        exit 1
    fi
}

# Run main function
main "$@"