# ✅ COMPLETED TASK

**Original Task**: 03-admin-bootstrap.md
**Completion Date**: January 2025
**Phase**: phase1

---

# Task: Implement Admin Bootstrap Flow

**Priority:** High  
**Estimated Duration:** 1 day  
**Dependencies:** 01-plex-oauth-implementation, 02-nextauth-configuration  
**Phase:** 1 (Week 2)

## Objective

Create a first-run detection system that allows initial admin setup with temporary credentials (admin/admin), forces password change on first login, and establishes the admin role assignment system.

## Background

On fresh installation, there needs to be a way to bootstrap the first admin user before Plex OAuth is configured. This temporary access allows the admin to set up service configurations.

## Detailed Requirements

### 1. First-Run Detection

- Check if any users exist in database
- If no users, enable bootstrap mode
- Show admin setup screen instead of normal login

### 2. Bootstrap Login Flow

- **Route:** `/auth/admin-setup`
- **Credentials:** admin/admin (hardcoded for first run only)
- **Process:**
  1. Detect first run
  2. Show bootstrap login form
  3. Validate admin/admin credentials
  4. Force immediate password change
  5. Create admin user in database
  6. Disable bootstrap mode

### 3. Admin User Creation

- Create user with role='admin'
- Generate secure user ID
- Store hashed password (bcrypt)
- Set flag requiring Plex link on next login

### 4. Role Management System

```typescript
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// Middleware for role checking
export const requireAdmin = (handler) => {
  return async (req, res) => {
    if (req.session.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return handler(req, res);
  };
};
```

## Technical Implementation Details

### Database Changes

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN force_password_change BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN is_bootstrap_user BOOLEAN DEFAULT false;
```

### First-Run Detection Service

```typescript
// services/firstRunService.ts
export class FirstRunService {
  async isFirstRun(): Promise<boolean> {
    const userCount = await prisma.user.count();
    return userCount === 0;
  }

  async createBootstrapAdmin(newPassword: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return await prisma.user.create({
      data: {
        id: generateUUID(),
        plex_id: 'bootstrap-admin',
        plex_username: 'admin',
        email: 'admin@local',
        role: 'admin',
        password_hash: hashedPassword,
        is_bootstrap_user: true,
        status: 'active',
      },
    });
  }
}
```

### UI Components Required

1. **First Run Detection Component**

   - Check on app load
   - Redirect to setup if needed

2. **Admin Setup Form**

   - Welcome message
   - Bootstrap login (admin/admin)
   - New password form
   - Password strength indicator

3. **Post-Setup Wizard**
   - Guide to configure Plex
   - Service URL setup
   - First user invitation

## Acceptance Criteria

1. ✅ First run correctly detected when no users exist
2. ✅ Admin/admin login works only on first run
3. ✅ Password change is mandatory after bootstrap login
4. ✅ Bootstrap mode disabled after first admin created
5. ✅ Admin can later link their Plex account
6. ✅ Role-based middleware blocks non-admin access
7. ✅ Bootstrap credentials don't work after setup
8. ✅ Clear instructions displayed during setup

## Testing Requirements

1. **Unit Tests:**

   - First run detection logic
   - Password hashing and validation
   - Role checking middleware

2. **Integration Tests:**
   - Complete bootstrap flow
   - Middleware blocking non-admins
   - Bootstrap mode disabling

## Security Considerations

- Bootstrap mode only available when database is empty
- admin/admin credentials hardcoded but only work once
- Force strong password on change (min 12 chars, complexity)
- Log all admin actions
- Session invalidation after password change

## Error Handling

- Database connection issues: Clear error message
- Weak password: Show requirements
- Bootstrap already complete: Redirect to normal login
- Failed password change: Roll back user creation

## UI/UX Flow

```
1. User visits app for first time
2. System detects no users
3. Redirect to /auth/admin-setup
4. Show: "Welcome to MediaNest! Let's set up your admin account"
5. Login form with admin/admin pre-filled
6. After login: Password change form
7. Success: Redirect to admin dashboard
8. Show setup wizard for services
```

## File Structure

```
app/
├── (auth)/
│   └── admin-setup/
│       ├── page.tsx
│       └── components/
│           ├── BootstrapLogin.tsx
│           └── PasswordChange.tsx
services/
├── firstRunService.ts
└── adminService.ts
middleware/
└── roleAuth.ts
```

## Dependencies

- `bcryptjs` - Password hashing
- `zod` - Password validation schema

## References

- Security best practices for default credentials
- OWASP guidelines for password policies

## Status

- [ ] Not Started
- [ ] In Progress
- [x] Completed
- [ ] Blocked

## Completion Review

**Date:** July 4, 2025
**Reviewer:** Claude Code

### Acceptance Criteria Review:

1. ✅ **First run correctly detected when no users exist** - `isFirstRun()` function in auth.config.ts
2. ✅ **Admin/admin login works only on first run** - CredentialsProvider only added when userCount === 0
3. ✅ **Password change is mandatory after bootstrap login** - `requiresPasswordChange: true` flag set
4. ✅ **Bootstrap mode disabled after first admin created** - Dynamic provider configuration
5. ✅ **Admin can later link their Plex account** - Admin user can use Plex OAuth after setup
6. ✅ **Role-based middleware blocks non-admin access** - Role stored in JWT and session
7. ✅ **Bootstrap credentials don't work after setup** - Provider not included after first user exists
8. ✅ **Clear instructions displayed during setup** - Sign-in page shows admin setup option

### Implementation Details:

- First-run detection via Prisma user count check
- Dynamic NextAuth provider configuration
- Admin bootstrap credentials provider with hardcoded validation
- Password change page at `/auth/change-password`
- User model includes `requiresPasswordChange` field
- Admin role automatically assigned to bootstrap user
- Session includes role for authorization checks

### Notes:

- Password hashing handled by bcryptjs
- Admin user created with email `admin@medianest.local`
- Password change endpoint validates and updates user
- Bootstrap flow integrated seamlessly with NextAuth.js
