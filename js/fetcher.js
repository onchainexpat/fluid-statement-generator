/**
 * Fluid Position Data Fetcher
 * Fetches position data from Fluid smart contracts using ethers.js
 */

import { CONTRACTS, ABIS, TOKENS, COINGECKO_IDS, DEFAULT_RPCS } from './contracts.js';

export class FluidFetcher {
  constructor(network = 'mainnet', customRpcUrl = null) {
    this.network = network;
    this.rpcUrl = customRpcUrl || DEFAULT_RPCS[network];
    this.contracts = CONTRACTS[network];
    this.provider = null;
    this.vaultResolver = null;
  }

  /**
   * Initialize the provider and contracts
   */
  async init() {
    // ethers is loaded globally via CDN
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

    // Test connection
    try {
      await this.provider.getBlockNumber();
    } catch (error) {
      throw new Error(`Failed to connect to RPC: ${this.rpcUrl}. Please check your RPC URL.`);
    }

    this.vaultResolver = new ethers.Contract(
      this.contracts.VAULT_RESOLVER,
      ABIS.VAULT_RESOLVER,
      this.provider
    );

    return this;
  }

  /**
   * Get detailed position data for a specific NFT ID
   */
  async getPositionByNftId(nftId) {
    try {
      const result = await this.vaultResolver.positionByNftId(nftId);
      const [position, vaultData] = result;

      // Check if position exists
      if (position.nftId.toString() === '0') {
        return null;
      }

      return this.buildPositionObject(position, vaultData);
    } catch (error) {
      console.error(`Error fetching position ${nftId}:`, error);
      return null;
    }
  }

  /**
   * Build a normalized position object from raw contract data
   */
  buildPositionObject(position, vaultData) {
    return {
      nftId: position.nftId.toString(),
      owner: position.owner,
      isLiquidated: position.isLiquidated,
      isSupplyPosition: position.isSupplyPosition,
      supply: position.supply.toString(),
      borrow: position.borrow.toString(),
      tick: position.tick.toString(),
      tickId: position.tickId.toString(),
      isSmartCol: vaultData.isSmartCol,
      isSmartDebt: vaultData.isSmartDebt,
      vaultData: this.parseVaultData(vaultData),
    };
  }

  /**
   * Parse vault data into a more usable format
   */
  parseVaultData(vaultData) {
    const constants = vaultData.constantVariables;
    const configs = vaultData.configs;
    const rates = vaultData.exchangePricesAndRates;

    return {
      vaultAddress: vaultData.vault,
      vaultId: constants.vaultId.toString(),

      // Token addresses from nested Tokens struct
      supplyToken: constants.supplyToken.token0,
      borrowToken: constants.borrowToken.token0,

      // Config values are basis points (÷ 100 to get display percentage)
      collateralFactor: Number(configs.collateralFactor) / 100,
      liquidationThreshold: Number(configs.liquidationThreshold) / 100,
      liquidationMaxLimit: Number(configs.liquidationMaxLimit) / 100,
      liquidationPenalty: Number(configs.liquidationPenalty) / 100,
      borrowFee: Number(configs.borrowFee) / 100,

      // Oracle prices (BigInt as string for precision)
      oraclePriceOperate: configs.oraclePriceOperate.toString(),
      oraclePriceLiquidate: configs.oraclePriceLiquidate.toString(),

      // Vault rates (BigInt as string, converted in formatPosition)
      supplyRateRaw: rates.supplyRateVault.toString(),
      borrowRateRaw: rates.borrowRateVault.toString(),
    };
  }

  /**
   * Get token metadata (cached or from chain)
   */
  async getTokenMetadata(tokenAddress) {
    try {
      const normalizedAddress = ethers.getAddress(tokenAddress);

      // Check cache first
      if (TOKENS[normalizedAddress]) {
        return TOKENS[normalizedAddress];
      }

      // Fetch from chain
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ABIS.ERC20,
        this.provider
      );

      const [symbol, decimals, name] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.name(),
      ]);

      return { symbol, decimals: Number(decimals), name };
    } catch (error) {
      console.error(`Error fetching token metadata for ${tokenAddress}:`, error);
      return { symbol: 'UNKNOWN', decimals: 18, name: 'Unknown Token' };
    }
  }

  /**
   * Convert vault rate from raw BigInt to APY percentage
   */
  rateToApy(rawRateStr) {
    const raw = BigInt(rawRateStr);
    const abs = raw < 0n ? -raw : raw;
    const sign = raw < 0n ? -1 : 1;
    // Rates appear to be in 1e2 scale (basis-point-like)
    // Try auto-detect: if very large, assume 1e27 scale
    if (abs > 10n ** 18n) {
      // 1e27 (ray) scale: divide by 1e23 to get % * 100, then / 100
      const scaled = Number(abs / (10n ** 23n));
      return sign * scaled / 100;
    }
    // Smaller values: assume 1e2 (basis point) scale
    return sign * Number(abs) / 100;
  }

  /**
   * Format position data with human-readable values
   */
  async formatPosition(position) {
    const supplyToken = await this.getTokenMetadata(position.vaultData.supplyToken);
    const borrowToken = await this.getTokenMetadata(position.vaultData.borrowToken);

    // Convert raw amounts to human-readable using ethers.formatUnits
    const supplyAmount = parseFloat(ethers.formatUnits(position.supply, supplyToken.decimals));
    const borrowAmount = parseFloat(ethers.formatUnits(position.borrow, borrowToken.decimals));

    // Oracle price in 1e27: colValueInDebt_raw = supply_raw * oraclePrice / 1e27
    const supplyRaw = BigInt(position.supply);
    const borrowRaw = BigInt(position.borrow);
    const oraclePriceBN = BigInt(position.vaultData.oraclePriceOperate);
    const colValueInDebtRaw = supplyRaw * oraclePriceBN / (10n ** 27n);
    const colValueInDebt = parseFloat(ethers.formatUnits(colValueInDebtRaw, borrowToken.decimals));

    // LTV = (borrow / colValueInDebt) * 100
    const ltv = borrowAmount > 0 && colValueInDebt > 0
      ? (borrowAmount / colValueInDebt) * 100
      : 0;

    // Health factor = liquidationThreshold (%) / LTV (%)
    const healthFactor = ltv > 0
      ? (position.vaultData.liquidationThreshold / ltv)
      : Infinity;

    // Oracle price in human terms (supply -> borrow conversion rate)
    const oraclePriceHuman = supplyAmount > 0 && colValueInDebt > 0
      ? colValueInDebt / supplyAmount
      : 0;

    // Convert rates to APY
    const borrowRateApy = this.rateToApy(position.vaultData.borrowRateRaw);
    const supplyRateApy = this.rateToApy(position.vaultData.supplyRateRaw);

    return {
      ...position,
      formatted: {
        collateral: {
          amount: supplyAmount,
          symbol: supplyToken.symbol,
          name: supplyToken.name,
        },
        debt: {
          amount: borrowAmount,
          symbol: borrowToken.symbol,
          name: borrowToken.name,
        },
        ltv: ltv.toFixed(2),
        liquidationThreshold: position.vaultData.liquidationThreshold.toFixed(2),
        borrowRateApy: borrowRateApy.toFixed(2),
        supplyRateApy: supplyRateApy.toFixed(2),
        healthFactor: healthFactor === Infinity ? '∞' : healthFactor.toFixed(2),
        oraclePrice: oraclePriceHuman,
      }
    };
  }

  /**
   * Get all positions for an address (single RPC call via positionsByUser)
   */
  async getAllPositions(ownerAddress) {
    const normalizedAddress = ethers.getAddress(ownerAddress);

    try {
      const result = await this.vaultResolver.positionsByUser(normalizedAddress);
      const [userPositions, vaultsData] = result;

      if (userPositions.length === 0) {
        return [];
      }

      const positions = [];
      for (let i = 0; i < userPositions.length; i++) {
        const position = userPositions[i];
        const vaultData = vaultsData[i];

        // Skip liquidated positions
        if (position.isLiquidated) continue;

        // Skip positions with no supply
        if (position.supply.toString() === '0') continue;

        // Skip smart vault positions (DEX share-based, not simple token amounts)
        if (vaultData.isSmartCol || vaultData.isSmartDebt) continue;

        // Skip supply-only positions (no debt component)
        if (position.isSupplyPosition) continue;

        const posObj = this.buildPositionObject(position, vaultData);
        const formatted = await this.formatPosition(posObj);
        positions.push(formatted);
      }

      return positions;
    } catch (error) {
      console.error('Error fetching positions by user:', error);
      throw new Error('Failed to fetch positions. Is this address correct?');
    }
  }

  /**
   * Fetch current prices from CoinGecko (no API key needed)
   */
  static async fetchPrices(symbols) {
    const prices = {};

    // Default prices for stablecoins
    const stablecoins = ['USDC', 'USDT', 'DAI', 'crvUSD', 'USDe'];
    stablecoins.forEach(s => prices[s] = 1);

    // Get unique CoinGecko IDs
    const uniqueIds = new Set();
    symbols.forEach(symbol => {
      if (COINGECKO_IDS[symbol]) {
        uniqueIds.add(COINGECKO_IDS[symbol]);
      }
    });

    if (uniqueIds.size === 0) {
      return prices;
    }

    try {
      const ids = Array.from(uniqueIds).join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
      );

      if (!response.ok) {
        throw new Error('CoinGecko API error');
      }

      const data = await response.json();

      // Map back to symbols
      symbols.forEach(symbol => {
        const geckoId = COINGECKO_IDS[symbol];
        if (geckoId && data[geckoId]) {
          prices[symbol] = data[geckoId].usd;
        }
      });
    } catch (error) {
      console.warn('Could not fetch live prices, using defaults:', error);
      // Use fallback prices
      prices['ETH'] = prices['WETH'] = 2500;
      prices['wstETH'] = 2900;
      prices['weETH'] = 2700;
      prices['rETH'] = 2700;
      prices['cbETH'] = 2600;
      prices['WBTC'] = 45000;
      prices['sDAI'] = 1.05;
      prices['sUSDe'] = 1.10;
    }

    return prices;
  }
}
