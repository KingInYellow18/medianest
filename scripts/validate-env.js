#!/usr/bin/env node

/**
 * MediaNest Environment Validation Script
 * Validates that all required environment variables are set for production
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Helper functions
const log = {
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`)
};

// Required environment variables by category
const requiredVars = {
  'Domain & SSL': [
    { name: 'DOMAIN_NAME', description: 'Your domain name', example: 'example.com' },
    { name: 'CERTBOT_EMAIL', description: 'Email for SSL certificates', example: 'admin@example.com' }
  ],
  'Application URLs': [
    { name: 'FRONTEND_URL', description: 'Frontend URL', example: 'https://example.com' },
    { name: 'BACKEND_URL', description: 'Backend URL', example: 'https://example.com/api' },
    { name: 'NEXTAUTH_URL', description: 'NextAuth URL', example: 'https://example.com' },
    { name: 'NEXT_PUBLIC_API_URL', description: 'Public API URL', example: 'https://example.com/api' }
  ],
  'Database': [
    { name: 'DATABASE_URL', description: 'PostgreSQL connection string', 
      validate: (val) => val && !val.includes('CHANGE_ME'), 
      error: 'Must not contain CHANGE_ME placeholder' }
  ],
  'Redis': [
    { name: 'REDIS_URL', description: 'Redis connection string',
      validate: (val) => val && !val.includes('CHANGE_ME'),
      error: 'Must not contain CHANGE_ME placeholder' }
  ],
  'Authentication': [
    { name: 'NEXTAUTH_SECRET', description: 'NextAuth secret',
      validate: (val) => val && val.length >= 32 && !val.includes('CHANGE_ME'),
      error: 'Must be at least 32 characters and not contain CHANGE_ME' },
    { name: 'JWT_SECRET', description: 'JWT secret',
      validate: (val) => val && val.length >= 32 && !val.includes('CHANGE_ME'),
      error: 'Must be at least 32 characters and not contain CHANGE_ME' },
    { name: 'ENCRYPTION_KEY', description: 'Encryption key',
      validate: (val) => val && val.length >= 32 && !val.includes('CHANGE_ME'),
      error: 'Must be at least 32 characters and not contain CHANGE_ME' }
  ],
  'Admin': [
    { name: 'ADMIN_USERNAME', description: 'Admin username',
      validate: (val) => val && val !== 'admin',
      error: 'Should not use default "admin" username' },
    { name: 'ADMIN_PASSWORD', description: 'Admin password',
      validate: (val) => val && val.length >= 12 && !val.includes('CHANGE_ME'),
      error: 'Must be at least 12 characters and not contain CHANGE_ME' }
  ]
};

// Optional but recommended variables
const optionalVars = {
  'Monitoring': [
    'METRICS_ENABLED',
    'ERROR_REPORTING_ENABLED',
    'HEALTH_CHECK_INTERVAL'
  ],
  'Backup': [
    'BACKUP_ENABLED',
    'BACKUP_SCHEDULE',
    'BACKUP_RETENTION_DAYS'
  ],
  'Security': [
    'ENABLE_HSTS',
    'ENABLE_CSP',
    'RATE_LIMIT_API_REQUESTS'
  ]
};

// Docker secrets that should exist
const dockerSecrets = [
  'database_url',
  'redis_url',
  'jwt_secret',
  'nextauth_secret',
  'encryption_key',
  'postgres_password',
  'redis_password',
  'plex_client_id',
  'plex_client_secret'
];

// Main validation function
function validateEnvironment(envFile = '.env.production') {
  console.log(`\n${colors.blue}MediaNest Environment Validation${colors.reset}`);
  console.log('=' .repeat(50));

  // Check if env file exists
  const envPath = path.join(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    log.error(`Environment file not found: ${envFile}`);
    log.info(`Please copy .env.production.template to ${envFile} and configure it`);
    process.exit(1);
  }

  // Load environment variables
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  let errors = 0;
  let warnings = 0;

  // Validate required variables
  console.log(`\n${colors.blue}Checking Required Variables${colors.reset}`);
  console.log('-'.repeat(50));

  for (const [category, vars] of Object.entries(requiredVars)) {
    console.log(`\n${category}:`);
    
    for (const varDef of vars) {
      const value = env[varDef.name];
      
      if (!value) {
        log.error(`${varDef.name} is not set - ${varDef.description}`);
        if (varDef.example) {
          console.log(`    Example: ${varDef.example}`);
        }
        errors++;
      } else if (varDef.validate && !varDef.validate(value)) {
        log.error(`${varDef.name} - ${varDef.error}`);
        errors++;
      } else {
        log.success(`${varDef.name} is set`);
      }
    }
  }

  // Check optional variables
  console.log(`\n${colors.blue}Checking Optional Variables${colors.reset}`);
  console.log('-'.repeat(50));

  for (const [category, vars] of Object.entries(optionalVars)) {
    console.log(`\n${category}:`);
    
    for (const varName of vars) {
      if (!env[varName]) {
        log.warning(`${varName} is not set (optional but recommended)`);
        warnings++;
      } else {
        log.success(`${varName} is set`);
      }
    }
  }

  // Check for Docker secrets
  console.log(`\n${colors.blue}Checking Docker Secrets${colors.reset}`);
  console.log('-'.repeat(50));

  if (env.USE_DOCKER_SECRETS === 'true') {
    console.log('\nDocker secrets are enabled. Checking secret files...');
    
    const secretsDir = path.join(process.cwd(), 'secrets');
    if (!fs.existsSync(secretsDir)) {
      log.error(`Secrets directory not found: ${secretsDir}`);
      errors++;
    } else {
      for (const secret of dockerSecrets) {
        const secretPath = path.join(secretsDir, secret);
        if (!fs.existsSync(secretPath)) {
          log.error(`Secret file missing: secrets/${secret}`);
          errors++;
        } else {
          const secretContent = fs.readFileSync(secretPath, 'utf8').trim();
          if (!secretContent || secretContent.includes('CHANGE_ME')) {
            log.error(`Secret file contains placeholder: secrets/${secret}`);
            errors++;
          } else {
            log.success(`Secret file exists: secrets/${secret}`);
          }
        }
      }
    }
  } else {
    log.warning('Docker secrets are disabled. Ensure sensitive values are properly secured.');
    warnings++;
  }

  // Check for common security issues
  console.log(`\n${colors.blue}Security Checks${colors.reset}`);
  console.log('-'.repeat(50));

  // Check for default values
  const defaultChecks = [
    { var: 'DOMAIN_NAME', value: 'example.com', message: 'Using example domain' },
    { var: 'ADMIN_USERNAME', value: 'admin', message: 'Using default admin username' },
    { var: 'PLEX_CLIENT_IDENTIFIER', pattern: /CHANGE_ME/, message: 'Contains CHANGE_ME placeholder' }
  ];

  for (const check of defaultChecks) {
    const value = env[check.var];
    if (value) {
      if (check.value && value === check.value) {
        log.warning(`${check.var} - ${check.message}`);
        warnings++;
      } else if (check.pattern && check.pattern.test(value)) {
        log.error(`${check.var} - ${check.message}`);
        errors++;
      }
    }
  }

  // Check URL consistency
  console.log(`\n${colors.blue}URL Consistency Checks${colors.reset}`);
  console.log('-'.repeat(50));

  const domain = env.DOMAIN_NAME;
  if (domain && domain !== 'example.com') {
    const urlChecks = [
      'FRONTEND_URL',
      'BACKEND_URL',
      'NEXTAUTH_URL',
      'NEXT_PUBLIC_API_URL',
      'CORS_ORIGIN'
    ];

    for (const urlVar of urlChecks) {
      const url = env[urlVar];
      if (url && !url.includes(domain)) {
        log.warning(`${urlVar} does not match DOMAIN_NAME (${domain})`);
        warnings++;
      }
    }
  }

  // Summary
  console.log(`\n${colors.blue}Validation Summary${colors.reset}`);
  console.log('='.repeat(50));

  if (errors === 0 && warnings === 0) {
    log.success('All checks passed! Your environment is properly configured.');
  } else {
    if (errors > 0) {
      log.error(`Found ${errors} error(s) that must be fixed`);
    }
    if (warnings > 0) {
      log.warning(`Found ${warnings} warning(s) to review`);
    }
    
    if (errors > 0) {
      console.log(`\n${colors.red}Environment validation failed. Please fix the errors above.${colors.reset}`);
      process.exit(1);
    }
  }

  // Additional recommendations
  console.log(`\n${colors.blue}Recommendations${colors.reset}`);
  console.log('-'.repeat(50));
  console.log('1. Run scripts/generate-secrets.sh to create secure secrets');
  console.log('2. Set up proper backup destinations (S3, etc.)');
  console.log('3. Configure monitoring endpoints');
  console.log('4. Review and adjust resource limits');
  console.log('5. Test with docker-compose.prod.yml before deploying');
  
  console.log('\n');
}

// Run validation
if (require.main === module) {
  const envFile = process.argv[2] || '.env.production';
  validateEnvironment(envFile);
}

module.exports = { validateEnvironment };