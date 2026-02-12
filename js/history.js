/**
 * Transaction History Fetcher
 * Fetches LogOperate events from Fluid vault contracts via Etherscan V2 API
 * and decodes them into human-readable transaction records.
 */

import { LOGOPERATE_TOPIC0 } from './contracts.js';

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';
const MAX_RESULTS_PER_PAGE = 1000;
const REQUEST_DELAY_MS = 220; // ~5 req/sec free tier

export class TransactionHistoryFetcher {
  constructor(apiKey, chainId = 1) {
    this.apiKey = apiKey;
    this.chainId = chainId;
  }

  /**
   * Fetch transaction history for a set of positions.
   * Groups by vault address, fetches events, filters by NFT IDs, and decodes.
   * @param {Array} positions - Formatted position objects from FluidFetcher
   * @param {Object} prices - Current token prices keyed by symbol
   * @returns {Array} Decoded transaction objects sorted by date ascending
   */
  async fetchForPositions(positions, prices) {
    // Group positions by vault address
    const vaultMap = new Map(); // vaultAddress -> { nftIds, supplyDecimals, borrowDecimals, supplySymbol, borrowSymbol, supplyName, borrowName }
    for (const pos of positions) {
      const vaultAddr = pos.vaultData.vaultAddress;
      if (!vaultMap.has(vaultAddr)) {
        vaultMap.set(vaultAddr, {
          nftIds: new Set(),
          supplyToken: pos.vaultData.supplyToken,
          borrowToken: pos.vaultData.borrowToken,
          supplySymbol: pos.formatted.collateral.symbol,
          borrowSymbol: pos.formatted.debt.symbol,
          supplyName: pos.formatted.collateral.name,
          borrowName: pos.formatted.debt.name,
          supplyDecimals: this._getDecimals(pos, 'supply'),
          borrowDecimals: this._getDecimals(pos, 'borrow'),
        });
      }
      vaultMap.get(vaultAddr).nftIds.add(BigInt(pos.nftId));
    }

    const allTransactions = [];

    for (const [vaultAddress, info] of vaultMap) {
      const logs = await this.fetchVaultEvents(vaultAddress);

      for (const log of logs) {
        const decoded = this.decodeEvent(log, info, prices);
        if (!decoded) continue;

        // Filter: only include events for our NFT IDs
        if (!info.nftIds.has(decoded._nftId)) continue;

        // A single event can produce 1 or 2 transaction rows
        allTransactions.push(...decoded.rows);
      }
    }

    // Sort chronologically
    allTransactions.sort((a, b) => b.timestamp - a.timestamp);

    return allTransactions;
  }

  /**
   * Fetch all LogOperate events for a vault address from Etherscan V2.
   * Handles pagination (1000 results per page).
   */
  async fetchVaultEvents(vaultAddress) {
    const allLogs = [];
    let page = 1;

    while (true) {
      const params = new URLSearchParams({
        chainid: this.chainId.toString(),
        module: 'logs',
        action: 'getLogs',
        address: vaultAddress,
        topic0: LOGOPERATE_TOPIC0,
        fromBlock: '0',
        toBlock: 'latest',
        page: page.toString(),
        offset: MAX_RESULTS_PER_PAGE.toString(),
        apikey: this.apiKey,
      });

      const url = `${ETHERSCAN_V2_BASE}?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Etherscan API error: ${response.status}`);
      }

      const json = await response.json();

      if (json.status === '0') {
        // "No records found" is not an error
        if (json.message === 'No records found') break;
        // Rate limit or other error
        if (json.result && typeof json.result === 'string' && json.result.includes('rate limit')) {
          // Wait and retry
          await this._delay(1000);
          continue;
        }
        break;
      }

      const logs = json.result || [];
      allLogs.push(...logs);

      // If fewer than max, we've fetched everything
      if (logs.length < MAX_RESULTS_PER_PAGE) break;

      page++;
      await this._delay(REQUEST_DELAY_MS);
    }

    return allLogs;
  }

  /**
   * Decode a single LogOperate event log.
   * Event: LogOperate(address user_, uint256 nftId_, int256 colAmt_, int256 debtAmt_, address to_)
   * All params are non-indexed, packed in the data field as 5 x 32-byte words.
   *
   * Returns null if decoding fails, otherwise { _nftId, rows: [...] }
   */
  decodeEvent(log, vaultInfo, prices) {
    try {
      const data = log.data;
      if (!data || data.length < 2 + 64 * 5) return null;

      // Strip 0x prefix, parse 5 x 32-byte words
      const hex = data.slice(2);
      const word = (i) => hex.slice(i * 64, (i + 1) * 64);

      // word 0: address user (last 20 bytes of 32-byte word)
      // word 1: uint256 nftId
      const nftId = BigInt('0x' + word(1));
      // word 2: int256 colAmt
      const colAmt = this._decodeInt256(word(2));
      // word 3: int256 debtAmt
      const debtAmt = this._decodeInt256(word(3));
      // word 4: address to

      const timestamp = parseInt(log.timeStamp, 16);
      const date = new Date(timestamp * 1000);
      const txHash = log.transactionHash;

      const rows = [];

      // Determine transaction type(s) and produce rows
      if (colAmt !== 0n) {
        const isDeposit = colAmt > 0n;
        const absAmt = colAmt > 0n ? colAmt : -colAmt;
        const amount = this._formatUnits(absAmt, vaultInfo.supplyDecimals);
        const price = prices[vaultInfo.supplySymbol] || 0;
        rows.push({
          date,
          timestamp,
          description: isDeposit ? 'Collateral Deposit' : 'Collateral Withdrawal',
          asset: vaultInfo.supplySymbol,
          amount: isDeposit ? amount : -amount,
          symbol: vaultInfo.supplySymbol,
          usdValue: Math.abs(amount) * price,
          txHash,
          isRepayOrWithdraw: !isDeposit,
        });
      }

      if (debtAmt !== 0n) {
        const isBorrow = debtAmt > 0n;
        const absAmt = debtAmt > 0n ? debtAmt : -debtAmt;
        const amount = this._formatUnits(absAmt, vaultInfo.borrowDecimals);
        const price = prices[vaultInfo.borrowSymbol] || 0;
        rows.push({
          date,
          timestamp,
          description: isBorrow ? 'Margin Loan' : 'Loan Repayment',
          asset: vaultInfo.borrowSymbol,
          amount: isBorrow ? amount : -amount,
          symbol: vaultInfo.borrowSymbol,
          usdValue: Math.abs(amount) * price,
          txHash,
          isRepayOrWithdraw: !isBorrow,
        });
      }

      // If both col and debt are 0, skip (no-op event)
      if (rows.length === 0) return null;

      return { _nftId: nftId, rows };
    } catch (e) {
      console.warn('Failed to decode LogOperate event:', e, log);
      return null;
    }
  }

  /**
   * Decode a 64-char hex string as int256 (two's complement).
   */
  _decodeInt256(hexWord) {
    const val = BigInt('0x' + hexWord);
    const MAX_INT256 = (1n << 255n) - 1n;
    if (val > MAX_INT256) {
      // Negative: two's complement
      return val - (1n << 256n);
    }
    return val;
  }

  /**
   * Convert BigInt raw amount to float given decimals.
   */
  _formatUnits(value, decimals) {
    const divisor = 10n ** BigInt(decimals);
    const intPart = value / divisor;
    const fracPart = value % divisor;
    const fracStr = fracPart.toString().padStart(decimals, '0');
    return parseFloat(`${intPart}.${fracStr}`);
  }

  /**
   * Extract decimals for supply or borrow token from a position object.
   * We infer from the formatted amounts and raw amounts.
   */
  _getDecimals(pos, type) {
    // Use the TOKENS cache via the raw supply/borrow strings and formatted amounts
    // The simplest approach: re-derive from ethers if available, or use known tokens
    if (type === 'supply') {
      return this._inferDecimals(pos.supply, pos.formatted.collateral.amount);
    }
    return this._inferDecimals(pos.borrow, pos.formatted.debt.amount);
  }

  _inferDecimals(rawStr, formattedAmount) {
    if (!rawStr || rawStr === '0' || !formattedAmount || formattedAmount === 0) {
      return 18; // default
    }
    // decimals = log10(raw / formatted)
    const raw = parseFloat(rawStr);
    const ratio = raw / formattedAmount;
    const decimals = Math.round(Math.log10(ratio));
    return Math.max(0, Math.min(decimals, 18));
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
