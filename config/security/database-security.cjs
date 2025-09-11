/**
 * Database Security Configuration and Validation
 * Comprehensive security hardening for PostgreSQL and Redis connections
 * 
 * @author MediaNest Security Team
 * @version 1.0.0
 * @since 2025-09-11
 */

const { z } = require('zod');
const { createServiceLogger } = require('../../shared/src/config/logging.config');

/**
 * PostgreSQL SSL Configuration Schema
 */
const PostgresSSLConfigSchema = z.object({
    enabled: z.coerce.boolean().default(true),
    rejectUnauthorized: z.coerce.boolean().default(true),
    ca: z.string().optional(),
    cert: z.string().optional(),
    key: z.string().optional(),
    servername: z.string().optional(),
    checkServerIdentity: z.boolean().default(true)
});

/**
 * Redis TLS Configuration Schema
 */
const RedisTLSConfigSchema = z.object({
    enabled: z.coerce.boolean().default(false),
    rejectUnauthorized: z.coerce.boolean().default(true),
    ca: z.string().optional(),
    cert: z.string().optional(),
    key: z.string().optional(),
    servername: z.string().optional()
});

/**
 * Database Security Configuration Manager
 */
class DatabaseSecurityManager {
    constructor() {
        this.logger = createServiceLogger('database-security');
    }

    /**
     * Generate secure PostgreSQL connection string with SSL/TLS
     * @param {Object} config - Database configuration
     * @param {Object} sslConfig - SSL configuration options
     * @returns {string} - Secure connection string
     */
    generateSecurePostgresUrl(config, sslConfig = {}) {
        const validated = PostgresSSLConfigSchema.parse(sslConfig);
        
        // Base connection parameters
        const baseUrl = config.DATABASE_URL || 
            `postgresql://${config.DB_USER}:${config.DB_PASSWORD}@${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`;
        
        const url = new URL(baseUrl);
        
        // Add SSL/TLS parameters for production
        if (process.env.NODE_ENV === 'production' || validated.enabled) {
            url.searchParams.set('sslmode', 'require');
            
            if (validated.rejectUnauthorized === false) {
                url.searchParams.set('sslrootcert', 'system');
            }
            
            // Connection pool optimization for production
            url.searchParams.set('connection_limit', process.env.DB_POOL_MAX || '20');
            url.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '30');
            url.searchParams.set('statement_timeout', process.env.DB_STATEMENT_TIMEOUT || '60000');
            url.searchParams.set('idle_in_transaction_session_timeout', '300000');
        }
        
        this.logger.info('Generated secure PostgreSQL connection string', {
            sslEnabled: validated.enabled,
            rejectUnauthorized: validated.rejectUnauthorized,
            host: url.hostname,
            port: url.port,
            database: url.pathname.slice(1)
        });
        
        return url.toString();
    }

    /**
     * Generate secure Redis connection options with TLS
     * @param {Object} config - Redis configuration
     * @param {Object} tlsConfig - TLS configuration options
     * @returns {Object} - Secure Redis options
     */
    generateSecureRedisOptions(config, tlsConfig = {}) {
        const validated = RedisTLSConfigSchema.parse(tlsConfig);
        
        const options = {
            host: config.REDIS_HOST,
            port: config.REDIS_PORT,
            password: config.REDIS_PASSWORD,
            db: config.REDIS_DB || 0,
            
            // Security settings
            enableOfflineQueue: false, // Prevent command queuing when disconnected
            showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
            
            // Connection security
            connectTimeout: 10000,
            commandTimeout: 5000,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            
            // Retry strategy with exponential backoff
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            
            // Keep-alive configuration
            family: 4,
            keepAlive: true,
            
            // Auto-pipelining for performance
            enableAutoPipelining: true
        };
        
        // Add TLS configuration for production or when explicitly enabled
        if (process.env.NODE_ENV === 'production' || validated.enabled) {
            if (validated.enabled) {
                options.tls = {
                    rejectUnauthorized: validated.rejectUnauthorized,
                    servername: validated.servername || config.REDIS_HOST
                };
                
                // Add certificate files if provided
                if (validated.ca) options.tls.ca = validated.ca;
                if (validated.cert) options.tls.cert = validated.cert;
                if (validated.key) options.tls.key = validated.key;
            }
        }
        
        this.logger.info('Generated secure Redis options', {
            tlsEnabled: validated.enabled,
            host: config.REDIS_HOST,
            port: config.REDIS_PORT,
            db: config.REDIS_DB || 0,
            passwordProtected: !!config.REDIS_PASSWORD
        });
        
        return options;
    }

    /**
     * Validate database security configuration
     * @param {Object} config - Database configuration
     * @returns {Object} - Validation results
     */
    validateDatabaseSecurity(config) {
        const results = {
            postgresql: { secure: true, issues: [] },
            redis: { secure: true, issues: [] },
            overall: { secure: true, criticalIssues: 0, warnings: 0 }
        };
        
        // PostgreSQL Security Validation
        this.validatePostgresqlSecurity(config, results.postgresql);
        
        // Redis Security Validation
        this.validateRedisSecurity(config, results.redis);
        
        // Calculate overall security status
        results.overall.secure = results.postgresql.secure && results.redis.secure;
        results.overall.criticalIssues = 
            results.postgresql.issues.filter(i => i.severity === 'critical').length +
            results.redis.issues.filter(i => i.severity === 'critical').length;
        results.overall.warnings = 
            results.postgresql.issues.filter(i => i.severity === 'warning').length +
            results.redis.issues.filter(i => i.severity === 'warning').length;
        
        this.logger.info('Database security validation completed', {
            secure: results.overall.secure,
            criticalIssues: results.overall.criticalIssues,
            warnings: results.overall.warnings
        });
        
        return results;
    }

    /**
     * Validate PostgreSQL security configuration
     * @private
     */
    validatePostgresqlSecurity(config, results) {
        // Check for DATABASE_URL or connection parameters
        if (!config.DATABASE_URL && (!config.DB_HOST || !config.DB_USER || !config.DB_PASSWORD)) {
            results.issues.push({
                type: 'configuration',
                severity: 'critical',
                message: 'PostgreSQL connection parameters not configured',
                recommendation: 'Set DATABASE_URL or individual DB_* environment variables'
            });
            results.secure = false;
        }
        
        // Production SSL/TLS validation
        if (process.env.NODE_ENV === 'production') {
            if (config.DATABASE_URL) {
                const url = new URL(config.DATABASE_URL);
                if (!url.searchParams.has('sslmode') || url.searchParams.get('sslmode') !== 'require') {
                    results.issues.push({
                        type: 'ssl',
                        severity: 'critical',
                        message: 'SSL/TLS not enforced for production PostgreSQL connection',
                        recommendation: 'Add sslmode=require to DATABASE_URL parameter'
                    });
                    results.secure = false;
                }
            }
            
            // Check for SSL certificate configuration
            if (!process.env.DB_SSL_CA && !process.env.DB_SSL_DISABLE) {
                results.issues.push({
                    type: 'ssl',
                    severity: 'warning',
                    message: 'PostgreSQL SSL certificate authority not configured',
                    recommendation: 'Set DB_SSL_CA environment variable or DB_SSL_DISABLE=true if using trusted certificates'
                });
            }
        }
        
        // Connection pool validation
        const poolMax = parseInt(process.env.DB_POOL_MAX) || 20;
        if (poolMax > 50) {
            results.issues.push({
                type: 'performance',
                severity: 'warning',
                message: 'PostgreSQL connection pool size may be too large',
                recommendation: 'Consider reducing DB_POOL_MAX for better resource management'
            });
        }
        
        // Weak password detection (basic)
        if (config.DB_PASSWORD && config.DB_PASSWORD.length < 12) {
            results.issues.push({
                type: 'authentication',
                severity: 'warning',
                message: 'PostgreSQL password may be too weak',
                recommendation: 'Use passwords with at least 12 characters, mixed case, numbers, and symbols'
            });
        }
    }

    /**
     * Validate Redis security configuration
     * @private
     */
    validateRedisSecurity(config, results) {
        // Redis connection validation
        if (!config.REDIS_URL && !config.REDIS_HOST) {
            results.issues.push({
                type: 'configuration',
                severity: 'warning',
                message: 'Redis connection not configured',
                recommendation: 'Configure REDIS_URL or REDIS_HOST for caching functionality'
            });
        }
        
        // Production authentication validation
        if (process.env.NODE_ENV === 'production') {
            if (!config.REDIS_PASSWORD && !config.REDIS_URL?.includes('auth')) {
                results.issues.push({
                    type: 'authentication',
                    severity: 'critical',
                    message: 'Redis authentication not configured for production',
                    recommendation: 'Set REDIS_PASSWORD or include password in REDIS_URL'
                });
                results.secure = false;
            }
            
            // TLS validation
            if (!process.env.REDIS_TLS_ENABLED && !process.env.REDIS_TLS_DISABLE) {
                results.issues.push({
                    type: 'encryption',
                    severity: 'warning',
                    message: 'Redis TLS encryption not explicitly configured',
                    recommendation: 'Set REDIS_TLS_ENABLED=true for encrypted connections or REDIS_TLS_DISABLE=true if not needed'
                });
            }
        }
        
        // Redis configuration security
        const maxRetries = parseInt(config.REDIS_MAX_RETRIES) || 3;
        if (maxRetries > 10) {
            results.issues.push({
                type: 'configuration',
                severity: 'warning',
                message: 'Redis max retries set too high',
                recommendation: 'Consider reducing REDIS_MAX_RETRIES to prevent connection storms'
            });
        }
        
        // Weak Redis password detection
        if (config.REDIS_PASSWORD && config.REDIS_PASSWORD.length < 16) {
            results.issues.push({
                type: 'authentication',
                severity: 'warning',
                message: 'Redis password may be too weak',
                recommendation: 'Use Redis passwords with at least 16 characters for better security'
            });
        }
    }

    /**
     * Generate database security report
     * @param {Object} validationResults - Results from validateDatabaseSecurity
     * @returns {string} - Security report
     */
    generateSecurityReport(validationResults) {
        const { postgresql, redis, overall } = validationResults;
        
        let report = '\n=== DATABASE SECURITY REPORT ===\n\n';
        
        // Overall status
        report += `Overall Security Status: ${overall.secure ? '✅ SECURE' : '❌ ISSUES DETECTED'}\n`;
        report += `Critical Issues: ${overall.criticalIssues}\n`;
        report += `Warnings: ${overall.warnings}\n\n`;
        
        // PostgreSQL section
        report += `--- PostgreSQL Security ---\n`;
        report += `Status: ${postgresql.secure ? '✅ Secure' : '⚠️ Issues Found'}\n`;
        if (postgresql.issues.length > 0) {
            postgresql.issues.forEach(issue => {
                const icon = issue.severity === 'critical' ? '🚨' : '⚠️';
                report += `${icon} ${issue.type.toUpperCase()}: ${issue.message}\n`;
                report += `   → ${issue.recommendation}\n`;
            });
        }
        report += '\n';
        
        // Redis section
        report += `--- Redis Security ---\n`;
        report += `Status: ${redis.secure ? '✅ Secure' : '⚠️ Issues Found'}\n`;
        if (redis.issues.length > 0) {
            redis.issues.forEach(issue => {
                const icon = issue.severity === 'critical' ? '🚨' : '⚠️';
                report += `${icon} ${issue.type.toUpperCase()}: ${issue.message}\n`;
                report += `   → ${issue.recommendation}\n`;
            });
        }
        
        report += '\n=== END REPORT ===\n';
        
        return report;
    }
}

module.exports = {
    DatabaseSecurityManager,
    PostgresSSLConfigSchema,
    RedisTLSConfigSchema
};