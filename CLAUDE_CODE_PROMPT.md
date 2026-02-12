# Fluid.io Statement - Build Instructions

Build a local-first web application that generates professional PDF account statements for Fluid.io DeFi lending/borrowing positions. The app runs entirely in the browser with no backend required.

## Project Overview

**Goal**: Create a tool that fetches on-chain position data from Fluid Protocol and generates brokerage-style PDF statements (similar to Fidelity margin account statements) that users can submit to banks like Revolut for proof of income/assets documentation.

**Key Requirements**:
- 100% client-side (no server/backend)
- Privacy-first (users can specify their own RPC)
- No API keys required (Etherscan key optional for transaction history)
- Professional PDF output resembling traditional finance statements

## Tech Stack

- **HTML/CSS**: Tailwind CSS via CDN
- **JavaScript**: Vanilla ES modules
- **Ethereum**: ethers.js v6 via CDN
- **PDF Generation**: jsPDF via CDN
- **Prices**: CoinGecko free API (no key needed)

## Project Structure

```
fluid-statement-generator/
├── index.html          # Main UI
├── js/
│   ├── app.js          # Application logic, UI handling
│   ├── fetcher.js      # Blockchain data fetching
│   ├── history.js      # Transaction history via Etherscan V2 API
│   ├── generator.js    # PDF generation
│   ├── contracts.js    # Contract addresses & ABIs
│   └── logo.js         # Fluid logo (base64)
├── serve.js            # Simple Node.js local server
├── package.json
├── README.md
├── LICENSE
└── .gitignore
```

## Fluid Protocol Details

Fluid (formerly Instadapp) stores user positions as NFTs. We need to query these resolver contracts:

### Contract Addresses (Ethereum Mainnet)
```javascript
VAULT_FACTORY: "0x324c5Dc1fC42c7a4D43d92df1eBA58a54d13Bf2d"
VAULT_RESOLVER: "0x93CAB6529aD849b2583EBAe32D13817A2F38cEb4"
VAULT_POSITIONS_RESOLVER: "0x46E14F28E6a29A2046C90cD0B50e539e093d3CF6"
VAULT_NFT: "0x264786EF916af64a1DB19F513F24a3681734ce92"
```

### Default RPCs
```javascript
mainnet: "https://eth.llamarpc.com"
arbitrum: "https://arb1.arbitrum.io/rpc"
base: "https://mainnet.base.org"
```

### Key ABIs Needed

**VaultNFT** (to enumerate positions):
```javascript
"function balanceOf(address owner) view returns (uint256)"
"function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)"
```

**VaultResolver** (to get position details):
```javascript
"function positionByNftId(uint256 nftId_) view returns (tuple(...position), tuple(...vaultData))"
```

The position data includes: nftId, owner, isLiquidated, vault, collateral, debt, tick
The vaultData includes: supplyToken, borrowToken, decimals, collateralFactor, liquidationThreshold, borrowRate, supplyRate, oraclePrice

## UI Requirements

### Layout
- **Left sidebar** (1/3 width on desktop): Configuration form
- **Right panel** (2/3 width): PDF preview with iframe
- **Below preview**: Summary cards (Total Collateral, Total Debt, Position Count)

### Configuration Form Fields
1. **Network** (dropdown): Ethereum Mainnet, Arbitrum One, Base
2. **RPC URL** (text, optional): Custom RPC endpoint with placeholder showing default
3. **Wallet Address** (text, required): 0x... format
4. **Position NFT ID** (text, optional): Alternative to wallet address
5. **Statement Period** (text): Default to current month "Jan 1, 2026 - Jan 31, 2026"
6. **Account Holder Name** (text, optional): For the statement header

### Status/Feedback
- Loading spinner with status text during generation
- Error display area (red box)
- Download button (appears after successful generation)

### Privacy Badge
Show "🔒 Local Only" badge in header to reassure users

## PDF Statement Sections

Generate a professional PDF with these sections:

### 1. Header
- Company name: "Fluid Protocol"
- Tagline: "Decentralized Lending & Borrowing Platform"
- "ACCOUNT STATEMENT" title (right aligned)
- Statement period and generation date

### 2. Account Info
- Account holder name or truncated address
- Full wallet address
- Network name
- Position NFT IDs

### 3. Account Summary
Two colored boxes side by side:
- **Left (green accent)**: Total Collateral Value in USD
- **Right (red accent)**: Total Outstanding Debt in USD

Metrics row below:
- Net Account Value
- Weighted Avg. LTV
- Avg. Borrow APY
- Liquidation Threshold

### 4. Position Details Table
Columns: Position ID, Collateral, Debt, LTV, Health Factor, Status
- Health factor color coded: >1.5 green, 1.2-1.5 yellow, <1.2 red
- Status: "Active" (green) or "Liquidated" (red)

### 5. Collateral Schedule
Mini table: Asset, Quantity, Price, Value, Collateral Factor

### 6. Disclosures
Standard boilerplate about:
- DeFi protocol risks
- Variable interest rates
- Liquidation warnings
- Data accuracy disclaimers
- Not financial advice

### 7. Footer (all pages)
- Company name
- Generation date
- Page X of Y

## Data Flow

1. User enters wallet address and clicks Generate
2. `fetcher.js` connects to RPC via ethers.js
3. Query VaultNFT.balanceOf() to get NFT count
4. Loop: VaultNFT.tokenOfOwnerByIndex() to get each NFT ID
5. For each NFT: VaultResolver.positionByNftId() to get position details
6. Parse and format: convert wei to human amounts, calculate LTV, health factor
7. Fetch prices from CoinGecko (no API key needed)
8. Pass data to `generator.js`
9. Generate PDF using jsPDF
10. Display in iframe and enable download

## Token Metadata Cache

Pre-populate common tokens to avoid extra RPC calls:
```javascript
"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": { symbol: "WETH", decimals: 18 }
"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": { symbol: "USDC", decimals: 6 }
"0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0": { symbol: "wstETH", decimals: 18 }
// etc.
```

## CoinGecko Price Fetching

```javascript
const url = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum,wrapped-steth,...&vs_currencies=usd`;
// No API key needed for basic usage
```

Map token symbols to CoinGecko IDs:
```javascript
'WETH': 'ethereum'
'wstETH': 'wrapped-steth'
'USDC': 'usd-coin'
// etc.
```

## Local Server (serve.js)

Simple Node.js HTTP server (no dependencies):
- Serves static files from project directory
- Handles MIME types for .html, .js, .css
- Prevents directory traversal
- Prints friendly startup message with URL

## Error Handling

Handle these cases gracefully:
- Invalid Ethereum address format
- RPC connection failure
- No positions found for address
- NFT ID not found
- CoinGecko API failure (use fallback prices)
- Position is liquidated (skip or show differently)

## Styling Notes

Use Tailwind CSS classes. Color palette:
- Primary: `#1a365d` (dark blue)
- Accent: `#3182ce` (blue)
- Success: `#38a169` (green)
- Warning: `#d69e2e` (yellow)
- Danger: `#e53e3e` (red)
- Light background: `#f7fafc`

## Build This Project

Create all the files with complete, working code. The app should:
1. Load in a browser via local server
2. Accept a wallet address
3. Fetch real position data from Fluid contracts
4. Generate a professional PDF
5. Display preview and allow download

Focus on clean, readable code with good error handling. No build step needed - pure ES modules loaded via CDN.
