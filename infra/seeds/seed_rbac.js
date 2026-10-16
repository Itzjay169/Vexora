#!/usr/bin/env node

/**
 * Vexora RBAC Seed — Phase 8
 *
 * Seeds the role_permissions junction table with the authoritative
 * permission matrix from rbac.js. This ensures the database mirrors
 * the code-level permission definitions.
 *
 * Run: node infra/seeds/seed_rbac.js
 */

import { query, withTransaction } from '../../backend/src/common/database.js';
import { getAllRoles, getPermissionsForRole, getAllPermissions } from '../../backend/src/common/rbac.js';

export async function seedRbacPermissions() {
  console.log('🛡️  Seeding RBAC Permission Matrix (Phase 8)...');

  try {
    await withTransaction(async (client) => {
      // 1. Ensure all permissions from the code matrix exist in the DB
      const allPermissions = getAllPermissions();
      console.log(`  📋 Syncing ${allPermissions.length} permissions...`);

      for (const perm of allPermissions) {
        const [module, action] = perm.split(':');
        await client.query(
          `INSERT INTO permissions (name, module, action, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (name) DO UPDATE SET module = EXCLUDED.module, action = EXCLUDED.action`,
          [perm, module, action, `${module}/${action} permission`]
        );
      }

      // 2. Clear existing role_permissions to rebuild from source of truth
      await client.query(`DELETE FROM role_permissions`);
      console.log('  🔄 Cleared existing role_permissions (rebuilding from code matrix)...');

      // 3. Map each role to its permissions
      const allRoles = getAllRoles();
      let totalMappings = 0;

      for (const roleName of allRoles) {
        // Get or create the role row
        const roleResult = await client.query(
          `SELECT id FROM roles WHERE name = $1`,
          [roleName]
        );

        if (roleResult.rows.length === 0) {
          console.log(`  ⚠️  Role "${roleName}" not in roles table — skipping`);
          continue;
        }

        const roleId = roleResult.rows[0].id;
        const permissions = getPermissionsForRole(roleName);

        for (const permName of permissions) {
          const permResult = await client.query(
            `SELECT id FROM permissions WHERE name = $1`,
            [permName]
          );

          if (permResult.rows.length === 0) continue;

          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2)
             ON CONFLICT (role_id, permission_id) DO NOTHING`,
            [roleId, permResult.rows[0].id]
          );
          totalMappings++;
        }

        console.log(`  👑 ${roleName}: ${permissions.length} permissions assigned`);
      }

      console.log(`  ✅ Total role-permission mappings: ${totalMappings}`);
    });

    console.log('✅ RBAC Permission Matrix seed completed.');
  } catch (err) {
    console.warn(`⚠️ RBAC seed note: ${err.message}`);
  }
}

// Run directly if invoked from CLI
const isMain = process.argv[1] && (
  process.argv[1].endsWith('seed_rbac.js') ||
  process.argv[1].includes('seed_rbac.js')
);

if (isMain) {
  seedRbacPermissions()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ RBAC seeding failed:', err);
      process.exit(1);
    });
}
