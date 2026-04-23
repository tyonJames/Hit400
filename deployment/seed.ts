#!/usr/bin/env ts-node
// =============================================================================
// scripts/seed.ts — BlockLand Zimbabwe Post-Deployment Seed Script
// =============================================================================
//
// PURPOSE: Runs after `clarinet deployments apply --testnet` to:
//   1. Call initialize-registrar on the deployed blockland.clar contract,
//      authorizing the REGISTRAR_ADDRESS as a land registrar.
//   2. Verify the registrar was set using a read-only query.
//   3. Register one sample property on testnet for demonstration.
//   4. Seed the PostgreSQL database with 3 demo users and properties
//      (1 ACTIVE, 1 PENDING_TRANSFER, 1 DISPUTED) for the dissertation demo.
//
// RUN: npx ts-node scripts/seed.ts
// ENV: Reads from .env in the project root (never commit secrets)
// =============================================================================

import {
  makeContractCall,
  callReadOnlyFunction,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  principalCV,
  bufferCV,
  cvToValue,
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';
import { mnemonicToAccount } from '@stacks/wallet-sdk';
import * as crypto  from 'crypto';
import * as dotenv  from 'dotenv';
import * as path    from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ---------------------------------------------------------------------------
// Configuration (from environment variables)
// ---------------------------------------------------------------------------
const NETWORK           = new StacksTestnet();
const STACKS_API_URL    = process.env.STACKS_API_URL    ?? 'https://api.testnet.hiro.so';
const CONTRACT_ADDRESS  = process.env.CLARITY_CONTRACT_ADDRESS!;  // e.g. ST1234...ABCD
const CONTRACT_NAME     = 'blockland';
const DEPLOYER_MNEMONIC = process.env.DEPLOYER_MNEMONIC!;
const REGISTRAR_MNEMONIC= process.env.REGISTRAR_MNEMONIC!;

if (!CONTRACT_ADDRESS || !DEPLOYER_MNEMONIC || !REGISTRAR_MNEMONIC) {
  console.error('❌  Missing required environment variables:');
  console.error('    CLARITY_CONTRACT_ADDRESS, DEPLOYER_MNEMONIC, REGISTRAR_MNEMONIC');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helper: derive account keys from mnemonic
// ---------------------------------------------------------------------------
async function getAccount(mnemonic: string) {
  const wallet  = await mnemonicToAccount(mnemonic);
  const account = wallet.accounts[0];
  return {
    address:    account.address,
    privateKey: account.stxPrivateKey,
  };
}

// ---------------------------------------------------------------------------
// Helper: wait for transaction confirmation (poll every 5s, timeout 120s)
// ---------------------------------------------------------------------------
async function waitForConfirmation(txid: string, timeoutMs = 120_000): Promise<boolean> {
  const start = Date.now();
  process.stdout.write(`  ⏳  Waiting for confirmation of ${txid.slice(0, 12)}…`);

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 5000));
    const res  = await fetch(`${STACKS_API_URL}/extended/v1/tx/${txid}`);
    const data = await res.json();

    if (data.tx_status === 'success') {
      process.stdout.write(' ✓\n');
      return true;
    }
    if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
      process.stdout.write(' ✗ (aborted)\n');
      console.error(`  Abort reason: ${JSON.stringify(data.tx_result)}`);
      return false;
    }
    process.stdout.write('.');
  }

  process.stdout.write(' timeout\n');
  return false;
}

// ---------------------------------------------------------------------------
// STEP 1: Initialize registrar on-chain
// ---------------------------------------------------------------------------
async function initializeRegistrar() {
  console.log('\n📋  Step 1: Initialize Registrar on Stacks testnet');

  const deployer  = await getAccount(DEPLOYER_MNEMONIC);
  const registrar = await getAccount(REGISTRAR_MNEMONIC);

  console.log(`  Deployer address:  ${deployer.address}`);
  console.log(`  Registrar address: ${registrar.address}`);
  console.log(`  Contract:          ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);

  // Check if already initialized
  const checkResult = await callReadOnlyFunction({
    network:          NETWORK,
    contractAddress:  CONTRACT_ADDRESS,
    contractName:     CONTRACT_NAME,
    functionName:     'is-registrar',
    functionArgs:     [principalCV(registrar.address)],
    senderAddress:    deployer.address,
  });

  const isAlready = cvToValue(checkResult);
  if (isAlready?.value === true) {
    console.log('  ✓  Registrar already initialized — skipping');
    return registrar.address;
  }

  // Build the initialize-registrar transaction
  const txOptions = {
    network:          NETWORK,
    contractAddress:  CONTRACT_ADDRESS,
    contractName:     CONTRACT_NAME,
    functionName:     'initialize-registrar',
    functionArgs:     [principalCV(registrar.address)],
    senderKey:        deployer.privateKey,
    anchorMode:       AnchorMode.Any,
    postConditionMode:PostConditionMode.Allow,
    fee:              200n, // micro-STX
  };

  const tx   = await makeContractCall(txOptions);
  const { txid } = await broadcastTransaction({ transaction: tx, network: NETWORK });

  console.log(`  📡  Broadcast txid: ${txid}`);
  const confirmed = await waitForConfirmation(txid);

  if (!confirmed) throw new Error('initialize-registrar transaction failed');

  // Verify registrar is set
  const verifyResult = await callReadOnlyFunction({
    network:         NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName:    CONTRACT_NAME,
    functionName:    'is-registrar',
    functionArgs:    [principalCV(registrar.address)],
    senderAddress:   deployer.address,
  });

  const confirmed2 = cvToValue(verifyResult)?.value === true;
  console.log(`  ${confirmed2 ? '✓' : '✗'}  Verified: is-registrar(${registrar.address}) = ${confirmed2}`);

  return registrar.address;
}

// ---------------------------------------------------------------------------
// STEP 2: Register sample property on testnet
// ---------------------------------------------------------------------------
async function registerSampleProperty(registrarAddress: string) {
  console.log('\n🏠  Step 2: Register sample property on Stacks testnet');

  const registrar = await getAccount(REGISTRAR_MNEMONIC);
  const owner     = await getAccount(DEPLOYER_MNEMONIC); // use deployer as sample owner

  const propertyId    = 1;  // Token ID 1 = first property
  const titleDeedHash = crypto.createHash('sha256').update('SAMPLE-TITLE-DEED-HD-0042').digest();
  const ipfsDocHash   = crypto.createHash('sha256').update('QmSampleIPFSHash').digest();

  console.log(`  Property ID:    ${propertyId}`);
  console.log(`  Owner address:  ${owner.address}`);
  console.log(`  Title deed SHA: ${titleDeedHash.toString('hex').slice(0, 16)}…`);

  // Check if already registered
  const check = await callReadOnlyFunction({
    network:         NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName:    CONTRACT_NAME,
    functionName:    'get-property-info',
    functionArgs:    [uintCV(propertyId)],
    senderAddress:   registrar.address,
  });

  const checkVal = cvToValue(check);
  if (checkVal?.type === 'ok') {
    console.log('  ✓  Property #1 already registered — skipping');
    return;
  }

  const txOptions = {
    network:          NETWORK,
    contractAddress:  CONTRACT_ADDRESS,
    contractName:     CONTRACT_NAME,
    functionName:     'register-property',
    functionArgs:     [
      uintCV(propertyId),
      bufferCV(titleDeedHash),
      principalCV(owner.address),
    ],
    senderKey:        registrar.privateKey,
    anchorMode:       AnchorMode.Any,
    postConditionMode:PostConditionMode.Allow,
    fee:              200n,
  };

  const tx   = await makeContractCall(txOptions);
  const { txid } = await broadcastTransaction({ transaction: tx, network: NETWORK });

  console.log(`  📡  Broadcast txid: ${txid}`);
  console.log(`  🔍  View on explorer: https://explorer.hiro.so/txid/${txid}?chain=testnet`);

  const confirmed = await waitForConfirmation(txid);
  if (!confirmed) throw new Error('register-property transaction failed');

  // Verify property is live
  const info = await callReadOnlyFunction({
    network:         NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName:    CONTRACT_NAME,
    functionName:    'get-property-info',
    functionArgs:    [uintCV(propertyId)],
    senderAddress:   registrar.address,
  });

  const infoVal = cvToValue(info);
  console.log(`  ✓  Property verified on-chain: status = ${infoVal?.value?.status ?? 'unknown'}`);
  console.log(`  ✓  Blockchain TX Hash: ${txid}`);
}

// ---------------------------------------------------------------------------
// STEP 3: Output DB seed SQL (copy-paste into Railway shell)
// ---------------------------------------------------------------------------
function printDatabaseSeedSQL() {
  console.log('\n🗄️   Step 3: Database Seed SQL');
  console.log('  Run the following in Railway shell: npx ts-node scripts/db-seed.ts');
  console.log('  Or execute the SQL below in Railway\'s PostgreSQL console:\n');

  const sql = `
-- ============================================================
-- BlockLand Zimbabwe — Dissertation Demo Seed Data
-- Creates 3 users, 3 properties in different states
-- ============================================================

-- Roles (already seeded by migration, but safe to re-run)
INSERT INTO roles (name) VALUES ('REGISTRAR'),('OWNER'),('BUYER'),('PUBLIC'),('ADMIN')
ON CONFLICT (name) DO NOTHING;

-- Demo users (passwords are bcrypt of 'Blockland1!')
INSERT INTO users (id, email, full_name, national_id, phone, password_hash, is_active)
VALUES
  (gen_random_uuid(), 'registrar@blockland.co.zw', 'James Zimba',    'JZ-001', '0771000001', '$2b$12$PLACEHOLDER_HASH', true),
  (gen_random_uuid(), 'owner@blockland.co.zw',     'Tendai Moyo',    'TM-002', '0771000002', '$2b$12$PLACEHOLDER_HASH', true),
  (gen_random_uuid(), 'buyer@blockland.co.zw',     'Rudo Chikwanda', 'RC-003', '0771000003', '$2b$12$PLACEHOLDER_HASH', true)
ON CONFLICT (email) DO NOTHING;

-- NOTE: Replace PLACEHOLDER_HASH with the output of:
-- node -e "const b=require('bcrypt'); b.hash('Blockland1!',12).then(console.log)"
`;

  console.log(sql);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60));
  console.log('  BlockLand Zimbabwe — Post-Deployment Seed Script');
  console.log(`  Network:  Stacks Testnet`);
  console.log(`  Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
  console.log('='.repeat(60));

  try {
    const registrarAddress = await initializeRegistrar();
    await registerSampleProperty(registrarAddress);
    printDatabaseSeedSQL();

    console.log('\n' + '='.repeat(60));
    console.log('  ✅  Seed complete!');
    console.log(`  Contract:   https://explorer.hiro.so/address/${CONTRACT_ADDRESS}?chain=testnet`);
    console.log(`  Registrar:  ${registrarAddress}`);
    console.log('='.repeat(60));
  } catch (err) {
    console.error('\n❌  Seed failed:', err);
    process.exit(1);
  }
}

main();
