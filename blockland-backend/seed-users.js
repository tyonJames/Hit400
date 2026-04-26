// =============================================================================
// seed-users.js — BlockLand Zimbabwe Test Data Seeder
// Run: node seed-users.js
// Password for all seeded users: Test@1234
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

function uuid() {
  return crypto.randomUUID();
}

function fakeBlockchainTx() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

function fakeTokenId(n) {
  return `u${String(n).padStart(6, '0')}`;
}

function fakeRecordHash() {
  return crypto.randomBytes(32).toString('hex');
}

function fakeIpfs() {
  return 'Qm' + crypto.randomBytes(22).toString('hex').slice(0, 44);
}

function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function registrationDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Zimbabwean cities/areas with GPS coordinates
// ---------------------------------------------------------------------------
const LOCATIONS = [
  { city: 'Harare',   area: 'Borrowdale',      lat: -17.7252, lng: 31.0785 },
  { city: 'Harare',   area: 'Highlands',        lat: -17.8010, lng: 31.0617 },
  { city: 'Harare',   area: 'Avondale',         lat: -17.8001, lng: 31.0333 },
  { city: 'Harare',   area: 'Mount Pleasant',   lat: -17.7735, lng: 31.0511 },
  { city: 'Harare',   area: 'Greendale',        lat: -17.8225, lng: 31.1073 },
  { city: 'Harare',   area: 'Budiriro',         lat: -17.8993, lng: 30.9990 },
  { city: 'Harare',   area: 'Mbare',            lat: -17.8614, lng: 31.0306 },
  { city: 'Harare',   area: 'Kuwadzana',        lat: -17.8417, lng: 30.9442 },
  { city: 'Bulawayo', area: 'Suburbs',          lat: -20.1370, lng: 28.6158 },
  { city: 'Bulawayo', area: 'Nketa',            lat: -20.1780, lng: 28.6013 },
  { city: 'Bulawayo', area: 'Cowdray Park',     lat: -20.2104, lng: 28.5823 },
  { city: 'Bulawayo', area: 'Hillside',         lat: -20.1578, lng: 28.6445 },
  { city: 'Mutare',   area: 'Dangamvura',       lat: -18.9948, lng: 32.6553 },
  { city: 'Mutare',   area: 'Hobhouse',         lat: -18.9601, lng: 32.6399 },
  { city: 'Gweru',    area: 'Mkoba',            lat: -19.4734, lng: 29.8203 },
  { city: 'Gweru',    area: 'Senga',            lat: -19.4520, lng: 29.8140 },
  { city: 'Masvingo', area: 'Mucheke',          lat: -20.0771, lng: 30.8250 },
  { city: 'Masvingo', area: 'Rujeko',           lat: -20.0820, lng: 30.8100 },
  { city: 'Kwekwe',   area: 'Mbizo',            lat: -18.9376, lng: 29.8095 },
  { city: 'Chitungwiza', area: 'Unit D',        lat: -17.9900, lng: 31.0767 },
  { city: 'Chitungwiza', area: 'Unit L',        lat: -18.0047, lng: 31.0612 },
  { city: 'Bindura',  area: 'Somerset',         lat: -17.2958, lng: 31.3337 },
  { city: 'Kadoma',   area: 'Rimuka',           lat: -18.3536, lng: 29.9112 },
  { city: 'Marondera', area: 'Dombotombo',      lat: -18.1858, lng: 31.5465 },
  { city: 'Zvishavane', area: 'Mandava',        lat: -20.3355, lng: 30.0440 },
  { city: 'Chiredzi', area: 'Triangle',         lat: -21.0409, lng: 31.5778 },
  { city: 'Harare',   area: 'Westgate',         lat: -17.8003, lng: 30.9832 },
  { city: 'Harare',   area: 'Dzivarasekwa',     lat: -17.8751, lng: 30.9673 },
  { city: 'Bulawayo', area: 'Mpopoma',          lat: -20.1612, lng: 28.5900 },
  { city: 'Harare',   area: 'Glen View',        lat: -17.9120, lng: 31.0180 },
  { city: 'Harare',   area: 'Hatfield',         lat: -17.8552, lng: 31.1015 },
];

const ZONING = ['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'INDUSTRIAL'];

function zonedStreet(loc, zoning) {
  const streets = {
    RESIDENTIAL:  ['Jacaranda Rd', 'Flame Lily Ave', 'Msasa Cres', 'Acacia Dr', 'Bougainvillea St'],
    COMMERCIAL:   ['Main St', 'Commerce Rd', 'Market Ave', 'Enterprise Rd', 'Business Park'],
    AGRICULTURAL: ['Farm Road', 'Irrigation Way', 'Homestead Lane', 'Grazing Rd', 'Crop Fields Rd'],
    INDUSTRIAL:   ['Factory Rd', 'Industrial Ave', 'Workshop St', 'Manufacturing Dr', 'Depot Rd'],
  };
  const list = streets[zoning] || streets.RESIDENTIAL;
  return list[Math.floor(Math.random() * list.length)];
}

// ---------------------------------------------------------------------------
// 20 Zimbabwean test users
// ---------------------------------------------------------------------------
const USERS_DATA = [
  { fullName: 'Tendai Moyo',          nationalId: '63-7142110A71', email: 'tendai.moyo@mail.co.zw',       phone: '0772301001', props: 2 },
  { fullName: 'Farai Mhende',         nationalId: '63-8201540B22', email: 'farai.mhende@mail.co.zw',      phone: '0773201002', props: 1 },
  { fullName: 'Shumirai Dube',        nationalId: '63-9312360C33', email: 'shumirai.dube@mail.co.zw',     phone: '0774301003', props: 3 },
  { fullName: 'Blessing Ncube',       nationalId: '63-6453480D44', email: 'blessing.ncube@mail.co.zw',    phone: '0775401004', props: 1 },
  { fullName: 'Tatenda Mutasa',       nationalId: '63-5594600E55', email: 'tatenda.mutasa@mail.co.zw',    phone: '0776501005', props: 2 },
  { fullName: 'Rutendo Zimba',        nationalId: '63-4635720F66', email: 'rutendo.zimba@mail.co.zw',     phone: '0777601006', props: 1 },
  { fullName: 'Simba Chikwanda',      nationalId: '63-3776840G77', email: 'simba.chikwanda@mail.co.zw',   phone: '0778701007', props: 2 },
  { fullName: 'Nomvula Mpofu',        nationalId: '63-2817960H88', email: 'nomvula.mpofu@mail.co.zw',     phone: '0779801008', props: 1 },
  { fullName: 'Tinotenda Chikowore',  nationalId: '63-1958080J99', email: 'tino.chikowore@mail.co.zw',    phone: '0780901009', props: 3 },
  { fullName: 'Rudo Makoni',          nationalId: '63-0099200K00', email: 'rudo.makoni@mail.co.zw',       phone: '0781001010', props: 1 },
  { fullName: 'Innocent Ndlovu',      nationalId: '63-9130320L11', email: 'innocent.ndlovu@mail.co.zw',   phone: '0782101011', props: 2 },
  { fullName: 'Memory Chirwa',        nationalId: '63-8271440M22', email: 'memory.chirwa@mail.co.zw',     phone: '0783201012', props: 1 },
  { fullName: 'Prosper Mutsvairo',    nationalId: '63-7312560N33', email: 'prosper.mutsvairo@mail.co.zw', phone: '0784301013', props: 1 },
  { fullName: 'Thandeka Sithole',     nationalId: '63-6453680P44', email: 'thandeka.sithole@mail.co.zw',  phone: '0785401014', props: 2 },
  { fullName: 'Kudzai Mutombo',       nationalId: '63-5594800Q55', email: 'kudzai.mutombo@mail.co.zw',    phone: '0786501015', props: 1 },
  { fullName: 'Dakarai Chigumba',     nationalId: '63-4635920R66', email: 'dakarai.chigumba@mail.co.zw',  phone: '0787601016', props: 1 },
  { fullName: 'Sithembile Moyo',      nationalId: '63-3776040S77', email: 'sithembile.moyo@mail.co.zw',   phone: '0788701017', props: 3 },
  { fullName: 'Ngoni Masango',        nationalId: '63-2817160T88', email: 'ngoni.masango@mail.co.zw',     phone: '0789801018', props: 1 },
  { fullName: 'Ruvimbo Mapuranga',    nationalId: '63-1958280U99', email: 'ruvimbo.mapuranga@mail.co.zw', phone: '0790901019', props: 2 },
  { fullName: 'Emmerson Takawira',    nationalId: '63-0099400V00', email: 'emmerson.takawira@mail.co.zw', phone: '0791001020', props: 2 },
];

async function main() {
  const client = new Client(DB);
  await client.connect();
  console.log('Connected to PostgreSQL\n');

  try {
    // -----------------------------------------------------------------------
    // 1. Fetch existing roles and admin user
    // -----------------------------------------------------------------------
    const rolesRes = await client.query(`SELECT id, name FROM roles`);
    const roles = {};
    rolesRes.rows.forEach((r) => { roles[r.name] = r.id; });
    console.log('Roles found:', Object.keys(roles).join(', '));

    const adminRes = await client.query(
      `SELECT u.id FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'ADMIN' LIMIT 1`
    );
    if (!adminRes.rows.length) throw new Error('No admin user found — seed the admin first.');
    const adminId = adminRes.rows[0].id;
    console.log('Admin ID:', adminId);

    // -----------------------------------------------------------------------
    // 2. Hash the shared test password
    // -----------------------------------------------------------------------
    const passwordHash = await bcrypt.hash('Test@1234', 12);
    console.log('\nPassword hashed. Seeding users...\n');

    // -----------------------------------------------------------------------
    // 3. Insert users + roles + properties + ownership records
    // -----------------------------------------------------------------------
    let locationIdx = 0;
    let tokenIdCounter = 1001;

    const insertedUsers = [];

    for (const ud of USERS_DATA) {
      // Check if user already exists
      const exists = await client.query(`SELECT id FROM users WHERE email = $1`, [ud.email]);
      if (exists.rows.length) {
        console.log(`  SKIP  ${ud.fullName} (already exists)`);
        insertedUsers.push({ id: exists.rows[0].id, ...ud });
        continue;
      }

      const userId = uuid();
      const now    = pastDate(Math.floor(Math.random() * 90) + 30); // 30-120 days ago

      await client.query(
        `INSERT INTO users (
           id, full_name, national_id, email, phone,
           password_hash, wallet_address,
           is_active, is_approved, approved_at, approved_by_id,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [
          userId,
          ud.fullName,
          ud.nationalId,
          ud.email,
          ud.phone,
          passwordHash,
          null,           // wallet_address
          true,           // is_active
          true,           // is_approved
          pastDate(Math.floor(Math.random() * 80) + 25),  // approved_at
          adminId,
          now,
        ]
      );

      // Assign USER role
      if (roles['USER']) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1,$2,NOW())
           ON CONFLICT DO NOTHING`,
          [userId, roles['USER']]
        );
      }

      insertedUsers.push({ id: userId, ...ud });
      console.log(`  ADDED ${ud.fullName} (${ud.email})`);
    }

    console.log(`\nSeeding ${insertedUsers.reduce((s, u) => s + u.props, 0)} properties...\n`);

    // -----------------------------------------------------------------------
    // 4. Insert properties + ownership records
    // -----------------------------------------------------------------------
    for (const user of insertedUsers) {
      for (let p = 0; p < user.props; p++) {
        const loc     = LOCATIONS[locationIdx % LOCATIONS.length];
        locationIdx++;
        const zoning  = ZONING[locationIdx % ZONING.length];
        const propId  = uuid();
        const owId    = uuid();
        const plotNum = `ZW-${loc.city.slice(0,3).toUpperCase()}-${String(tokenIdCounter).padStart(4,'0')}`;
        const deedNum = `TD-${loc.city.slice(0,3).toUpperCase()}-${String(tokenIdCounter).padStart(6,'0')}`;
        const houseNo = 1 + (tokenIdCounter % 999);
        const address = `${houseNo} ${zonedStreet(loc, zoning)}, ${loc.area}, ${loc.city}`;
        const gpsLat  = loc.lat  + (Math.random() - 0.5) * 0.02;
        const gpsLng  = loc.lng  + (Math.random() - 0.5) * 0.02;
        const size    = zoning === 'AGRICULTURAL' ? (1 + Math.random() * 10).toFixed(4)
                       : zoning === 'INDUSTRIAL'  ? (500 + Math.random() * 5000).toFixed(4)
                       : (200 + Math.random() * 800).toFixed(4);
        const unit    = zoning === 'AGRICULTURAL' ? 'HECTARE' : 'SQM';
        const regDate = registrationDate(Math.floor(Math.random() * 365) + 60);
        const txHash  = fakeBlockchainTx();
        const tokenId = fakeTokenId(tokenIdCounter);
        const recHash = fakeRecordHash();
        const ipfs    = fakeIpfs();
        const acqAt   = pastDate(Math.floor(Math.random() * 300) + 60);

        // Check for duplicate plot_number (just in case)
        const dupCheck = await client.query(
          `SELECT id FROM properties WHERE plot_number = $1 OR title_deed_number = $2`,
          [plotNum, deedNum]
        );
        if (dupCheck.rows.length) {
          console.log(`  SKIP  property ${plotNum} (duplicate)`);
          tokenIdCounter++;
          continue;
        }

        await client.query(
          `INSERT INTO properties (
             id, plot_number, title_deed_number, address,
             gps_lat, gps_lng, land_size, unit, zoning_type,
             registration_date, status,
             token_id, blockchain_tx_hash, ipfs_hash,
             notes, registration_comment, record_hash,
             current_owner_id, created_by,
             created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,
             $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
             NOW(),NOW()
           )`,
          [
            propId, plotNum, deedNum, address,
            gpsLat.toFixed(7), gpsLng.toFixed(7),
            size, unit, zoning,
            regDate, 'ACTIVE',
            tokenId, txHash, ipfs,
            null, null, recHash,
            user.id, user.id,
          ]
        );

        await client.query(
          `INSERT INTO ownership_records (
             id, property_id, owner_id, transfer_id,
             acquired_at, released_at, acquisition_type,
             blockchain_tx_hash, created_at, updated_at
           ) VALUES ($1,$2,$3,NULL,$4,NULL,'INITIAL_REGISTRATION',$5,NOW(),NOW())`,
          [owId, propId, user.id, acqAt, txHash]
        );

        // Activity log
        await client.query(
          `INSERT INTO activity_logs (
             id, user_id, action, entity_type, entity_id,
             metadata, performed_at
           ) VALUES ($1,$2,'PROPERTY_REGISTERED','Property',$3,NULL,$4)`,
          [uuid(), user.id, propId, acqAt]
        );

        console.log(`    PROP  ${plotNum} → ${user.fullName} [${zoning}] ${address.slice(0,40)}`);
        tokenIdCounter++;
      }
    }

    // -----------------------------------------------------------------------
    // 5. Summary
    // -----------------------------------------------------------------------
    const userCount = await client.query(`SELECT COUNT(*) FROM users`);
    const propCount = await client.query(`SELECT COUNT(*) FROM properties WHERE status='ACTIVE'`);
    console.log('\n=== Seed Complete ===');
    console.log(`Total users in DB:        ${userCount.rows[0].count}`);
    console.log(`Total ACTIVE properties:  ${propCount.rows[0].count}`);
    console.log('\nTest credentials for all seeded users:');
    console.log('  Password: Test@1234');
    console.log('\nSample logins:');
    insertedUsers.slice(0, 5).forEach((u) => {
      console.log(`  ${u.email}  /  Test@1234  (${u.props} propert${u.props > 1 ? 'ies' : 'y'})`);
    });

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
