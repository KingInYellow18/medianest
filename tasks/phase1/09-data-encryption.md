# Task: Implement AES-256-GCM Encryption for Sensitive Data

**Priority:** Critical  
**Estimated Duration:** 1 day  
**Dependencies:** User repository exists  
**Phase:** 1 (Week 4)

## Objective
Implement AES-256-GCM encryption for sensitive data fields (Plex tokens, API keys) before storage in the database.

## Background
Currently, sensitive data like Plex tokens are stored in plain text. This is a security vulnerability. AES-256-GCM provides authenticated encryption to protect this data.

## Detailed Requirements

### 1. Encryption Service Implementation
```typescript
// backend/src/services/encryption.service.ts
import crypto from 'crypto';
import { config } from '@/config';
import { logger } from '@/utils/logger';

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    // Derive key from environment variable
    const encryptionKey = config.encryption.key;
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }
    
    // Use scrypt for key derivation
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  encrypt(text: string): EncryptedData {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  decrypt(data: EncryptedData): string {
    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(data.iv, 'hex')
      );
      
      // Set auth tag
      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
      
      // Decrypt data
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt data and return as single string for storage
   */
  encryptForStorage(text: string): string {
    const encrypted = this.encrypt(text);
    // Combine all parts with delimiter
    return `${encrypted.encrypted}:${encrypted.iv}:${encrypted.authTag}`;
  }

  /**
   * Decrypt data from storage format
   */
  decryptFromStorage(storedData: string): string {
    const [encrypted, iv, authTag] = storedData.split(':');
    
    if (!encrypted || !iv || !authTag) {
      throw new Error('Invalid encrypted data format');
    }
    
    return this.decrypt({ encrypted, iv, authTag });
  }

  /**
   * Check if a string is encrypted (has the expected format)
   */
  isEncrypted(data: string): boolean {
    const parts = data.split(':');
    return parts.length === 3 && 
           parts.every(part => /^[0-9a-f]+$/i.test(part));
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
```

### 2. Update User Repository
```typescript
// backend/src/repositories/user.repository.ts
import { encryptionService } from '@/services/encryption.service';

export class UserRepository extends BaseRepository<User> {
  // Override create to encrypt sensitive data
  async create(data: Prisma.UserCreateInput): Promise<User> {
    const encryptedData = { ...data };
    
    // Encrypt Plex token if provided
    if (data.plexToken) {
      encryptedData.plexToken = encryptionService.encryptForStorage(data.plexToken);
    }
    
    const user = await this.prisma.user.create({ data: encryptedData });
    return this.decryptUserData(user);
  }

  // Override update to encrypt sensitive data
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    const encryptedData = { ...data };
    
    // Encrypt Plex token if provided
    if (data.plexToken && typeof data.plexToken === 'string') {
      encryptedData.plexToken = encryptionService.encryptForStorage(data.plexToken);
    }
    
    const user = await this.prisma.user.update({
      where: { id },
      data: encryptedData,
    });
    
    return this.decryptUserData(user);
  }

  // Override findById to decrypt data
  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.decryptUserData(user) : null;
  }

  // Override findMany to decrypt data
  async findMany(args?: Prisma.UserFindManyArgs): Promise<User[]> {
    const users = await this.prisma.user.findMany(args);
    return Promise.all(users.map(user => this.decryptUserData(user)));
  }

  // Helper to decrypt user data
  private decryptUserData(user: User): User {
    const decrypted = { ...user };
    
    // Decrypt Plex token if it exists and is encrypted
    if (user.plexToken && encryptionService.isEncrypted(user.plexToken)) {
      try {
        decrypted.plexToken = encryptionService.decryptFromStorage(user.plexToken);
      } catch (error) {
        logger.error('Failed to decrypt Plex token', { 
          userId: user.id, 
          error 
        });
        // Don't expose encryption errors to users
        decrypted.plexToken = null;
      }
    }
    
    return decrypted;
  }
}
```

### 3. Update Service Configuration Repository
```typescript
// backend/src/repositories/service-config.repository.ts
export class ServiceConfigRepository extends BaseRepository<ServiceConfig> {
  async create(data: Prisma.ServiceConfigCreateInput): Promise<ServiceConfig> {
    const encryptedData = { ...data };
    
    // Encrypt API key if provided
    if (data.apiKey) {
      encryptedData.apiKey = encryptionService.encryptForStorage(data.apiKey);
    }
    
    const config = await this.prisma.serviceConfig.create({ data: encryptedData });
    return this.decryptConfigData(config);
  }

  async update(id: number, data: Prisma.ServiceConfigUpdateInput): Promise<ServiceConfig> {
    const encryptedData = { ...data };
    
    // Encrypt API key if provided
    if (data.apiKey && typeof data.apiKey === 'string') {
      encryptedData.apiKey = encryptionService.encryptForStorage(data.apiKey);
    }
    
    const config = await this.prisma.serviceConfig.update({
      where: { id },
      data: encryptedData,
    });
    
    return this.decryptConfigData(config);
  }

  private decryptConfigData(config: ServiceConfig): ServiceConfig {
    const decrypted = { ...config };
    
    if (config.apiKey && encryptionService.isEncrypted(config.apiKey)) {
      try {
        decrypted.apiKey = encryptionService.decryptFromStorage(config.apiKey);
      } catch (error) {
        logger.error('Failed to decrypt API key', { 
          service: config.serviceName, 
          error 
        });
        decrypted.apiKey = null;
      }
    }
    
    return decrypted;
  }
}
```

### 4. Generate Encryption Key Script
```typescript
// scripts/generate-encryption-key.js
const crypto = require('crypto');

// Generate a secure 32-byte key
const key = crypto.randomBytes(32).toString('base64');

console.log('Generated encryption key:');
console.log(key);
console.log('\nAdd this to your .env file:');
console.log(`ENCRYPTION_KEY="${key}"`);
```

### 5. Migration for Existing Data
```typescript
// backend/src/migrations/encrypt-existing-data.ts
import { PrismaClient } from '@prisma/client';
import { encryptionService } from '@/services/encryption.service';

async function encryptExistingData() {
  const prisma = new PrismaClient();
  
  try {
    // Encrypt existing Plex tokens
    const users = await prisma.user.findMany({
      where: {
        plexToken: { not: null },
      },
    });
    
    for (const user of users) {
      if (user.plexToken && !encryptionService.isEncrypted(user.plexToken)) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plexToken: encryptionService.encryptForStorage(user.plexToken),
          },
        });
        console.log(`Encrypted Plex token for user ${user.id}`);
      }
    }
    
    // Encrypt existing API keys
    const configs = await prisma.serviceConfig.findMany({
      where: {
        apiKey: { not: null },
      },
    });
    
    for (const config of configs) {
      if (config.apiKey && !encryptionService.isEncrypted(config.apiKey)) {
        await prisma.serviceConfig.update({
          where: { id: config.id },
          data: {
            apiKey: encryptionService.encryptForStorage(config.apiKey),
          },
        });
        console.log(`Encrypted API key for service ${config.serviceName}`);
      }
    }
    
    console.log('Encryption migration completed');
  } catch (error) {
    console.error('Encryption migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  encryptExistingData();
}
```

### 6. Environment Configuration
```bash
# .env
ENCRYPTION_KEY="your-32-byte-base64-key-here"
```

### 7. Update Configuration Schema
```typescript
// backend/src/config/index.ts
export const config = {
  // ... other config
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
};

// Validate encryption key on startup
if (!config.encryption.key || config.encryption.key.length < 32) {
  throw new Error('ENCRYPTION_KEY must be set and at least 32 characters');
}
```

## Technical Implementation Details

### Key Management Best Practices
1. Store encryption key in environment variable
2. Never commit encryption keys to version control
3. Use different keys for different environments
4. Rotate keys periodically
5. Back up keys securely

### Performance Considerations
- Encryption/decryption adds ~1-2ms per operation
- Cache decrypted values in memory when appropriate
- Don't encrypt data that doesn't need protection

### Future Enhancements
1. Key rotation mechanism
2. Hardware security module (HSM) support
3. Field-level encryption attributes in Prisma
4. Audit log for encryption operations

## Acceptance Criteria
1. ✅ Encryption service implements AES-256-GCM correctly
2. ✅ All Plex tokens encrypted before storage
3. ✅ All API keys encrypted before storage
4. ✅ Decryption works transparently in repositories
5. ✅ Migration script encrypts existing data
6. ✅ Invalid encryption keys prevented on startup
7. ✅ Encryption errors logged but don't crash app
8. ✅ Performance impact minimal (<2ms per operation)

## Testing Requirements
1. **Unit Tests:**
   - Encryption/decryption round trip
   - Invalid data handling
   - Key validation
   - Format detection

2. **Integration Tests:**
   - Repository encryption/decryption
   - Database storage and retrieval
   - Migration script

## Security Considerations
- Use crypto.scrypt for key derivation
- Generate new IV for each encryption
- Verify auth tag on decryption
- Never log encryption keys or decrypted data
- Handle decryption failures gracefully

## References
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [AES-GCM Best Practices](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

## Status
- [ ] Not Started
- [ ] In Progress
- [x] Completed
- [ ] Blocked

## Implementation Notes
- Created EncryptionService with AES-256-GCM encryption
- Updated UserRepository to encrypt/decrypt Plex tokens
- Updated ServiceConfigRepository to encrypt/decrypt API keys
- Created key generation script: `npm run generate:key`
- All sensitive data now encrypted at rest
- Decryption handled transparently in repositories