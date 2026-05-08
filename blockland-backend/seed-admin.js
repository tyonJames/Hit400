// =============================================================================
// seed-admin.js — Creates the initial BlockLand administrator account
// Run AFTER migrations: node seed-admin.js
// Admin credentials: admin@blockland.co.zw / Admin@1234
// =============================================================================

const { Client } = require('./node_modules/pg');
const bcrypt     = require('./node_modules/bcrypt');
const crypto     = require('crypto');

const DB = {
  host:     'localhost',
  port:     5432,
  database: 'blockland_db',
  user:     'postgres',
  password: 'postgres',
};

async function main() {
  const client = new Client(DB);
  await client.connect();
  console.log('Connected to PostgreSQL\n');

  try {
    // Check roles exist
    const rolesRes = await client.query(`SELECT id, name FROM roles`);
    if (!rolesRes.rows.length) {
      throw new Error('Roles table is empty — run migrations first: npm run migration:run');
    }
    const roles = {};
    rolesRes.rows.forEach((r) => { roles[r.name] = r.id; });
    console.log('Roles found:', Object.keys(roles).join(', '));

    if (!roles['ADMIN']) {
      throw new Error('ADMIN role not found. Ensure the migration ran successfully.');
    }

    // Check if admin already exists
    const exists = await client.query(
      `SELECT u.id FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'ADMIN' LIMIT 1`
    );
    if (exists.rows.length) {
      console.log('Admin user already exists — skipping creation.');
      console.log('\nAdmin credentials:');
      console.log('  Email:    admin@blockland.co.zw');
      console.log('  Password: Admin@1234');
      return;
    }

    const userId       = crypto.randomUUID();
    const passwordHash = await bcrypt.hash('Admin@1234', 12);
    const now          = new Date().toISOString();

    await client.query(
      `INSERT INTO users (
         id, full_name, national_id, email, phone,
         password_hash, wallet_address,
         is_active, is_approved, approved_at, approved_by_id,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$11)`,
      [
        userId,
        'System Administrator',
        '00-0000000A00',
        'admin@blockland.co.zw',
        '0770000000',
        passwordHash,
        null,
        true,
        true,
        now,
        now,
      ]
    );

    await client.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, roles['ADMIN']]
    );

    console.log('\nAdmin account created successfully.');
    console.log('\nAdmin credentials:');
    console.log('  Email:    admin@blockland.co.zw');
    console.log('  Password: Admin@1234');
    console.log('\nChange the password after first login.');

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  console.error('Make sure PostgreSQL is running and migrations have been applied.');
  process.exit(1);
});
