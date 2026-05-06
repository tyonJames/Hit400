// deploy.mjs — Deploy blockland.clar to Stacks Testnet
import { readFileSync } from 'fs';
import { makeContractDeploy, broadcastTransaction, AnchorMode, PostConditionMode } from '@stacks/transactions';
import networkPkg from '@stacks/network';
const { StacksTestnet } = networkPkg;

const PRIVATE_KEY = '2a20496b844ceb300e7ecc7e6848bb2186f7ffb797e9848ebe64814161fa9a8501';
const CONTRACT_NAME = 'blockland';
const STACKS_API = 'https://api.testnet.hiro.so';

const codeBody = readFileSync('./contracts/blockland.clar', 'utf8');

console.log(`Deploying contract "${CONTRACT_NAME}" to Stacks Testnet...`);
console.log(`Contract size: ${codeBody.length} bytes`);

// Get current nonce for the deployer address
const ADDRESS = 'STPMXPD1YA6TQRXQ9F6JJ6HCBZEQ9ERFAQFSG7R3';
const nonceRes = await fetch(`${STACKS_API}/v2/accounts/${ADDRESS}?proof=0`);
const nonceData = await nonceRes.json();
console.log('Account info:', JSON.stringify(nonceData, null, 2));

const nonce = nonceData.nonce ?? 0;
console.log(`Using nonce: ${nonce}`);

const network = new StacksTestnet();

const tx = await makeContractDeploy({
  contractName: CONTRACT_NAME,
  codeBody,
  senderKey: PRIVATE_KEY,
  network,
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
  nonce,
  fee: 200000n, // 0.2 STX — generous fee for testnet
});

console.log('\nBroadcasting transaction...');
const result = await broadcastTransaction(tx, network);
console.log('\nBroadcast result:', JSON.stringify(result, null, 2));

if (result.txid) {
  const contractAddress = ADDRESS;
  console.log('\n✓ SUCCESS!');
  console.log(`  TX ID:            ${result.txid}`);
  console.log(`  Contract address: ${contractAddress}`);
  console.log(`  Contract name:    ${CONTRACT_NAME}`);
  console.log(`\nAdd to .env files:`);
  console.log(`  STACKS_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`  STACKS_DEPLOYER_PRIVATE_KEY=${PRIVATE_KEY}`);
  console.log(`  NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`\nExplorer: https://explorer.hiro.so/txid/${result.txid}?chain=testnet`);
} else {
  console.error('\n✗ FAILED:', result);
}
