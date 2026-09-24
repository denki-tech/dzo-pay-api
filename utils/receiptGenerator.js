const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const CurrencyFormatter = require('./formatCurrency');

class ReceiptGenerator {
  static async generatePDF(transaction, outputPath) {
    // In production, use a PDF library like puppeteer or pdfkit
    // This generates a receipt data object that can be used with any PDF library

    const receiptData = {
      receiptNumber: `RCP-${transaction.reference}`,
      date: new Date(transaction.createdAt).toLocaleString('en-NG', {
        dateStyle: 'full',
        timeStyle: 'medium',
      }),
      transactionReference: transaction.reference,
      externalReference: transaction.externalReference,
      type: transaction.type.toUpperCase(),
      status: transaction.status.toUpperCase(),
      amount: CurrencyFormatter.format(transaction.amount, transaction.currency),
      currency: transaction.currency,
      fee: CurrencyFormatter.format(transaction.fee, transaction.currency),
      vat: CurrencyFormatter.format(transaction.vat, transaction.currency),
      netAmount: CurrencyFormatter.format(transaction.netAmount, transaction.currency),
      description: transaction.description,
      provider: transaction.provider,
      walletId: transaction.walletId,
      sourceWallet: transaction.sourceWalletId,
      destinationWallet: transaction.destinationWalletId,
      destinationAccount: transaction.destinationAccount,
      ipAddress: transaction.ipAddress,
      location: transaction.location,
      riskScore: transaction.riskScore,
      fraudFlags: transaction.fraudFlags,
      generatedAt: new Date().toISOString(),
      merchant: {
        name: 'D-ZO Pay',
        address: '123 Fintech Street, Lagos, Nigeria',
        phone: '+234 800 123 4567',
        email: 'support@dzo-pay.com',
        website: 'https://dzo-pay.com',
        logo: 'https://dzo-pay.com/logo.png',
      },
      disclaimer: 'This is an official receipt from D-ZO Pay. Please keep it for your records.',
      support: {
        email: 'support@dzo-pay.com',
        phone: '+234 800 123 4567',
        chat: 'https://dzo-pay.com/support',
      },
    };

    // Save receipt data as JSON for now (PDF generation would use this)
    const receiptDir = path.join(process.cwd(), 'uploads', 'receipts');
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }

    const fileName = `${transaction.reference}.json`;
    const filePath = path.join(receiptDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(receiptData, null, 2));

    return {
      data: receiptData,
      filePath,
      downloadUrl: `/api/v1/receipts/${transaction.reference}`,
    };
  }

  static async generateImage(transaction) {
    // Generate a simple receipt image using canvas
    // In production, use a more sophisticated approach

    const width = 400;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('D-ZO PAY', width / 2, 45);

    // Content
    ctx.fillStyle = '#1f2937';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';

    let y = 120;
    const lineHeight = 30;

    ctx.fillText(`Receipt #${transaction.reference}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Date: ${new Date(transaction.createdAt).toLocaleDateString()}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Type: ${transaction.type.toUpperCase()}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Status: ${transaction.status.toUpperCase()}`, 20, y);
    y += lineHeight * 2;

    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Amount: ${CurrencyFormatter.format(transaction.amount, transaction.currency)}`, 20, y);
    y += lineHeight;
    ctx.font = '16px Arial';
    ctx.fillText(`Fee: ${CurrencyFormatter.format(transaction.fee, transaction.currency)}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Description: ${transaction.description}`, 20, y);

    // Footer
    y = height - 60;
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Thank you for using D-ZO Pay', width / 2, y);
    y += 20;
    ctx.fillText('support@dzo-pay.com', width / 2, y);

    return canvas.toBuffer('image/png');
  }

  static generateHTML(transaction) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${transaction.reference}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f2937; color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .amount { font-size: 24px; font-weight: bold; color: #1f2937; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>D-ZO PAY</h1>
          <p>Official Receipt</p>
        </div>
        <div class="content">
          <div class="row"><span>Receipt #</span><span>${transaction.reference}</span></div>
          <div class="row"><span>Date</span><span>${new Date(transaction.createdAt).toLocaleString()}</span></div>
          <div class="row"><span>Type</span><span>${transaction.type.toUpperCase()}</span></div>
          <div class="row"><span>Status</span><span>${transaction.status.toUpperCase()}</span></div>
          <div class="row"><span>Description</span><span>${transaction.description}</span></div>
          <div class="row amount"><span>Amount</span><span>${CurrencyFormatter.format(transaction.amount, transaction.currency)}</span></div>
          <div class="row"><span>Fee</span><span>${CurrencyFormatter.format(transaction.fee, transaction.currency)}</span></div>
          <div class="row"><span>Net Amount</span><span>${CurrencyFormatter.format(transaction.netAmount, transaction.currency)}</span></div>
        </div>
        <div class="footer">
          <p>Thank you for using D-ZO Pay</p>
          <p>support@dzo-pay.com | +234 800 123 4567</p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = ReceiptGenerator;
