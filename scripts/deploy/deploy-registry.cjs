// ---------------------------------------------------------------------------
// deploy-registry.cjs — compile + deploy contracts/PrescriptionRegistry.sol
// to Polygon Amoy with the configured deployer key. Honest gates:
//   - refuses to run without the contract source, key, and RPC
//   - checks the deployer balance FIRST and explains the faucet step
//   - prints the new address + the exact .env line to set
// Usage: node scripts/deploy/deploy-registry.cjs
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { Web3 } = require('web3');

const root = path.join(__dirname, '..', '..');
const NL = String.fromCharCode(10), EQ = String.fromCharCode(61);
const cfg = fs.readFileSync(path.join(root, '.env'), 'utf8');
function env(k) {
  const line = cfg.split(NL).find((l) => l.trim().startsWith(k + EQ));
  return line ? line.slice(k.length + 1).trim() : '';
}

const RPC = env('BLOCKCHAIN_RPC_URL') || 'https://polygon-amoy.drpc.org';
const KEY = env('BLOCKCHAIN_PRIVATE_KEY').replace(/^0x/i, '');
if (!KEY) { console.error('BLOCKCHAIN_PRIVATE_KEY not set in .env'); process.exit(1); }

const source = fs.readFileSync(path.join(root, 'contracts', 'PrescriptionRegistry.sol'), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'PrescriptionRegistry.sol': { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const contract = out.contracts && out.contracts['PrescriptionRegistry.sol'] && out.contracts['PrescriptionRegistry.sol']['PrescriptionRegistry'];
if (!contract) {
  console.error('Compile errors:', JSON.stringify(out.errors || out, null, 1).slice(0, 1500));
  process.exit(1);
}
const abi = contract.abi;
const bytecode = '0x' + contract.evm.bytecode.object;
console.log(`compiled PrescriptionRegistry — bytecode ${(bytecode.length - 2) / 2} bytes`);

const w3 = new Web3(RPC);
const acct = w3.eth.accounts.privateKeyToAccount('0x' + KEY);

(async () => {
  const chainId = Number(await w3.eth.getChainId());
  const balance = await w3.eth.getBalance(acct.address);
  console.log(`network chainId: ${chainId} | deployer: ${acct.address} | balance: ${w3.utils.fromWei(balance, 'ether')} POL`);
  if (Number(balance) === 0) {
    console.error('\nDeployer is UNFUNDED. Get test POL from a Polygon Amoy faucet, then re-run:');
    console.error('  https://faucet.polygon.technology/  (choose Amoy, paste the deployer address above)');
    console.error('  or https://faucets.chainstack.com/amoy-faucet');
    process.exit(2);
  }
  const gasPrice = await w3.eth.getGasPrice();
  const deployTx = { data: bytecode, gas: '0x' + Math.floor(600000).toString(16), gasPrice, type: '0x0', chainId, nonce: Number(await w3.eth.getTransactionCount(acct.address, 'pending')) };
  const est = await w3.eth.estimateGas({ from: acct.address, data: bytecode }).catch(() => null);
  if (est) deployTx.gas = '0x' + Math.floor(Number(est) * 1.25).toString(16);
  console.log(`deploy gas estimate: ${Number(deployTx.gas)} @ ${gasPrice} wei`);
  const signed = await acct.signTransaction(deployTx);
  console.log('sending deployment transaction…');
  const receipt = await w3.eth.sendSignedTransaction(signed.rawTransaction);
  console.log('\n=== DEPLOYED ===');
  console.log('contract address:', receipt.contractAddress);
  console.log('tx hash:', receipt.transactionHash, '| block:', Number(receipt.blockNumber));
  console.log('\nSet in .env then restart the backend:');
  console.log(`BLOCKCHAIN_CONTRACT_ADDRESS=${receipt.contractAddress}`);
  fs.writeFileSync(path.join(root, 'contracts', 'deployed-abi.json'), JSON.stringify(abi, null, 2));
  console.log('(ABI saved to contracts/deployed-abi.json)');
})().catch((e) => { console.error('deploy failed:', e.message || e); process.exit(1); });
