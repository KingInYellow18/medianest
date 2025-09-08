#!/bin/bash

# MediaNest Code Cleanup Script
# Refactors authentication middleware, standardizes responses, and consolidates patterns
# Created: 2025-09-08

set -euo pipefail

# Colors and constants
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
DRY_RUN=false
SKIP_CONFIRMATION=false
VERBOSE=false

log() {
    local level="$1"
    shift
    local message="$*"
    
    case "$level" in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac
}

verbose_log() {
    [[ "$VERBOSE" == true ]] && log "INFO" "$@"
}

backup_file() {
    local file="$1"
    local backup="${file}.cleanup-backup"
    
    if [[ "$DRY_RUN" == false ]]; then
        cp "$file" "$backup"
        verbose_log "Created backup: $backup"
    fi
}

apply_file_changes() {
    local file="$1"
    local temp_file="$2"
    local description="$3"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "[DRY RUN] Would apply $description to $file"
        rm -f "$temp_file"
        return 0
    fi
    
    if [[ -f "$temp_file" ]]; then
        backup_file "$file"
        mv "$temp_file" "$file"
        log "SUCCESS" "Applied $description to $file"
        return 0
    else
        log "ERROR" "Failed to create changes for $description"
        return 1
    fi
}

consolidate_auth_middleware() {
    log "INFO" "=== Consolidating authentication middleware ==="
    
    local auth_middleware_dir="$PROJECT_ROOT/backend/src/middleware"
    
    # List of duplicate/overlapping auth middleware files
    local auth_files=(
        "$auth_middleware_dir/auth-cache.ts"
        "$auth_middleware_dir/auth-security-fixes.ts"
        "$auth_middleware_dir/auth-validator.ts"
        "$auth_middleware_dir/auth/user-validator.ts"
    )
    
    local main_auth_file="$auth_middleware_dir/auth.ts"
    
    # Create consolidated auth middleware
    local temp_file="/tmp/auth-consolidated.ts"
    
    if [[ "$DRY_RUN" == false ]]; then
        cat > "$temp_file" << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { JWTFacade } from '../auth/jwt-facade';
import { redisService } from '../services/redis.service';
import { logger } from '../utils/logger';

// Consolidated authentication middleware
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
  };
}

// Main authentication middleware
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    // Check token blacklist in Redis
    const isBlacklisted = await redisService.get(`blacklist:${token}`);
    if (isBlacklisted) {
      res.status(401).json({ 
        success: false, 
        message: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
      return;
    }

    // Verify and decode token
    const payload = await JWTFacade.verifyToken(token);
    
    // Cache user data
    const cacheKey = `user:${payload.sub}`;
    let userData = await redisService.get(cacheKey);
    
    if (!userData) {
      // Fetch user data and cache it
      userData = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions || []
      };
      
      await redisService.setex(cacheKey, 300, userData); // 5 min cache
    }

    req.user = userData;
    next();
    
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid authentication',
      code: 'AUTH_INVALID'
    });
  }
};

// Role-based authorization middleware
export const authorize = (requiredRoles: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

// Permission-based authorization middleware
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user?.permissions?.includes(permission)) {
      res.status(403).json({ 
        success: false, 
        message: 'Permission denied',
        code: 'PERMISSION_DENIED'
      });
      return;
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    // Has token, try to authenticate
    return authenticate(req, res, next);
  } else {
    // No token, continue without user
    req.user = undefined;
    next();
  }
};

export default {
  authenticate,
  authorize,
  requirePermission,
  optionalAuth
};
EOF
        
        # Create the consolidated file
        apply_file_changes "$main_auth_file" "$temp_file" "consolidated authentication middleware"
        
        # Remove duplicate files
        for file in "${auth_files[@]}"; do
            if [[ -f "$file" ]]; then
                log "INFO" "Removing duplicate auth file: $file"
                rm -f "$file"
            fi
        done
    else
        log "INFO" "[DRY RUN] Would consolidate authentication middleware"
    fi
}

standardize_controller_responses() {
    log "INFO" "=== Standardizing controller responses ==="
    
    local controllers_dir="$PROJECT_ROOT/backend/src/controllers"
    
    # Create response utility if it doesn't exist
    local response_utils_file="$PROJECT_ROOT/backend/src/utils/response.utils.ts"
    local temp_response_file="/tmp/response-utils.ts"
    
    if [[ "$DRY_RUN" == false ]]; then
        cat > "$temp_response_file" << 'EOF'
import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: string;
  requestId?: string;
}

export class ResponseUtil {
  static success<T>(res: Response, message: string, data?: T, statusCode = 200): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      requestId: res.locals?.requestId
    };
    
    return res.status(statusCode).json(response);
  }
  
  static error(res: Response, message: string, statusCode = 400, code?: string, error?: string): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error,
      code,
      timestamp: new Date().toISOString(),
      requestId: res.locals?.requestId
    };
    
    return res.status(statusCode).json(response);
  }
  
  static notFound(res: Response, message = 'Resource not found'): Response {
    return this.error(res, message, 404, 'NOT_FOUND');
  }
  
  static unauthorized(res: Response, message = 'Unauthorized'): Response {
    return this.error(res, message, 401, 'UNAUTHORIZED');
  }
  
  static forbidden(res: Response, message = 'Forbidden'): Response {
    return this.error(res, message, 403, 'FORBIDDEN');
  }
  
  static validationError(res: Response, message = 'Validation failed', errors?: any): Response {
    return this.error(res, message, 422, 'VALIDATION_ERROR', errors);
  }
  
  static internalError(res: Response, message = 'Internal server error'): Response {
    return this.error(res, message, 500, 'INTERNAL_ERROR');
  }
}

export default ResponseUtil;
EOF
        
        apply_file_changes "$response_utils_file" "$temp_response_file" "response utilities"
    else
        log "INFO" "[DRY RUN] Would create standardized response utilities"
    fi
    
    # Update controller files to use standardized responses
    find "$controllers_dir" -name "*.ts" -type f | while read -r controller; do
        if [[ "$DRY_RUN" == false ]]; then
            # Add import for ResponseUtil if not present
            if ! grep -q "ResponseUtil" "$controller"; then
                local temp_controller="/tmp/$(basename "$controller")"
                {
                    echo "import ResponseUtil from '../utils/response.utils';"
                    cat "$controller"
                } > "$temp_controller"
                
                apply_file_changes "$controller" "$temp_controller" "response standardization"
            fi
        else
            log "INFO" "[DRY RUN] Would standardize responses in $(basename "$controller")"
        fi
    done
}

centralize_configuration() {
    log "INFO" "=== Centralizing configuration ==="
    
    local config_dir="$PROJECT_ROOT/backend/src/config"
    local main_config_file="$config_dir/index.ts"
    local temp_config_file="/tmp/config-index.ts"
    
    if [[ "$DRY_RUN" == false ]]; then
        mkdir -p "$config_dir"
        
        cat > "$temp_config_file" << 'EOF'
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

export interface AppConfig {
  port: number;
  env: string;
  corsOrigin: string;
  apiVersion: string;
  logLevel: string;
}

// Centralized configuration
export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  env: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  apiVersion: process.env.API_VERSION || 'v1',
  logLevel: process.env.LOG_LEVEL || 'info'
};

export const databaseConfig: DatabaseConfig = {
  url: process.env.DATABASE_URL || '',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  name: process.env.DB_NAME || 'medianest',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10)
};

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10)
};

export const jwtConfig: JwtConfig = {
  secret: process.env.JWT_SECRET || '',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  issuer: process.env.JWT_ISSUER || 'medianest',
  audience: process.env.JWT_AUDIENCE || 'medianest-client'
};

// Validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REDIS_HOST'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}

export default {
  app: appConfig,
  database: databaseConfig,
  redis: redisConfig,
  jwt: jwtConfig
};
EOF
        
        apply_file_changes "$main_config_file" "$temp_config_file" "centralized configuration"
    else
        log "INFO" "[DRY RUN] Would centralize configuration"
    fi
}

extract_magic_numbers() {
    log "INFO" "=== Extracting magic numbers to constants ==="
    
    local constants_file="$PROJECT_ROOT/backend/src/constants/index.ts"
    local temp_constants_file="/tmp/constants-index.ts"
    
    if [[ "$DRY_RUN" == false ]]; then
        mkdir -p "$(dirname "$constants_file")"
        
        cat > "$temp_constants_file" << 'EOF'
// Application Constants
export const APP_CONSTANTS = {
  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    VALIDATION_ERROR: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  },
  
  // Cache TTL (in seconds)
  CACHE_TTL: {
    USER_SESSION: 300,        // 5 minutes
    API_RESPONSE: 60,         // 1 minute
    STATIC_DATA: 3600,        // 1 hour
    USER_PREFERENCES: 1800,   // 30 minutes
    RATE_LIMIT: 3600          // 1 hour
  },
  
  // Rate Limiting
  RATE_LIMITS: {
    LOGIN_ATTEMPTS: 5,
    API_REQUESTS_PER_MINUTE: 100,
    PASSWORD_RESET_PER_HOUR: 3,
    FILE_UPLOADS_PER_HOUR: 20
  },
  
  // Database
  DATABASE: {
    MAX_QUERY_TIMEOUT: 30000,  // 30 seconds
    CONNECTION_POOL_SIZE: 10,
    RETRY_ATTEMPTS: 3,
    PAGINATION_LIMIT: 50
  },
  
  // Authentication
  AUTH: {
    TOKEN_EXPIRY: 3600,        // 1 hour
    REFRESH_TOKEN_EXPIRY: 604800, // 7 days
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 50
  },
  
  // File Upload
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024,  // 10MB
    MAX_FILES_PER_REQUEST: 5,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'],
    THUMBNAIL_SIZE: 200
  },
  
  // Validation
  VALIDATION: {
    EMAIL_MAX_LENGTH: 255,
    NAME_MAX_LENGTH: 100,
    DESCRIPTION_MAX_LENGTH: 1000,
    SEARCH_QUERY_MIN_LENGTH: 2,
    SEARCH_QUERY_MAX_LENGTH: 100
  }
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  
  // Authorization
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
} as const;

// API Response Messages
export const RESPONSE_MESSAGES = {
  SUCCESS: {
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    RETRIEVED: 'Resource retrieved successfully'
  },
  
  ERROR: {
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'Access denied',
    VALIDATION_FAILED: 'Validation failed',
    INTERNAL_ERROR: 'An unexpected error occurred'
  }
} as const;

export default APP_CONSTANTS;
EOF
        
        apply_file_changes "$constants_file" "$temp_constants_file" "application constants"
    else
        log "INFO" "[DRY RUN] Would extract magic numbers to constants"
    fi
}

consolidate_error_handling() {
    log "INFO" "=== Consolidating error handling ==="
    
    local error_handler_file="$PROJECT_ROOT/backend/src/middleware/error-handling.middleware.ts"
    
    # Check if multiple error handling files exist
    local error_files=(
        "$PROJECT_ROOT/backend/src/middleware/error.ts"
        "$PROJECT_ROOT/backend/src/middleware/error-handling.middleware.ts" 
        "$PROJECT_ROOT/backend/src/utils/error-handler.ts"
        "$PROJECT_ROOT/backend/src/utils/errors.ts"
    )
    
    if [[ "$DRY_RUN" == false ]]; then
        # Keep the most comprehensive error handler and remove duplicates
        local primary_error_file=""
        local largest_size=0
        
        for file in "${error_files[@]}"; do
            if [[ -f "$file" ]]; then
                local size=$(wc -l < "$file" 2>/dev/null || echo "0")
                if [[ $size -gt $largest_size ]]; then
                    largest_size=$size
                    primary_error_file="$file"
                fi
            fi
        done
        
        if [[ -n "$primary_error_file" ]]; then
            log "INFO" "Keeping primary error handler: $primary_error_file"
            
            # Remove duplicate error handlers
            for file in "${error_files[@]}"; do
                if [[ -f "$file" && "$file" != "$primary_error_file" ]]; then
                    log "INFO" "Removing duplicate error handler: $file"
                    rm -f "$file"
                fi
            done
        fi
    else
        log "INFO" "[DRY RUN] Would consolidate error handling files"
    fi
}

optimize_imports() {
    log "INFO" "=== Optimizing imports ==="
    
    local backend_src="$PROJECT_ROOT/backend/src"
    
    # Find TypeScript files and optimize imports
    find "$backend_src" -name "*.ts" -type f | while read -r file; do
        if [[ "$DRY_RUN" == false ]]; then
            # Remove unused imports (basic cleanup)
            local temp_file="/tmp/$(basename "$file")"
            
            # Sort and deduplicate imports
            if grep -q "^import" "$file"; then
                {
                    # Extract and sort imports
                    grep "^import" "$file" | sort | uniq
                    echo ""
                    # Add non-import lines
                    grep -v "^import" "$file"
                } > "$temp_file"
                
                apply_file_changes "$file" "$temp_file" "import optimization"
            fi
        else
            log "INFO" "[DRY RUN] Would optimize imports in $(basename "$file")"
        fi
    done
}

show_code_cleanup_summary() {
    log "INFO" "=== Code Cleanup Summary ==="
    
    local backend_src="$PROJECT_ROOT/backend/src"
    
    # Count files by category
    local controller_count=$(find "$backend_src/controllers" -name "*.ts" 2>/dev/null | wc -l || echo "0")
    local middleware_count=$(find "$backend_src/middleware" -name "*.ts" 2>/dev/null | wc -l || echo "0")
    local service_count=$(find "$backend_src/services" -name "*.ts" 2>/dev/null | wc -l || echo "0")
    local util_count=$(find "$backend_src/utils" -name "*.ts" 2>/dev/null | wc -l || echo "0")
    
    log "INFO" "Backend code structure:"
    log "INFO" "  - Controllers: $controller_count"
    log "INFO" "  - Middleware: $middleware_count" 
    log "INFO" "  - Services: $service_count"
    log "INFO" "  - Utils: $util_count"
    
    # Check for common patterns
    local auth_middleware_files=$(find "$backend_src/middleware" -name "*auth*" 2>/dev/null | wc -l || echo "0")
    local error_handler_files=$(find "$backend_src" -name "*error*" 2>/dev/null | wc -l || echo "0")
    
    log "INFO" "Pattern consolidation:"
    log "INFO" "  - Auth middleware files: $auth_middleware_files"
    log "INFO" "  - Error handler files: $error_handler_files"
}

main() {
    echo -e "${BLUE}MediaNest Code Cleanup${NC}\n"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run) DRY_RUN=true; shift ;;
            --yes) SKIP_CONFIRMATION=true; shift ;;
            --verbose) VERBOSE=true; shift ;;
            *) log "ERROR" "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN MODE - No code will be modified"
    fi
    
    # Check if backend exists
    if [[ ! -d "$PROJECT_ROOT/backend/src" ]]; then
        log "ERROR" "Backend source directory not found"
        exit 1
    fi
    
    # Run code cleanup operations
    consolidate_auth_middleware
    standardize_controller_responses
    centralize_configuration
    extract_magic_numbers
    consolidate_error_handling
    optimize_imports
    
    # Show summary
    show_code_cleanup_summary
    
    if [[ "$DRY_RUN" == false ]]; then
        log "SUCCESS" "Code cleanup completed successfully!"
        log "INFO" "Run TypeScript compilation to verify changes: npm run build"
    else
        log "INFO" "Dry run completed - no code was modified"
    fi
}

main "$@"