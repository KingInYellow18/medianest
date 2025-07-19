# Task: Database Schema for Monitor Visibility Control

## Task ID

task-20250119-1205-database-schema-monitor-visibility

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P1 (High)

## Description

Design and implement the database schema changes required to support admin control over Uptime Kuma monitor visibility. This includes creating a new table to track which monitors are visible to regular users vs admin-only, with proper relationships and constraints.

## Acceptance Criteria

### Schema Design

- [ ] New `monitor_visibility` table created with proper structure
- [ ] Foreign key relationships properly defined
- [ ] Appropriate indexes for query performance
- [ ] Default visibility setting (admin-only for security)
- [ ] Audit fields (created_at, updated_at, updated_by)

### Data Integrity

- [ ] Unique constraints prevent duplicate monitor entries
- [ ] Cascade rules properly handle user deletions
- [ ] Validation constraints ensure data consistency
- [ ] Migration safely handles existing data

### Performance Considerations

- [ ] Indexes on frequently queried fields
- [ ] Efficient JOIN patterns with existing tables
- [ ] Query performance optimized for dashboard filtering

## Technical Requirements

### Database Schema

```sql
-- New table for monitor visibility control
CREATE TABLE monitor_visibility (
  id                SERIAL PRIMARY KEY,
  monitor_id        VARCHAR(255) NOT NULL,        -- Uptime Kuma monitor ID
  monitor_name      VARCHAR(255) NOT NULL,        -- Human-readable name
  is_public         BOOLEAN NOT NULL DEFAULT FALSE, -- false = admin-only, true = visible to users
  monitor_url       VARCHAR(500),                 -- Monitor URL for reference
  monitor_type      VARCHAR(100),                 -- Monitor type (http, ping, etc.)
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  UNIQUE(monitor_id),
  CHECK (monitor_name != ''),
  CHECK (monitor_id != '')
);

-- Indexes for performance
CREATE INDEX idx_monitor_visibility_is_public ON monitor_visibility(is_public);
CREATE INDEX idx_monitor_visibility_monitor_id ON monitor_visibility(monitor_id);
CREATE INDEX idx_monitor_visibility_updated_at ON monitor_visibility(updated_at);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_monitor_visibility_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_monitor_visibility_updated_at
  BEFORE UPDATE ON monitor_visibility
  FOR EACH ROW
  EXECUTE FUNCTION update_monitor_visibility_updated_at();
```

### Prisma Schema Updates

```prisma
model MonitorVisibility {
  id          Int      @id @default(autoincrement())
  monitorId   String   @unique @map("monitor_id") @db.VarChar(255)
  monitorName String   @map("monitor_name") @db.VarChar(255)
  isPublic    Boolean  @default(false) @map("is_public")
  monitorUrl  String?  @map("monitor_url") @db.VarChar(500)
  monitorType String?  @map("monitor_type") @db.VarChar(100)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  updatedBy   Int?     @map("updated_by")

  // Relations
  updatedByUser User? @relation(fields: [updatedBy], references: [id], onDelete: SetNull)

  // Indexes
  @@index([isPublic])
  @@index([monitorId])
  @@index([updatedAt])
  @@map("monitor_visibility")
}

// Update User model to include relation
model User {
  // ... existing fields
  monitorVisibilityUpdates MonitorVisibility[]
}
```

## Files to Modify/Create

### Database Files

- `backend/prisma/schema.prisma` - Add MonitorVisibility model and User relation
- `backend/prisma/migrations/YYYYMMDD_add_monitor_visibility.sql` - Migration file

### Migration Strategy

1. Create new table structure
2. Populate with existing monitors (default admin-only)
3. Verify data integrity
4. Update application code to use new schema

## Testing Strategy

### Migration Testing

- [ ] Test migration on empty database
- [ ] Test migration with existing Uptime Kuma data
- [ ] Test rollback procedures
- [ ] Verify all constraints work correctly

### Data Integrity Tests

- [ ] Unique constraint enforcement
- [ ] Foreign key relationship validation
- [ ] Default value assignments
- [ ] Trigger functionality

### Performance Tests

- [ ] Query performance with indexes
- [ ] JOIN performance with Users table
- [ ] Bulk operations performance

## Migration Plan

### Phase 1: Schema Creation

1. Add new model to Prisma schema
2. Generate migration file
3. Review migration SQL
4. Test on development database

### Phase 2: Data Population

1. Create seed script to populate existing monitors
2. Set all existing monitors to admin-only initially
3. Verify data consistency

### Phase 3: Validation

1. Test all constraints and relationships
2. Verify query performance
3. Run comprehensive data validation

## Security Considerations

### Access Control

- Monitor visibility data should only be readable by authenticated users
- Only admins should be able to modify visibility settings
- Audit trail via updated_by field

### Data Protection

- Monitor names and URLs may contain sensitive information
- Ensure proper backup procedures include new table
- Consider encryption for sensitive monitor URLs

## Progress Log

### 2025-01-19 12:05 - Task Created

- Designed database schema with proper relationships
- Planned migration strategy with data population
- Identified performance optimizations and indexes
- Created comprehensive validation plan

## Related Tasks

- Depends on: task-20250119-1200-uptime-kuma-admin-visibility-analysis
- Blocks: task-20250119-1210-backend-monitor-visibility-service
- Blocks: task-20250119-1215-admin-api-endpoints
- Related: All subsequent implementation tasks

## Notes

### Design Decisions

1. **Table Name**: `monitor_visibility` chosen for clarity
2. **Default Visibility**: FALSE (admin-only) for security-first approach
3. **Monitor Identification**: Use Uptime Kuma's monitor ID as unique identifier
4. **Audit Trail**: Include updated_by for administrative accountability
5. **Cascade Behavior**: SET NULL on user deletion to preserve history

### Data Population Strategy

- Initially all monitors will be admin-only
- Admins must explicitly make monitors public
- This ensures no accidental exposure of sensitive monitors

### Future Extensions

- Could add monitor categories/groups
- Could add scheduled visibility changes
- Could add per-user custom visibility (beyond admin control)

### Prisma Considerations

- Use proper field mapping for PostgreSQL naming conventions
- Include appropriate indexes for query optimization
- Maintain consistency with existing model patterns
