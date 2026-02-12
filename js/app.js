/**
 * Fluid.io Statement - Main Application
 * Handles UI interactions and coordinates data fetching + PDF generation
 */

import { FluidFetcher } from './fetcher.js';
import { StatementGenerator } from './generator.js';
import { TransactionHistoryFetcher } from './history.js';
import { DEFAULT_RPCS } from './contracts.js';
import { FLUID_LOGO_BASE64 } from './logo.js';

class App {
  constructor() {
    this.fetcher = null;
    this.generator = new StatementGenerator();
    this.currentPdfBlob = null;
    this.positions = [];
    this.prices = {};
    
    this.initElements();
    this.initEventListeners();
    this.setDefaultPeriod();

    // Set header logo
    const headerLogo = document.getElementById('headerLogo');
    if (headerLogo) headerLogo.src = FLUID_LOGO_BASE64;
  }

  /**
   * Cache DOM elements
   */
  initElements() {
    this.elements = {
      form: document.getElementById('configForm'),
      generateBtn: document.getElementById('generateBtn'),
      downloadBtn: document.getElementById('downloadBtn'),
      
      // Inputs
      network: document.getElementById('network'),
      etherscanApiKey: document.getElementById('etherscanApiKey'),
      rpcUrl: document.getElementById('rpcUrl'),
      walletAddress: document.getElementById('walletAddress'),
      nftId: document.getElementById('nftId'),
      statementPeriod: document.getElementById('statementPeriod'),
      holderName: document.getElementById('holderName'),
      holderAddress: document.getElementById('holderAddress'),
      
      // Status areas
      statusArea: document.getElementById('statusArea'),
      statusText: document.getElementById('statusText'),
      errorArea: document.getElementById('errorArea'),
      errorText: document.getElementById('errorText'),
      downloadArea: document.getElementById('downloadArea'),
      
      // Preview
      previewContainer: document.getElementById('previewContainer'),
      emptyState: document.getElementById('emptyState'),
      pdfPreview: document.getElementById('pdfPreview'),
      previewInfo: document.getElementById('previewInfo'),
      
      // Summary cards
      positionSummary: document.getElementById('positionSummary'),
      totalCollateral: document.getElementById('totalCollateral'),
      totalDebt: document.getElementById('totalDebt'),
      positionCount: document.getElementById('positionCount'),
    };
  }

  /**
   * Set up event listeners
   */
  initEventListeners() {
    // Form submission
    this.elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleGenerate();
    });

    // Download button
    this.elements.downloadBtn.addEventListener('click', () => {
      this.handleDownload();
    });

    // Network change updates RPC placeholder
    this.elements.network.addEventListener('change', () => {
      const network = this.elements.network.value;
      this.elements.rpcUrl.placeholder = DEFAULT_RPCS[network];
    });

    // Clear error on input
    ['walletAddress', 'nftId', 'rpcUrl', 'etherscanApiKey'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        this.hideError();
      });
    });

    // Example address buttons
    document.querySelectorAll('.example-addr').forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.walletAddress.value = btn.dataset.address;
        this.elements.nftId.value = '';
        this.hideError();
      });
    });
  }

  /**
   * Set default statement period to current month
   */
  setDefaultPeriod() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const format = (d) => d.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
    
    this.elements.statementPeriod.value = `${format(start)} - ${format(end)}`;
  }

  /**
   * Main generation handler
   */
  async handleGenerate() {
    const walletAddress = this.elements.walletAddress.value.trim();
    const nftId = this.elements.nftId.value.trim();

    // Validation
    if (!walletAddress && !nftId) {
      this.showError('Please enter a wallet address or NFT ID');
      return;
    }

    if (walletAddress && !this.isValidAddress(walletAddress)) {
      this.showError('Invalid Ethereum address format');
      return;
    }

    try {
      this.setLoading(true);
      this.hideError();
      
      // Initialize fetcher
      this.showStatus('Connecting to blockchain...');
      const network = this.elements.network.value;
      const rpcUrl = this.elements.rpcUrl.value.trim() || null;
      
      this.fetcher = new FluidFetcher(network, rpcUrl);
      await this.fetcher.init();

      // Fetch positions
      let ownerAddress = walletAddress;
      
      if (nftId) {
        this.showStatus('Fetching position data...');
        const position = await this.fetcher.getPositionByNftId(nftId);

        if (!position) {
          throw new Error(`Position NFT #${nftId} not found`);
        }

        ownerAddress = position.owner;
        const formatted = await this.fetcher.formatPosition(position);
        this.positions = [formatted];
      } else {
        this.showStatus('Fetching all positions...');
        this.positions = await this.fetcher.getAllPositions(walletAddress);

        if (this.positions.length === 0) {
          throw new Error('No active positions found for this address (smart/DEX positions are excluded)');
        }
      }

      // Fetch prices
      this.showStatus('Fetching market prices...');
      const symbols = new Set();
      this.positions.forEach(p => {
        symbols.add(p.formatted.collateral.symbol);
        symbols.add(p.formatted.debt.symbol);
      });
      this.prices = await FluidFetcher.fetchPrices(Array.from(symbols));

      // Update summary cards
      this.updateSummaryCards(ownerAddress);

      // Fetch transaction history (if Etherscan API key provided)
      let transactions = null;
      const etherscanApiKey = this.elements.etherscanApiKey.value.trim();
      if (etherscanApiKey) {
        try {
          this.showStatus('Fetching transaction history...');
          const historyFetcher = new TransactionHistoryFetcher(etherscanApiKey);
          transactions = await historyFetcher.fetchForPositions(this.positions, this.prices);
        } catch (error) {
          console.warn('Failed to fetch transaction history:', error);
          // Non-fatal: continue without transactions
        }
      }

      // Generate PDF
      this.showStatus('Generating PDF...');
      const statementData = {
        ownerAddress,
        holderName: this.elements.holderName.value.trim() || null,
        holderAddress: this.elements.holderAddress.value.trim() || null,
        statementPeriod: this.elements.statementPeriod.value,
        network: this.getNetworkName(network),
        positions: this.positions,
        prices: this.prices,
        transactions,
        generatedAt: new Date().toISOString(),
      };

      this.currentPdfBlob = this.generator.generate(statementData);

      // Show preview
      this.showPreview();
      this.showStatus('Statement generated!');
      
      // Show download button
      this.elements.downloadArea.classList.remove('hidden');

    } catch (error) {
      console.error('Generation error:', error);
      this.showError(error.message || 'An error occurred while generating the statement');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Handle PDF download
   */
  handleDownload() {
    if (!this.currentPdfBlob) return;

    const url = URL.createObjectURL(this.currentPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluid_statement_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Show PDF preview in iframe
   */
  showPreview() {
    if (!this.currentPdfBlob) return;

    const url = URL.createObjectURL(this.currentPdfBlob);
    
    this.elements.emptyState.classList.add('hidden');
    this.elements.pdfPreview.classList.remove('hidden');
    this.elements.pdfPreview.src = url;
    
    this.elements.previewInfo.textContent = `${this.positions.length} position(s) | Generated just now`;
  }

  /**
   * Update summary cards
   */
  updateSummaryCards(ownerAddress) {
    let totalCollateralUsd = 0;
    let totalDebtUsd = 0;

    this.positions.forEach(pos => {
      const f = pos.formatted;
      const collateralPrice = this.prices[f.collateral.symbol] || 0;
      const debtPrice = this.prices[f.debt.symbol] || 1;
      
      totalCollateralUsd += f.collateral.amount * collateralPrice;
      totalDebtUsd += f.debt.amount * debtPrice;
    });

    this.elements.totalCollateral.textContent = `$${this.formatNumber(totalCollateralUsd)}`;
    this.elements.totalDebt.textContent = `$${this.formatNumber(totalDebtUsd)}`;
    this.elements.positionCount.textContent = this.positions.length.toString();
    
    this.elements.positionSummary.classList.remove('hidden');
  }

  /**
   * Show loading state
   */
  setLoading(loading) {
    if (loading) {
      this.elements.generateBtn.disabled = true;
      this.elements.generateBtn.innerHTML = `
        <div class="spinner"></div>
        <span>Generating...</span>
      `;
      this.elements.statusArea.classList.remove('hidden');
    } else {
      this.elements.generateBtn.disabled = false;
      this.elements.generateBtn.innerHTML = '<span>Generate Statement</span>';
      setTimeout(() => {
        this.elements.statusArea.classList.add('hidden');
      }, 2000);
    }
  }

  /**
   * Show status message
   */
  showStatus(message) {
    this.elements.statusText.textContent = message;
  }

  /**
   * Show error message
   */
  showError(message) {
    this.elements.errorText.textContent = message;
    this.elements.errorArea.classList.remove('hidden');
  }

  /**
   * Hide error message
   */
  hideError() {
    this.elements.errorArea.classList.add('hidden');
  }

  /**
   * Validate Ethereum address
   */
  isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get human-readable network name
   */
  getNetworkName(network) {
    const names = {
      mainnet: 'Ethereum Mainnet',
      // TODO: Add L2 support
      // arbitrum: 'Arbitrum One',
      // base: 'Base',
    };
    return names[network] || network;
  }

  /**
   * Format number with commas
   */
  formatNumber(num, decimals = 2) {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
