// ---------------------------------------------------------------------------
// Blockchain prescription registry (server-side only).
//
// Records a SHA-256 hash of the CONFIRMED prescription data on Polygon Amoy
// through a minimal on-chain registry contract. The hash covers the
// prescription's business fields (id, patient reference, medicines,
// pharmacist decision) — never images, never free-form patient PII beyond
// the reference code. BLOCKCHAIN_PRIVATE_KEY stays backend-only.
//
// Honest failure: any RPC/contract error rejects with a safe message; the
// route surfaces 502 and nothing pretends registration succeeded.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { Web3 } = require('web3');
const {
  BLOCKCHAIN_RPC_URL, BLOCKCHAIN_CONTRACT_ADDRESS, BLOCKCHAIN_PRIVATE_KEY,
  BLOCKCHAIN_NETWORK, BLOCKCHAIN_EXPLORER_URL,
} = require('../config/env.cjs');

// Minimal registry: store(hash) keyed by prescriptionId, with lookup + owner.
const REGISTRY_ABI = [
  {
    inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name: 'records',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'prescriptionId', type: 'string' },
      { internalType: 'bytes32', name: 'hash', type: 'bytes32' },
    ],
    name: 'register',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'prescriptionId', type: 'string' }],
    name: 'getHash',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'prescriptionId', type: 'string' },
      { internalType: 'bytes32', name: 'hash', type: 'bytes32' },
    ],
    name: 'verify',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

function isConfigured() {
  return configStatus().ok;
}

/** Precise, secret-free configuration diagnostics for honest 501s and UI. */
function configStatus() {
  if (!BLOCKCHAIN_RPC_URL) {
    return { ok: false, reason: 'BLOCKCHAIN_RPC_URL is not set', fix: 'Set the Polygon Amoy RPC URL in the server .env' };
  }
  if (!BLOCKCHAIN_PRIVATE_KEY) {
    return { ok: false, reason: 'BLOCKCHAIN_PRIVATE_KEY is not set', fix: 'Add a funded Polygon Amoy testnet private key (64 hex characters) to the server .env' };
  }
  const key = BLOCKCHAIN_PRIVATE_KEY.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    return {
      ok: false,
      reason: 'BLOCKCHAIN_PRIVATE_KEY is not a valid Ethereum private key (must be exactly 64 hexadecimal characters)',
      fix: 'Generate a testnet wallet (e.g. in MetaMask on Amoy), fund it with test POL from a faucet, and paste its private key',
    };
  }
  return { ok: true, reason: null, fix: null };
}

function contractConfigured() {
  return configStatus().ok && !!BLOCKCHAIN_CONTRACT_ADDRESS;
}

function web3() {
  return new Web3(BLOCKCHAIN_RPC_URL);
}

/** Canonical SHA-256 (hex) over the confirmed prescription fields. */
function prescriptionHash(p) {
  const payload = {
    prescriptionId: p.prescriptionId,
    patientReference: p.patientReference || '',
    prescriptionDate: p.prescriptionDate || '',
    medicines: (p.medicines || []).map((m) => ({
      name: (m.correctedName || m.name || '').trim(),
      strength: (m.strength || '').trim(),
      dosage: (m.dosage || '').trim(),
      frequency: (m.frequency || '').trim(),
      duration: (m.duration || '').trim(),
      route: (m.route || '').trim(),
    })),
    status: p.status,
    pharmacistReviewer: p.pharmacistReviewer || '',
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function strip0x(hex) { return hex.startsWith('0x') ? hex.slice(2) : hex; }

async function account() {
  const w3 = web3();
  // Derive the chain id so signing uses the right EIP-155 values.
  const chainId = Number(await w3.eth.getChainId());
  const acct = w3.eth.accounts.privateKeyToAccount('0x' + strip0x(BLOCKCHAIN_PRIVATE_KEY));
  return { w3, acct, chainId };
}

/** Register (or re-confirm) the hash for a prescription id. Returns receipt data. */
async function registerHash(prescriptionId, hashHex) {
  if (!contractConfigured()) {
    const e = new Error('Blockchain registry is not configured (missing contract address).');
    e.status = 501; throw e;
  }
  const { w3, acct, chainId } = await account();
  const contract = new w3.eth.Contract(REGISTRY_ABI, BLOCKCHAIN_CONTRACT_ADDRESS);
  const data = contract.methods.register(prescriptionId, '0x' + strip0x(hashHex)).encodeABI();
  const gas = await contract.methods.register(prescriptionId, '0x' + strip0x(hashHex)).estimateGas({ from: acct.address });
  const nonce = await w3.eth.getTransactionCount(acct.address, 'pending');
  // Legacy (type-0) transaction: web3 v4 requires an explicit gasPrice when
  // no EIP-1559 fields are present — otherwise tx validation rejects the
  // payload with a misleading '"gas" is missing' error.
  const gasPrice = await w3.eth.getGasPrice();
  const tx = {
    from: acct.address,
    to: BLOCKCHAIN_CONTRACT_ADDRESS,
    data,
    type: '0x0',
    gas: '0x' + Math.floor(Number(gas) * 1.2).toString(16),
    gasPrice,
    nonce: Number(nonce),
    chainId,
  };
  const signed = await acct.signTransaction(tx);
  const receipt = await w3.eth.sendSignedTransaction(signed.rawTransaction);
  return {
    transactionHash: receipt.transactionHash,
    blockNumber: Number(receipt.blockNumber),
    network: BLOCKCHAIN_NETWORK || 'polygon-amoy',
    explorerUrl: `${(BLOCKCHAIN_EXPLORER_URL || 'https://amoy.polygonscan.com').replace(/\/$/, '')}/tx/${receipt.transactionHash}`,
    contractAddress: BLOCKCHAIN_CONTRACT_ADDRESS,
  };
}

/** True when the on-chain hash for this prescription equals the given hash. */
async function verifyHash(prescriptionId, hashHex) {
  if (!contractConfigured()) {
    const e = new Error('Blockchain registry is not configured (missing contract address).');
    e.status = 501; throw e;
  }
  const w3 = web3();
  const contract = new w3.eth.Contract(REGISTRY_ABI, BLOCKCHAIN_CONTRACT_ADDRESS);
  const onChain = await contract.methods.getHash(prescriptionId).call();
  if (!onChain || onChain === '0x' + '0'.repeat(64)) return { registered: false, matches: false };
  return {
    registered: true,
    matches: onChain.toLowerCase() === '0x' + strip0x(hashHex).toLowerCase(),
    onChainHash: onChain,
  };
}

/** On-chain hash for an id, or null when none registered. */
async function getOnChainHash(prescriptionId) {
  if (!contractConfigured()) return null;
  try {
    const w3 = web3();
    const contract = new w3.eth.Contract(REGISTRY_ABI, BLOCKCHAIN_CONTRACT_ADDRESS);
    const onChain = await contract.methods.getHash(prescriptionId).call();
    return onChain && onChain !== '0x' + '0'.repeat(64) ? onChain : null;
  } catch {
    return null;
  }
}

module.exports = {
  prescriptionHash, registerHash, verifyHash, getOnChainHash,
  isConfigured, contractConfigured, configStatus,
  REGISTRY_ABI, _internal: { strip0x },
};
