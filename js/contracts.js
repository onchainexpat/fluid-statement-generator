/**
 * Fluid Protocol Contract Addresses and ABIs
 * All data fetched via public resolver contracts - no API keys needed
 */

export const CONTRACTS = {
  mainnet: {
    VAULT_FACTORY: "0x324c5Dc1fC42c7a4D43d92df1eBA58a54d13Bf2d",
    VAULT_RESOLVER: "0xA5C3E16523eeeDDcC34706b0E6bE88b4c6EA95cC",
    VAULT_POSITIONS_RESOLVER: "0xaA21a86030EAa16546A759d2d10fd3bF9D053Bc7",
    LIQUIDITY_RESOLVER: "0xca13A15de31235A37134B4717021C35A3CF25C60",
  },
  // TODO: Add Arbitrum support
  // arbitrum: {
  //   VAULT_FACTORY: "0x324c5Dc1fC42c7a4D43d92df1eBA58a54d13Bf2d",
  //   VAULT_RESOLVER: "0x77648D39be25a1422467060e11E5b979463bEA3d",
  //   VAULT_POSITIONS_RESOLVER: "0x93CAB6529aD849b2583EBAe32D13817A2F38cEb4",
  // },
  // TODO: Add Base support
  // base: {
  //   VAULT_FACTORY: "0x324c5Dc1fC42c7a4D43d92df1eBA58a54d13Bf2d",
  //   VAULT_RESOLVER: "0x94695A9d0429aD5eFec0106a467aDEaDf71762F9",
  // }
};

export const DEFAULT_RPCS = {
  mainnet: "https://ethereum-rpc.publicnode.com",
  // TODO: Add L2 RPCs
  // arbitrum: "https://arb1.arbitrum.io/rpc",
  // base: "https://mainnet.base.org",
};

// Struct type definitions for the ABI (matches on-chain Solidity structs exactly)
const USER_POSITION_TUPLE = [
  "tuple(",
  "uint256 nftId, address owner, bool isLiquidated, bool isSupplyPosition,",
  "int256 tick, uint256 tickId,",
  "uint256 beforeSupply, uint256 beforeBorrow, uint256 beforeDustBorrow,",
  "uint256 supply, uint256 borrow, uint256 dustBorrow",
  ")",
].join("");

const CONSTANT_VIEWS_TUPLE = [
  "tuple(",
  "address liquidity, address factory,",
  "address operateImplementation, address adminImplementation, address secondaryImplementation,",
  "address deployer, address supply, address borrow,",
  "tuple(address token0, address token1) supplyToken,",
  "tuple(address token0, address token1) borrowToken,",
  "uint256 vaultId, uint256 vaultType,",
  "bytes32 supplyExchangePriceSlot, bytes32 borrowExchangePriceSlot,",
  "bytes32 userSupplySlot, bytes32 userBorrowSlot",
  ")",
].join("");

const CONFIGS_TUPLE = [
  "tuple(",
  "uint16 supplyRateMagnifier, uint16 borrowRateMagnifier,",
  "uint16 collateralFactor, uint16 liquidationThreshold,",
  "uint16 liquidationMaxLimit, uint16 withdrawalGap,",
  "uint16 liquidationPenalty, uint16 borrowFee,",
  "address oracle,",
  "uint256 oraclePriceOperate, uint256 oraclePriceLiquidate,",
  "address rebalancer, uint256 lastUpdateTimestamp",
  ")",
].join("");

const EXCHANGE_PRICES_TUPLE = [
  "tuple(",
  "uint256 lastStoredLiquiditySupplyExchangePrice, uint256 lastStoredLiquidityBorrowExchangePrice,",
  "uint256 lastStoredVaultSupplyExchangePrice, uint256 lastStoredVaultBorrowExchangePrice,",
  "uint256 liquiditySupplyExchangePrice, uint256 liquidityBorrowExchangePrice,",
  "uint256 vaultSupplyExchangePrice, uint256 vaultBorrowExchangePrice,",
  "uint256 supplyRateLiquidity, uint256 borrowRateLiquidity,",
  "int256 supplyRateVault, int256 borrowRateVault,",
  "int256 rewardsOrFeeRateSupply, int256 rewardsOrFeeRateBorrow",
  ")",
].join("");

const TOTAL_SUPPLY_BORROW_TUPLE = [
  "tuple(",
  "uint256 totalSupplyVault, uint256 totalBorrowVault,",
  "uint256 totalSupplyLiquidityOrDex, uint256 totalBorrowLiquidityOrDex,",
  "uint256 absorbedSupply, uint256 absorbedBorrow",
  ")",
].join("");

const LIMITS_TUPLE = [
  "tuple(",
  "uint256 withdrawLimit, uint256 withdrawableUntilLimit, uint256 withdrawable,",
  "uint256 borrowLimit, uint256 borrowableUntilLimit, uint256 borrowable,",
  "uint256 borrowLimitUtilization, uint256 minimumBorrowing",
  ")",
].join("");

const BRANCH_STATE_TUPLE = [
  "tuple(",
  "uint256 status, int256 minimaTick, uint256 debtFactor,",
  "uint256 partials, uint256 debtLiquidity,",
  "uint256 baseBranchId, int256 baseBranchMinima",
  ")",
].join("");

const VAULT_STATE_TUPLE = [
  "tuple(",
  "uint256 totalPositions, int256 topTick,",
  "uint256 currentBranch, uint256 totalBranch,",
  "uint256 totalBorrow, uint256 totalSupply,",
  `${BRANCH_STATE_TUPLE} currentBranchState`,
  ")",
].join("");

const USER_SUPPLY_DATA_TUPLE = [
  "tuple(",
  "bool modeWithInterest, uint256 supply, uint256 withdrawalLimit,",
  "uint256 lastUpdateTimestamp, uint256 expandPercent, uint256 expandDuration,",
  "uint256 baseWithdrawalLimit, uint256 withdrawableUntilLimit, uint256 withdrawable,",
  "uint256 decayEndTimestamp, uint256 decayAmount",
  ")",
].join("");

const USER_BORROW_DATA_TUPLE = [
  "tuple(",
  "bool modeWithInterest, uint256 borrow, uint256 borrowLimit,",
  "uint256 lastUpdateTimestamp, uint256 expandPercent, uint256 expandDuration,",
  "uint256 baseBorrowLimit, uint256 maxBorrowLimit,",
  "uint256 borrowableUntilLimit, uint256 borrowable, uint256 borrowLimitUtilization",
  ")",
].join("");

const VAULT_ENTIRE_DATA_TUPLE = [
  "tuple(",
  "address vault, bool isSmartCol, bool isSmartDebt,",
  `${CONSTANT_VIEWS_TUPLE} constantVariables,`,
  `${CONFIGS_TUPLE} configs,`,
  `${EXCHANGE_PRICES_TUPLE} exchangePricesAndRates,`,
  `${TOTAL_SUPPLY_BORROW_TUPLE} totalSupplyAndBorrow,`,
  `${LIMITS_TUPLE} limitsAndAvailability,`,
  `${VAULT_STATE_TUPLE} vaultState,`,
  `${USER_SUPPLY_DATA_TUPLE} liquidityUserSupplyData,`,
  `${USER_BORROW_DATA_TUPLE} liquidityUserBorrowData`,
  ")",
].join("");

// Minimal ABIs - only the functions we need
export const ABIS = {
  VAULT_RESOLVER: [
    `function positionByNftId(uint256 nftId_) view returns (${USER_POSITION_TUPLE} userPosition_, ${VAULT_ENTIRE_DATA_TUPLE} vaultData_)`,
    `function positionsByUser(address user_) view returns (${USER_POSITION_TUPLE}[] userPositions_, ${VAULT_ENTIRE_DATA_TUPLE}[] vaultsData_)`,
    "function getAllVaultsAddresses() view returns (address[])",
  ],

  ERC20: [
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function name() view returns (string)",
  ],
};

// Common token metadata cache (avoids on-chain calls for known tokens)
export const TOKENS = {
  // Mainnet
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": { symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": { symbol: "USDC", decimals: 6, name: "USD Coin" },
  "0xdAC17F958D2ee523a2206206994597C13D831ec7": { symbol: "USDT", decimals: 6, name: "Tether USD" },
  "0x6B175474E89094C44Da98b954EedeAC495271d0F": { symbol: "DAI", decimals: 18, name: "Dai Stablecoin" },
  "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0": { symbol: "wstETH", decimals: 18, name: "Wrapped stETH" },
  "0xae78736Cd615f374D3085123A210448E74Fc6393": { symbol: "rETH", decimals: 18, name: "Rocket Pool ETH" },
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": { symbol: "WBTC", decimals: 8, name: "Wrapped BTC" },
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": { symbol: "ETH", decimals: 18, name: "Ether" },
  "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee": { symbol: "weETH", decimals: 18, name: "Wrapped eETH" },
  "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704": { symbol: "cbETH", decimals: 18, name: "Coinbase Wrapped Staked ETH" },
  "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E": { symbol: "crvUSD", decimals: 18, name: "Curve USD" },
  "0x83F20F44975D03b1b09e64809B757c47f942BEeA": { symbol: "sDAI", decimals: 18, name: "Savings DAI" },
  "0x7A56E1C57C7475CCf742b1B0A76528344a234aC8": { symbol: "sUSDe", decimals: 18, name: "Staked USDe" },
  "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3": { symbol: "USDe", decimals: 18, name: "Ethena USDe" },
  // TODO: Add Arbitrum token metadata
};

// LogOperate event topic0 for transaction history
export const LOGOPERATE_TOPIC0 = '0xfef64760e30a41b9d5ba7dd65ff7236a61d89ed8b44c67a29e84db1a67513a1c';

// CoinGecko IDs for price fetching (no API key needed for basic usage)
export const COINGECKO_IDS = {
  'ETH': 'ethereum',
  'WETH': 'ethereum',
  'wstETH': 'wrapped-steth',
  'weETH': 'wrapped-eeth',
  'rETH': 'rocket-pool-eth',
  'cbETH': 'coinbase-wrapped-staked-eth',
  'WBTC': 'wrapped-bitcoin',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'DAI': 'dai',
  'crvUSD': 'crvusd',
  'sDAI': 'savings-dai',
  'sUSDe': 'ethena-staked-usde',
  'USDe': 'ethena-usde',
};
