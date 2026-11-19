import { config } from '../config.js';

/**
 * Block-explorer links for on-chain transactions referenced in a memo. The
 * admin backend does no crypto itself, so it maps a memo's network key
 * (BSC / ETH) to an explorer by the chain ids in config.onchainExplorers,
 * which mirror the user backend's <CHAIN>_CHAIN_ID.
 */

// Explorer base per chain id, so links are correct on testnet and mainnet.
const EXPLORERS = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  56: 'https://bscscan.com',
  97: 'https://testnet.bscscan.com',
};

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** The explorer URL for a transaction hash on a network key, or null. */
export function explorerTxUrl(networkKey, hash) {
  if (!TX_HASH.test(hash ?? '')) return null;
  const chainId = config.onchainExplorers[networkKey];
  const base = chainId && EXPLORERS[chainId];
  return base ? `${base}/tx/${hash}` : null;
}

/** Pull [{ hash, url }] out of a crypto memo, or [] when it has none. */
export function txRefsFromMemo(memo) {
  if (!memo) return [];
  const network = Object.keys(config.onchainExplorers)
    .find((k) => memo.includes(`(${k})`) || memo.includes(`/${k} `));
  const hashes = memo.match(/0x[0-9a-fA-F]{64}/g);
  if (!network || !hashes) return [];
  return hashes
    .map((hash) => ({ hash, url: explorerTxUrl(network, hash) }))
    .filter((r) => r.url);
}
