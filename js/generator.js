/**
 * Professional PDF Statement Generator
 * Generates brokerage-style account statements using jsPDF
 */

import { FLUID_LOGO_BASE64 } from './logo.js';

const { jsPDF } = window.jspdf;

// Color palette
const COLORS = {
  primary: [26, 54, 93],      // Dark blue #1a365d
  secondary: [45, 55, 72],    // Dark gray #2d3748
  accent: [49, 130, 206],     // Blue #3182ce
  lightGray: [226, 232, 240], // #e2e8f0
  mediumGray: [160, 174, 192],// #a0aec0
  text: [45, 55, 72],         // #2d3748
  lightBg: [247, 250, 252],   // #f7fafc
  success: [56, 161, 105],    // #38a169
  warning: [214, 158, 46],    // #d69e2e
  danger: [229, 62, 62],      // #e53e3e
  white: [255, 255, 255],
};

export class StatementGenerator {
  constructor(options = {}) {
    this.companyName = options.companyName || 'Fluid';
    this.companyTagline = options.companyTagline || 'Lending & Borrowing Services';
    this.companyWebsite = options.companyWebsite || 'fluid.io';
    this.companyEmail = options.companyEmail || 'help@instadapp.io';
    this.doc = null;
    this.pageWidth = 0;
    this.pageHeight = 0;
    this.margin = 40;
    this.currentY = 0;
  }

  /**
   * Generate the complete PDF statement
   * @returns {Blob} PDF as blob for preview/download
   */
  generate(data) {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter',
    });

    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.currentY = this.margin;

    // Generate sections
    this.addHeader(data);
    this.addAccountInfo(data);
    this.addAccountSummary(data);
    if (data.transactions && data.transactions.length > 0) {
      this.addTransactionActivity(data);
    }
    this.addPositionDetails(data);
    this.addCollateralSchedule(data);
    this.addDisclosures(data);
    this.addFooter();

    // Return as blob
    return this.doc.output('blob');
  }

  /**
   * Add page header with branding
   */
  addHeader(data) {
    const doc = this.doc;
    const logoSize = 36;

    // Logo
    try {
      doc.addImage(FLUID_LOGO_BASE64, 'PNG', this.margin, this.currentY - 2, logoSize, logoSize);
    } catch (e) {
      // Skip logo if it fails to load
    }

    const textLeft = this.margin + logoSize + 8;

    // Company name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...COLORS.primary);
    doc.text(this.companyName, textLeft, this.currentY + 15);

    // Tagline
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text(this.companyTagline, textLeft, this.currentY + 28);

    // Website & email
    doc.setFontSize(8);
    doc.text(`${this.companyWebsite}  |  ${this.companyEmail}`, textLeft, this.currentY + 38);

    // Statement title (right aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.secondary);
    doc.text('MARGIN ACCOUNT STATEMENT', this.pageWidth - this.margin, this.currentY + 15, { align: 'right' });

    // Statement period
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(`Statement Period: ${data.statementPeriod}`, this.pageWidth - this.margin, this.currentY + 30, { align: 'right' });

    // Generation date
    const genDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.text(`Generated: ${genDate}`, this.pageWidth - this.margin, this.currentY + 42, { align: 'right' });

    // Divider line
    this.currentY += 55;
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(1.5);
    doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);

    this.currentY += 15;
  }

  /**
   * Add account holder information
   */
  addAccountInfo(data) {
    const doc = this.doc;
    const rightCol = this.pageWidth / 2;

    // Account holder name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text('Account Holder:', this.margin, this.currentY);
    doc.setFont('helvetica', 'normal');
    const holderName = data.holderName || 'Account Holder';
    doc.text(holderName, this.margin + 80, this.currentY);

    // Account number (masked NFT ID)
    doc.setFont('helvetica', 'bold');
    doc.text('Account No:', rightCol, this.currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(this.maskedAccountNumber(data.positions), rightCol + 60, this.currentY);

    this.currentY += 14;

    // Personal address (if provided)
    if (data.holderAddress) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.mediumGray);
      const addrLines = doc.splitTextToSize(data.holderAddress, rightCol - this.margin - 90);
      doc.text(addrLines, this.margin + 80, this.currentY);
      this.currentY += addrLines.length * 10 + 4;
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
    }

    // Account type
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Account Type:', this.margin, this.currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('Margin Account', this.margin + 80, this.currentY);

    // Number of positions
    doc.setFont('helvetica', 'bold');
    doc.text('Open Positions:', rightCol, this.currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.positions.length.toString(), rightCol + 80, this.currentY);

    this.currentY += 25;
  }

  /**
   * Add account summary boxes
   */
  addAccountSummary(data) {
    const doc = this.doc;
    const totals = this.calculateTotals(data);

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('ACCOUNT SUMMARY', this.margin, this.currentY);
    this.currentY += 20;

    const boxWidth = (this.pageWidth - this.margin * 2 - 20) / 2;
    const boxHeight = 80;

    // Collateral box (left)
    this.drawSummaryBox(
      this.margin, 
      this.currentY, 
      boxWidth, 
      boxHeight,
      {
        title: 'Total Collateral Value',
        mainValue: `$${this.formatNumber(totals.totalCollateralUsd)}`,
        subtitle: totals.collateralSummary,
      },
      COLORS.success
    );

    // Debt box (right)
    this.drawSummaryBox(
      this.margin + boxWidth + 20, 
      this.currentY, 
      boxWidth, 
      boxHeight,
      {
        title: 'Total Margin Balance',
        mainValue: `$${this.formatNumber(totals.totalDebtUsd)}`,
        subtitle: totals.debtSummary,
      },
      COLORS.danger
    );

    this.currentY += boxHeight + 20;

    // Metrics row
    const metrics = [
      { label: 'Net Account Value', value: `$${this.formatNumber(totals.netValue)}` },
      { label: 'Weighted Avg. LTV', value: `${totals.avgLtv}%` },
      { label: 'Avg. Margin Rate', value: `${totals.avgBorrowRate}%` },
      { label: 'Maintenance Req.', value: `${totals.avgLiquidationThreshold}%` },
    ];

    const metricWidth = (this.pageWidth - this.margin * 2) / metrics.length;
    
    metrics.forEach((metric, i) => {
      const x = this.margin + (i * metricWidth);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.mediumGray);
      doc.text(metric.label, x, this.currentY);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.text);
      doc.text(metric.value, x, this.currentY + 14);
    });

    this.currentY += 40;
  }

  /**
   * Draw a summary box
   */
  drawSummaryBox(x, y, width, height, content, accentColor) {
    const doc = this.doc;
    
    // Background
    doc.setFillColor(...COLORS.lightBg);
    doc.roundedRect(x, y, width, height, 3, 3, 'F');
    
    // Accent bar
    doc.setFillColor(...accentColor);
    doc.roundedRect(x, y, 4, height, 2, 2, 'F');

    // Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text(content.title, x + 15, y + 18);

    // Main value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...COLORS.text);
    doc.text(content.mainValue, x + 15, y + 42);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mediumGray);
    const subtitleLines = doc.splitTextToSize(content.subtitle, width - 30);
    doc.text(subtitleLines, x + 15, y + 58);
  }

  /**
   * Add transaction activity section
   */
  addTransactionActivity(data) {
    const doc = this.doc;
    const transactions = data.transactions;

    // Check if we need a new page
    if (this.currentY > this.pageHeight - 200) {
      doc.addPage();
      this.currentY = this.margin;
    }

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('TRANSACTION ACTIVITY', this.margin, this.currentY);
    this.currentY += 20;

    // Table headers
    const headers = ['Date', 'Description', 'Amount', 'Value (USD)'];
    const colWidths = [90, 160, 130, 85];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const startX = this.margin;

    // Header row background
    doc.setFillColor(...COLORS.primary);
    doc.rect(startX, this.currentY, tableWidth, 18, 'F');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);

    let currentX = startX;
    headers.forEach((header, i) => {
      doc.text(header, currentX + 5, this.currentY + 12);
      currentX += colWidths[i];
    });

    this.currentY += 22;

    // Data rows
    transactions.forEach((tx, index) => {
      // Check if we need a new page (leave room for footer)
      if (this.currentY > this.pageHeight - 60) {
        doc.addPage();
        this.currentY = this.margin;

        // Re-draw header on new page
        doc.setFillColor(...COLORS.primary);
        doc.rect(startX, this.currentY, tableWidth, 18, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.white);
        let hx = startX;
        headers.forEach((header, i) => {
          doc.text(header, hx + 5, this.currentY + 12);
          hx += colWidths[i];
        });
        this.currentY += 22;
      }

      const rowBg = index % 2 === 0 ? COLORS.white : COLORS.lightBg;
      const rowHeight = 20;

      // Row background
      doc.setFillColor(...rowBg);
      doc.rect(startX, this.currentY, tableWidth, rowHeight, 'F');

      currentX = startX;

      // Date - formatted as "MMM DD, YYYY"
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      const dateStr = tx.date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      doc.text(dateStr, currentX + 5, this.currentY + 13);
      currentX += colWidths[0];

      // Description
      doc.text(tx.description, currentX + 5, this.currentY + 13);
      currentX += colWidths[1];

      // Amount with +/- and symbol, colored for repay/withdraw
      const sign = tx.amount >= 0 ? '+' : '';
      const amountStr = `${sign}${this.formatNumber(tx.amount, 4)} ${tx.symbol}`;
      if (tx.isRepayOrWithdraw) {
        doc.setTextColor(...COLORS.success);
      } else {
        doc.setTextColor(...COLORS.text);
      }
      doc.text(amountStr, currentX + 5, this.currentY + 13);
      currentX += colWidths[2];

      // USD Value
      doc.setTextColor(...COLORS.text);
      doc.text(`$${this.formatNumber(tx.usdValue, 2)}`, currentX + 5, this.currentY + 13);

      this.currentY += rowHeight;
    });

    // Table border
    const dataHeight = transactions.length * 20 + 22;
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);

    this.currentY += 20;
  }

  /**
   * Add position details table
   */
  addPositionDetails(data) {
    const doc = this.doc;
    
    // Check if we need a new page
    if (this.currentY > this.pageHeight - 200) {
      doc.addPage();
      this.currentY = this.margin;
    }

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('MARGIN POSITION DETAILS', this.margin, this.currentY);
    this.currentY += 20;

    // Table headers
    const headers = ['Position', 'Collateral', 'Margin Loan', 'LTV', 'Health', 'Status'];
    const colWidths = [55, 130, 120, 50, 55, 55];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const startX = this.margin;

    // Header row background
    doc.setFillColor(...COLORS.primary);
    doc.rect(startX, this.currentY, tableWidth, 18, 'F');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    
    let currentX = startX;
    headers.forEach((header, i) => {
      doc.text(header, currentX + 5, this.currentY + 12);
      currentX += colWidths[i];
    });

    this.currentY += 22;

    // Data rows
    data.positions.forEach((position, index) => {
      const f = position.formatted;
      const rowBg = index % 2 === 0 ? COLORS.white : COLORS.lightBg;
      
      // Row background
      doc.setFillColor(...rowBg);
      doc.rect(startX, this.currentY, tableWidth, 28, 'F');

      currentX = startX;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);

      // Position ID (sequential, no NFT reference)
      doc.text(`Pos. ${index + 1}`, currentX + 5, this.currentY + 17);
      currentX += colWidths[0];

      // Collateral
      doc.text(`${this.formatNumber(f.collateral.amount, 4)} ${f.collateral.symbol}`, currentX + 5, this.currentY + 12);
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.mediumGray);
      doc.text(f.collateral.name, currentX + 5, this.currentY + 22);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      currentX += colWidths[1];

      // Debt
      doc.text(`${this.formatNumber(f.debt.amount, 2)} ${f.debt.symbol}`, currentX + 5, this.currentY + 12);
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.mediumGray);
      doc.text(f.debt.name, currentX + 5, this.currentY + 22);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      currentX += colWidths[2];

      // LTV
      doc.text(`${f.ltv}%`, currentX + 5, this.currentY + 17);
      currentX += colWidths[3];

      // Health Factor - color coded
      const hf = parseFloat(f.healthFactor);
      if (hf > 1.5) {
        doc.setTextColor(...COLORS.success);
      } else if (hf > 1.2) {
        doc.setTextColor(...COLORS.warning);
      } else {
        doc.setTextColor(...COLORS.danger);
      }
      doc.text(f.healthFactor, currentX + 5, this.currentY + 17);
      currentX += colWidths[4];

      // Status
      if (position.isLiquidated) {
        doc.setTextColor(...COLORS.danger);
        doc.text('Margin Call', currentX + 5, this.currentY + 17);
      } else {
        doc.setTextColor(...COLORS.success);
        doc.text('Active', currentX + 5, this.currentY + 17);
      }

      this.currentY += 28;
    });

    // Table border
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);
    doc.rect(startX, this.currentY - (data.positions.length * 28) - 22, tableWidth, (data.positions.length * 28) + 22);

    this.currentY += 20;
  }

  /**
   * Add collateral schedule
   */
  addCollateralSchedule(data) {
    const doc = this.doc;

    // Check page space
    if (this.currentY > this.pageHeight - 180) {
      doc.addPage();
      this.currentY = this.margin;
    }

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('COLLATERAL SCHEDULE', this.margin, this.currentY);
    this.currentY += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);
    doc.text('Assets held as collateral against margin loan positions:', this.margin, this.currentY + 10);
    this.currentY += 25;

    // Mini table for collateral
    const headers = ['Asset', 'Quantity', 'Price', 'Value', 'Maintenance Margin'];
    const colWidths = [120, 80, 80, 90, 95];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const startX = this.margin;

    // Header
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(startX, this.currentY, tableWidth, 16, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.secondary);

    let currentX = startX;
    headers.forEach((header, i) => {
      doc.text(header, currentX + 4, this.currentY + 11);
      currentX += colWidths[i];
    });

    this.currentY += 18;

    // Data rows
    data.positions.forEach(position => {
      const f = position.formatted;
      const price = data.prices?.[f.collateral.symbol] || 0;
      const value = f.collateral.amount * price;

      currentX = startX;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.text);

      doc.text(f.collateral.name, currentX + 4, this.currentY + 10);
      currentX += colWidths[0];

      doc.text(this.formatNumber(f.collateral.amount, 6), currentX + 4, this.currentY + 10);
      currentX += colWidths[1];

      doc.text(`$${this.formatNumber(price, 2)}`, currentX + 4, this.currentY + 10);
      currentX += colWidths[2];

      doc.text(`$${this.formatNumber(value, 2)}`, currentX + 4, this.currentY + 10);
      currentX += colWidths[3];

      doc.text(`${position.vaultData.collateralFactor.toFixed(0)}%`, currentX + 4, this.currentY + 10);

      this.currentY += 16;
    });

    this.currentY += 15;
  }

  /**
   * Add disclosures section
   */
  addDisclosures(data) {
    const doc = this.doc;

    // Check page space
    if (this.currentY > this.pageHeight - 150) {
      doc.addPage();
      this.currentY = this.margin;
    }

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.primary);
    doc.text('IMPORTANT DISCLOSURES', this.margin, this.currentY);
    this.currentY += 12;

    const disclosures = [
      '1. This statement reflects the current status of your margin account with Fluid. All positions are subject to the terms of your margin agreement.',
      '2. Margin positions are subject to maintenance requirements. If your Loan-to-Value (LTV) ratio exceeds the maintenance threshold, your collateral may be liquidated to cover outstanding obligations.',
      '3. Interest rates on margin loans are variable and may change based on prevailing market conditions and fund availability.',
      '4. All values shown are based on market prices at the time of statement generation and are provided for informational purposes. Actual settlement values may differ.',
      '5. This statement is provided for informational purposes only and does not constitute investment advice or a solicitation to buy or sell any securities.',
      '6. Margin lending involves risk, including the possible loss of more than your initial deposit. Past performance is not indicative of future results.',
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.mediumGray);

    disclosures.forEach(disclosure => {
      const lines = doc.splitTextToSize(disclosure, this.pageWidth - this.margin * 2);
      doc.text(lines, this.margin, this.currentY);
      this.currentY += lines.length * 8 + 3;
    });
  }

  /**
   * Add footer to all pages
   */
  addFooter() {
    const doc = this.doc;
    const pageCount = doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(...COLORS.lightGray);
      doc.setLineWidth(0.5);
      doc.line(this.margin, this.pageHeight - 40, this.pageWidth - this.margin, this.pageHeight - 40);

      // Footer text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.mediumGray);
      
      const footerText = `${this.companyName} | Generated ${new Date().toISOString().split('T')[0]} | Page ${i} of ${pageCount}`;
      doc.text(footerText, this.pageWidth / 2, this.pageHeight - 28, { align: 'center' });
    }
  }

  /**
   * Calculate totals from position data
   */
  calculateTotals(data) {
    let totalCollateralUsd = 0;
    let totalDebtUsd = 0;
    let weightedLtv = 0;
    let weightedBorrowRate = 0;
    let weightedLiqThreshold = 0;
    const collateralBreakdown = {};
    const debtBreakdown = {};

    data.positions.forEach(pos => {
      const f = pos.formatted;
      const collateralPrice = data.prices?.[f.collateral.symbol] || 0;
      const debtPrice = data.prices?.[f.debt.symbol] || 1;
      
      const collateralUsd = f.collateral.amount * collateralPrice;
      const debtUsd = f.debt.amount * debtPrice;
      
      totalCollateralUsd += collateralUsd;
      totalDebtUsd += debtUsd;
      
      weightedLtv += parseFloat(f.ltv) * debtUsd;
      weightedBorrowRate += parseFloat(f.borrowRateApy) * debtUsd;
      weightedLiqThreshold += parseFloat(f.liquidationThreshold) * collateralUsd;
      
      collateralBreakdown[f.collateral.symbol] = (collateralBreakdown[f.collateral.symbol] || 0) + f.collateral.amount;
      debtBreakdown[f.debt.symbol] = (debtBreakdown[f.debt.symbol] || 0) + f.debt.amount;
    });

    const avgLtv = totalDebtUsd > 0 ? (weightedLtv / totalDebtUsd).toFixed(2) : '0.00';
    const avgBorrowRate = totalDebtUsd > 0 ? (weightedBorrowRate / totalDebtUsd).toFixed(2) : '0.00';
    const avgLiquidationThreshold = totalCollateralUsd > 0 ? (weightedLiqThreshold / totalCollateralUsd).toFixed(2) : '0.00';

    return {
      totalCollateralUsd,
      totalDebtUsd,
      netValue: totalCollateralUsd - totalDebtUsd,
      avgLtv,
      avgBorrowRate,
      avgLiquidationThreshold,
      collateralSummary: Object.entries(collateralBreakdown)
        .map(([symbol, amount]) => `${this.formatNumber(amount, 4)} ${symbol}`)
        .join(', ') || 'None',
      debtSummary: Object.entries(debtBreakdown)
        .map(([symbol, amount]) => `${this.formatNumber(amount, 2)} ${symbol}`)
        .join(', ') || 'None',
    };
  }

  /**
   * Format numbers with commas
   */
  formatNumber(num, decimals = 2) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /**
   * Truncate address for display
   */
  truncateAddress(address) {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Generate masked account number from NFT ID (e.g. ****0006)
   */
  maskedAccountNumber(positions) {
    if (!positions || positions.length === 0) return '****0000';
    const nftId = positions[0].nftId.toString();
    const last4 = nftId.padStart(4, '0').slice(-4);
    return `****${last4}`;
  }
}
