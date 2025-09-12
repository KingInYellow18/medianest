import { Pool, PoolClient } from 'pg';

import { testMediaRequests } from '../fixtures/test-data';
import { testUsers, allTestUsers } from '../fixtures/users.fixture';

/**
 * Database helper utilities for E2E testing
 * Provides direct database access for test setup, cleanup, and verification
 */
export class DatabaseHelpers {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'medianest_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      this.isConnected = true;
      console.log('Database connection established');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database connection closed');
    }
  }

  /**
   * Execute raw SQL query
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Execute query and return first row
   */
  async queryOne(sql: string, params: any[] = []): Promise<any> {
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Execute query and return all rows
   */
  async queryMany(sql: string, params: any[] = []): Promise<any[]> {
    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Start database transaction
   */
  async beginTransaction(): Promise<PoolClient> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Commit transaction
   */
  async commitTransaction(client: PoolClient): Promise<void> {
    await client.query('COMMIT');
    client.release();
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(client: PoolClient): Promise<void> {
    await client.query('ROLLBACK');
    client.release();
  }

  // User management
  /**
   * Create test user
   */
  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: string;
    isActive?: boolean;
  }): Promise<any> {
    const hashedPassword = await this.hashPassword(userData.password);

    const sql = `
      INSERT INTO users (name, email, password, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;

    const result = await this.queryOne(sql, [
      userData.name,
      userData.email,
      hashedPassword,
      userData.role || 'user',
      userData.isActive !== false,
    ]);

    return result;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any> {
    const sql = 'SELECT * FROM users WHERE email = $1';
    return await this.queryOne(sql, [email]);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<any> {
    const sql = 'SELECT * FROM users WHERE id = $1';
    return await this.queryOne(sql, [id]);
  }

  /**
   * Update user
   */
  async updateUser(id: string, updates: any): Promise<any> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const sql = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    return await this.queryOne(sql, [id, ...values]);
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    const sql = 'DELETE FROM users WHERE id = $1';
    await this.query(sql, [id]);
  }

  /**
   * Delete user by email
   */
  async deleteUserByEmail(email: string): Promise<void> {
    const sql = 'DELETE FROM users WHERE email = $1';
    await this.query(sql, [email]);
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<any[]> {
    const sql = 'SELECT * FROM users ORDER BY created_at DESC';
    return await this.queryMany(sql);
  }

  // Media request management
  /**
   * Create media request
   */
  async createMediaRequest(requestData: {
    title: string;
    description: string;
    type: string;
    priority: string;
    status?: string;
    dueDate?: string;
    userId: string;
    metadata?: any;
  }): Promise<any> {
    const sql = `
      INSERT INTO media_requests (
        title, description, type, priority, status, due_date, user_id, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;

    return await this.queryOne(sql, [
      requestData.title,
      requestData.description,
      requestData.type,
      requestData.priority,
      requestData.status || 'pending',
      requestData.dueDate,
      requestData.userId,
      JSON.stringify(requestData.metadata || {}),
    ]);
  }

  /**
   * Get media request by ID
   */
  async getMediaRequestById(id: string): Promise<any> {
    const sql = 'SELECT * FROM media_requests WHERE id = $1';
    return await this.queryOne(sql, [id]);
  }

  /**
   * Get media requests by user ID
   */
  async getMediaRequestsByUserId(userId: string): Promise<any[]> {
    const sql = 'SELECT * FROM media_requests WHERE user_id = $1 ORDER BY created_at DESC';
    return await this.queryMany(sql, [userId]);
  }

  /**
   * Update media request
   */
  async updateMediaRequest(id: string, updates: any): Promise<any> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const sql = `
      UPDATE media_requests 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    return await this.queryOne(sql, [id, ...values]);
  }

  /**
   * Delete media request
   */
  async deleteMediaRequest(id: string): Promise<void> {
    const sql = 'DELETE FROM media_requests WHERE id = $1';
    await this.query(sql, [id]);
  }

  /**
   * Get all media requests
   */
  async getAllMediaRequests(): Promise<any[]> {
    const sql = `
      SELECT mr.*, u.name as user_name, u.email as user_email
      FROM media_requests mr
      JOIN users u ON mr.user_id = u.id
      ORDER BY mr.created_at DESC
    `;
    return await this.queryMany(sql);
  }

  // Test data setup and cleanup
  /**
   * Seed test users
   */
  async seedTestUsers(): Promise<any[]> {
    const createdUsers = [];

    for (const user of allTestUsers) {
      try {
        // Check if user already exists
        const existingUser = await this.getUserByEmail(user.email);
        if (existingUser) {
          createdUsers.push(existingUser);
          continue;
        }

        const createdUser = await this.createUser(user);
        createdUsers.push(createdUser);
        console.log(`Created test user: ${user.email}`);
      } catch (error) {
        console.error(`Failed to create user ${user.email}:`, error);
      }
    }

    return createdUsers;
  }

  /**
   * Seed test media requests
   */
  async seedTestMediaRequests(userId?: string): Promise<any[]> {
    const createdRequests = [];

    // Use first test user if no userId provided
    if (!userId) {
      const user = await this.getUserByEmail(testUsers.regularUser.email);
      if (!user) {
        throw new Error('Test user not found. Run seedTestUsers first.');
      }
      userId = user.id;
    }

    for (const request of Object.values(testMediaRequests)) {
      try {
        const requestData = {
          ...request,
          userId,
          metadata: request.metadata || {},
        };

        const createdRequest = await this.createMediaRequest(requestData);
        createdRequests.push(createdRequest);
        console.log(`Created test request: ${request.title}`);
      } catch (error) {
        console.error(`Failed to create request ${request.title}:`, error);
      }
    }

    return createdRequests;
  }

  /**
   * Clean all test data
   */
  async cleanTestData(): Promise<void> {
    try {
      // Delete in order to respect foreign key constraints
      await this.query(
        "DELETE FROM media_requests WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@medianest.test')",
      );
      await this.query("DELETE FROM users WHERE email LIKE '%@medianest.test'");

      console.log('Test data cleaned successfully');
    } catch (error) {
      console.error('Failed to clean test data:', error);
      throw error;
    }
  }

  /**
   * Reset test database (truncate all tables)
   */
  async resetTestDatabase(): Promise<void> {
    try {
      // Get all table names
      const tablesResult = await this.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename != 'migrations'
      `);

      const tables = tablesResult.rows.map((row: any) => row.tablename);

      if (tables.length > 0) {
        // Truncate all tables with cascade
        await this.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
        console.log('Test database reset successfully');
      }
    } catch (error) {
      console.error('Failed to reset test database:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    try {
      // This would typically run your migration files
      // Implementation depends on your migration system
      console.log('Migrations would be run here');
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  // Utility methods
  /**
   * Hash password (simplified - use your actual hashing method)
   */
  private async hashPassword(password: string): Promise<string> {
    // This is a simplified example - use bcrypt or your actual hashing method
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 10);
  }

  /**
   * Check if table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    const sql = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `;

    const result = await this.queryOne(sql, [tableName]);
    return result.exists;
  }

  /**
   * Get table row count
   */
  async getTableRowCount(tableName: string): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const result = await this.queryOne(sql);
    return parseInt(result.count);
  }

  /**
   * Execute multiple queries in transaction
   */
  async executeInTransaction(queries: { sql: string; params?: any[] }[]): Promise<any[]> {
    const client = await this.beginTransaction();
    const results = [];

    try {
      for (const { sql, params = [] } of queries) {
        const result = await client.query(sql, params);
        results.push(result);
      }

      await this.commitTransaction(client);
      return results;
    } catch (error) {
      await this.rollbackTransaction(client);
      throw error;
    }
  }

  /**
   * Wait for condition to be met
   */
  async waitForCondition(
    checkQuery: string,
    params: any[] = [],
    condition: (result: any) => boolean,
    timeout = 30000,
    interval = 1000,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.queryOne(checkQuery, params);
        if (condition(result)) {
          return true;
        }
      } catch (error) {
        // Continue waiting if query fails
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return false;
  }

  /**
   * Get database stats
   */
  async getDatabaseStats(): Promise<any> {
    const userCount = await this.getTableRowCount('users');
    const requestCount = await this.getTableRowCount('media_requests');

    return {
      users: userCount,
      mediaRequests: requestCount,
      timestamp: new Date().toISOString(),
    };
  }
}

// Create singleton instance
export const dbHelpers = new DatabaseHelpers();

// Export class for custom instances
export default DatabaseHelpers;
