#!/usr/bin/env node
/**
 * set_admin_claims.cjs
 * Set custom role claims on Firebase Auth users for testing restrictive Firestore rules.
 * 
 * Usage:
 *   node set_admin_claims.cjs --project flockos-notify --email user@example.com --role admin
 *   node set_admin_claims.cjs --project flockos-notify --list   # list all users
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SECRETS_DIR = path.join(__dirname, '../../../Architechtural Docs/New Covenant/Secrets/Flock');

const SERVICE_ACCOUNTS = {
  'flockos-notify': 'flockos-notify-firebase-adminsdk-fbsvc-69aa3dcf79.json',
  'flockos-trinity': 'flockos-trinity-firebase-adminsdk-fbsvc-c8e8ee9c05.json',
  'flockos-theforest': 'flockos-theforest-firebase-adminsdk-fbsvc-1317741aea.json',
  'flockos-comms': 'flockos-comms-firebase-adminsdk-fbsvc-2eec2d6f2d.json',
  'flockos-truth': 'flockos-truth-firebase-adminsdk-fbsvc-21aa89bf70.json',
};

// Parse args
const args = process.argv.slice(2);
let project = 'flockos-notify';
let email = null;
let uid = null;
let role = 'admin';
let listUsers = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) {
    project = args[++i];
  } else if (args[i] === '--email' && args[i + 1]) {
    email = args[++i];
  } else if (args[i] === '--uid' && args[i + 1]) {
    uid = args[++i];
  } else if (args[i] === '--role' && args[i + 1]) {
    role = args[++i];
  } else if (args[i] === '--list') {
    listUsers = true;
  }
}

if (!SERVICE_ACCOUNTS[project]) {
  console.error(`✗ Unknown project: ${project}`);
  console.error(`  Valid: ${Object.keys(SERVICE_ACCOUNTS).join(', ')}`);
  process.exit(1);
}

const saPath = path.join(SECRETS_DIR, SERVICE_ACCOUNTS[project]);
if (!fs.existsSync(saPath)) {
  console.error(`✗ Service account not found: ${saPath}`);
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
});

async function listAllUsers() {
  console.log(`\n═══ Listing users in ${project} ═══\n`);
  
  const listUsersResult = await admin.auth().listUsers();
  
  if (listUsersResult.users.length === 0) {
    console.log('No users found.');
    return;
  }
  
  listUsersResult.users.forEach((user) => {
    const claims = user.customClaims || {};
    console.log(`Email: ${user.email}`);
    console.log(`  UID: ${user.uid}`);
    console.log(`  Created: ${user.metadata.creationTime}`);
    console.log(`  Custom Claims: ${JSON.stringify(claims)}`);
    console.log('');
  });
}

async function setCustomClaims(email, role) {
  console.log(`\n═══ Setting custom claims for ${email} ═══\n`);
  
  try {
    const user = await admin.auth().getUserByEmail(email);
    
    await admin.auth().setCustomUserClaims(user.uid, {
      role: role,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`✓ Custom claims set successfully:`);
    console.log(`  Email: ${email}`);
    console.log(`  UID: ${user.uid}`);
    console.log(`  Role: ${role}`);
    console.log('');
    console.log('⚠️  User must sign out and sign back in for claims to take effect.');
    
  } catch (error) {
    console.error(`✗ Error setting custom claims: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  if (listUsers) {
    await listAllUsers();
  } else if (email) {
    await setCustomClaims(email, role);
  } else {
    console.error('✗ Must specify --email <address> or --list');
    console.error('');
    console.error('Usage:');
    console.error('  node set_admin_claims.cjs --project flockos-notify --list');
    console.error('  node set_admin_claims.cjs --project flockos-notify --email user@example.com --role admin');
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch((error) => {
  console.error(`✗ Fatal error: ${error.message}`);
  process.exit(1);
});
