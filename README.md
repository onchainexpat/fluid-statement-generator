# Fluid.io Statement

Generate professional PDF margin account statements for your [Fluid](https://fluid.io) DeFi lending and borrowing positions. Runs entirely in your browser — no server, no data collection, complete privacy.

## Privacy First

- **100% Local** — All processing happens in your browser. Nothing is sent to any backend server.
- **No Accounts** — No sign-up, no login, no cookies, no tracking, no analytics.
- **No Backend** — There is no server. The app is static HTML, CSS, and JavaScript.
- **Your RPC** — Use your own Ethereum node for maximum privacy. The only network requests are to the Ethereum RPC (on-chain data), CoinGecko (prices), and optionally Etherscan (transaction history).
- **Open Source** — Audit every line of code yourself. MIT licensed.

## Quick Start

```bash
git clone https://github.com/onchainexpat/fluid-statement-generator.git
cd fluid-statement-generator
npm start
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

**Other ways to serve:**

```bash
# Python
python -m http.server 8000

# npx
npx serve .

# VS Code — install "Live Server" extension, right-click index.html → Open with Live Server
```

> Some browsers block ES modules from `file://` URLs. If you see errors opening `index.html` directly, use a local server instead.

## How to Use

1. **Enter your wallet address** (or a specific position NFT ID). No private keys or seed phrases needed — this is read-only.
2. **Add an Etherscan API key** (optional) to include transaction history in your statement. [Get a free key here](https://etherscan.io/myapikey) — it takes less than a minute.
3. **Click Generate.** The app will connect to the blockchain, fetch your positions and market prices, and generate a professional PDF.
4. **Download the PDF** or preview it directly in the browser.

## What's in the Statement

### Account Summary
- Total collateral value (USD)
- Total margin balance (USD)
- Net account value
- Weighted average LTV, borrow APY, and liquidation thresholds

### Transaction Activity *(requires Etherscan API key)*
- Chronological list of all deposits, withdrawals, borrows, and repayments
- Decoded from on-chain `LogOperate` events
- Date, description, amount with token symbol, and USD value

### Margin Position Details
- Per-position collateral and debt amounts
- Current LTV and health factor (color-coded)
- Position status

### Collateral Schedule
- Asset-by-asset breakdown with current market prices
- Collateral factors and pledged values

### Disclosures
- Risk warnings and protocol information

## Configuration

### RPC URL

The app uses a public RPC by default (`https://ethereum-rpc.publicnode.com`). For better performance and privacy, use your own endpoint from Alchemy, Infura, QuickNode, or your own node.

### Etherscan API Key

Required only for the Transaction Activity section. The free tier (5 requests/sec) is sufficient. Sign up at [https://etherscan.io/myapikey](https://etherscan.io/myapikey).

### No Other API Keys Required

- **Blockchain data** — Read directly from public Fluid smart contracts
- **Price data** — CoinGecko free API (no key needed)

## Project Structure

```
fluid-statement-generator/
├── index.html          # Main UI
├── serve.js            # Simple local dev server
├── js/
│   ├── app.js          # Application logic & UI wiring
│   ├── fetcher.js      # Blockchain data fetching (ethers.js)
│   ├── history.js      # Transaction history via Etherscan V2 API
│   ├── generator.js    # PDF generation (jsPDF)
│   ├── contracts.js    # Contract addresses, ABIs & constants
│   └── logo.js         # Fluid logo (base64)
├── package.json
└── README.md
```

## Technical Details

### Dependencies (loaded via CDN — no build step)
- **ethers.js v6** — Ethereum contract interaction
- **jsPDF** — Client-side PDF generation
- **Tailwind CSS** — Styling

### Smart Contracts Used
- `VaultResolver` — Position and vault data
- `VaultPositionsResolver` — NFT enumeration
- `ERC20` — Token metadata

### Etherscan V2 Integration
- Fetches `LogOperate` events from individual vault contracts
- Decodes ABI-encoded event data (int256 collateral and debt amounts)
- Handles pagination (1000 results/page) and rate limiting
- Filters events by the user's NFT IDs

### Browser Compatibility
- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## FAQ

**Q: Is my private key or seed phrase needed?**
No. This is completely read-only. Only your public wallet address is used.

**Q: Why do I need an Etherscan API key?**
Only if you want transaction history in your statement. The key is free and lets the app fetch historical events from the blockchain. Without it, the statement still generates — just without the Transaction Activity section.

**Q: Are the prices accurate?**
Prices are fetched from CoinGecko at generation time. They may differ slightly from on-chain oracle prices.

**Q: Can I use this for taxes or compliance?**
This generates informational documents based on on-chain data. Consult a tax professional for official documentation requirements.

## Disclaimers

- This tool is not affiliated with Instadapp or Fluid Protocol
- Generated documents are for informational purposes only
- Always verify data by checking the blockchain directly
- DeFi positions carry significant risks including liquidation
- This is not financial or tax advice

## License

MIT — see [LICENSE](LICENSE) for details.

## Resources

- [Fluid Protocol](https://fluid.io)
- [Fluid Documentation](https://docs.fluid.instadapp.io/)
- [Etherscan API](https://etherscan.io/myapikey)
