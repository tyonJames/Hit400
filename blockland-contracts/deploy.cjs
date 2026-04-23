// deploy.cjs — Deploy blockland.clar to Stacks Testnet
const { readFileSync } = require('fs');
const { makeContractDeploy, broadcastTransaction, AnchorMode, PostConditionMode } = require('@stacks/transactions');
const { StacksTestnet } = require('@stacks/network');

const PRIVATE_KEY = '2a20496b844ceb300e7ecc7e6848bb2186f7ffb797e9848ebe64814161fa9a8501';
const CONTRACT_NAME = 'blockland';
const STACKS_API = 'https://api.testnet.hiro.so';
const ADDRESS = 'STT771M41X1KVVKVFHZSWXVQDDST159RDHMX2RTG';

async function deploy() {
  const codeBody = readFileSync('./contracts/blockland-ascii.clar', 'utf8');
  console.log(`Deploying contract "${CONTRACT_NAME}" to Stacks Testnet...`);
  console.log(`Contract size: ${codeBody.length} bytes`);

  const nonceRes = await fetch(`${STACKS_API}/v2/accounts/${ADDRESS}?proof=0`);
  const nonceData = await nonceRes.json();
  const nonce = nonceData.nonce ?? 0;
  const balance = parseInt(nonceData.balance, 16);
  console.log(`Balance: ${balance} microSTX (${balance / 1_000_000} STX)`);
  console.log(`Nonce: ${nonce}`);

  if (balance < 100000) {
    console.error('Insufficient balance. Wait a moment for the faucet tx to confirm, then retry.');
    process.exit(1);
  }

  const network = new StacksTestnet();

  const tx = await makeContractDeploy({
    contractName: CONTRACT_NAME,
    codeBody,
    senderKey: PRIVATE_KEY,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    nonce,
    fee: 300000, // 0.3 STX
  });

  console.log('\nBroadcasting transaction...');
  const result = await broadcastTransaction(tx, network);
  console.log('\nBroadcast result:', JSON.stringify(result, null, 2));

  if (result.txid && !result.error) {
    console.log('\n✓ SUCCESS!');
    console.log(`  TX ID:            ${result.txid}`);
    console.log(`  Contract address: ${ADDRESS}`);
    console.log(`  Contract name:    ${CONTRACT_NAME}`);
    console.log(`\nUpdate these values in your .env files:`);
    console.log(`  STACKS_CONTRACT_ADDRESS=${ADDRESS}`);
    console.log(`  STACKS_DEPLOYER_PRIVATE_KEY=${PRIVATE_KEY}`);
    console.log(`  NEXT_PUBLIC_CONTRACT_ADDRESS=${ADDRESS}`);
    console.log(`\nTrack on explorer:`);
    console.log(`  https://explorer.hiro.so/txid/${result.txid}?chain=testnet`);
  } else {
    console.error('\n✗ FAILED:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

deploy().catch((err) => {
  console.error('Deploy error:', err);
  process.exit(1);
});
