// Classic Template - Traditional navy & gold design

import { DocumentData, TemplateFunction } from '../types';
import { getDocumentTitle, getDateLabel, getPartyLabel, formatCurrencyValue, formatDateValue } from '../index';

export const classicTemplate: TemplateFunction = (data: DocumentData): string => {
  const title = getDocumentTitle(data.type);
  const dateLabels = getDateLabel(data.type);
  const partyLabel = getPartyLabel(data.type);
  const secondaryDate = data.dueDate || data.expiryDate || data.deliveryDate;

  const logoHtml = data.company.logoUrl
    ? `<img src="${data.company.logoUrl}" alt="${data.company.name}" class="company-logo" />`
    : '';

  // Build line items HTML with proper handling of empty items
  const hasItems = data.items && data.items.length > 0 && data.items.some(item => item.description);

  const linesHtml = hasItems
    ? data.items.filter(item => item.description).map((item, index) => `
      <tr>
        <td class="line-num">${index + 1}</td>
        <td class="line-desc">${item.description}</td>
        <td class="line-hsn">${item.hsnSac || '-'}</td>
        <td class="line-qty">${item.quantity}</td>
        <td class="line-rate">${formatCurrencyValue(item.rate)}</td>
        <td class="line-gst">${item.taxRate || 0}%</td>
        <td class="line-amount">${formatCurrencyValue(item.amount)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="7" class="no-items">No line items</td></tr>`;

  // Helper to clean address parts (remove trailing commas, extra spaces)
  const cleanAddressPart = (part: string | null | undefined): string => {
    if (!part) return '';
    return part.replace(/,+\s*$/, '').replace(/\s+/g, ' ').trim();
  };

  // Build company address
  const companyAddressParts = [
    data.company.address,
    data.company.city,
    data.company.state,
    data.company.pincode,
  ].map(cleanAddressPart).filter(Boolean);
  const companyAddress = companyAddressParts.length > 0 ? companyAddressParts.join(', ') : '';

  // Build customer address
  const customerAddressParts = [
    data.customer.address,
    data.customer.city,
    data.customer.state,
    data.customer.pincode,
  ].map(cleanAddressPart).filter(Boolean);
  const customerAddress = customerAddressParts.length > 0 ? customerAddressParts.join(', ') : '';

  // Calculate total tax
  const totalTax = (data.taxBreakdown.cgst || 0) + (data.taxBreakdown.sgst || 0) + (data.taxBreakdown.igst || 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} ${data.documentNumber}</title>
      <meta charset="UTF-8">
      <style>
        @page {
          size: A4;
          margin: 10mm 15mm;
        }

        /* Suppress browser headers/footers in print */
        @page {
          @top-left { content: none; }
          @top-center { content: none; }
          @top-right { content: none; }
          @bottom-left { content: none; }
          @bottom-center { content: none; }
          @bottom-right { content: none; }
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
          font-size: 12px;
          color: #1a1a2e;
          background: #fff;
          line-height: 1.5;
          padding: 20px;
        }

        .document-container {
          max-width: 800px;
          margin: 0 auto;
        }

        /* Header Section */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 3px solid #1e3a5f;
        }

        .company-section {
          flex: 1;
        }

        .company-logo {
          max-height: 60px;
          max-width: 180px;
          object-fit: contain;
          margin-bottom: 10px;
        }

        .company-name {
          font-size: 22px;
          font-weight: 700;
          color: #1e3a5f;
          margin-bottom: 6px;
        }

        .company-details {
          font-size: 11px;
          color: #4b5563;
          line-height: 1.6;
        }

        .company-details div {
          margin-bottom: 2px;
        }

        .document-info {
          text-align: right;
          flex-shrink: 0;
        }

        .document-title {
          font-size: 28px;
          font-weight: 700;
          color: #1e3a5f;
          letter-spacing: 1px;
        }

        .document-number {
          font-size: 16px;
          color: #b8860b;
          font-weight: 600;
          margin-top: 6px;
          font-family: inherit;
          letter-spacing: 0.5px;
        }

        /* Info Section */
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 25px;
          gap: 30px;
        }

        .bill-to {
          flex: 1;
          background: #f8fafc;
          padding: 15px 18px;
          border-left: 4px solid #b8860b;
          border-radius: 0 4px 4px 0;
        }

        .bill-to h3 {
          color: #1e3a5f;
          font-size: 10px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 600;
        }

        .bill-to .customer-name {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 4px;
        }

        .bill-to .customer-details {
          font-size: 11px;
          color: #4b5563;
          line-height: 1.6;
        }

        .dates-section {
          text-align: right;
          min-width: 180px;
        }

        .date-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .date-label {
          color: #6b7280;
          margin-right: 15px;
        }

        .date-value {
          color: #1a1a2e;
          font-weight: 500;
        }

        /* Status badge - only shown for overdue invoices */
        .status-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 5px;
        }

        .status-overdue { background: #fee2e2; color: #dc2626; }

        /* Table Section */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }

        .items-table thead {
          background: #1e3a5f;
        }

        .items-table th {
          color: white;
          padding: 12px 10px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .items-table th.text-center { text-align: center; }
        .items-table th.text-right { text-align: right; }

        .items-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 11px;
          vertical-align: top;
        }

        .items-table tr:hover {
          background: #fafafa;
        }

        .line-num {
          width: 40px;
          text-align: center;
          color: #9ca3af;
        }

        .line-desc {
          min-width: 200px;
        }

        .line-hsn {
          width: 80px;
          text-align: center;
          font-family: 'Consolas', monospace;
          font-size: 10px;
        }

        .line-qty {
          width: 60px;
          text-align: center;
        }

        .line-rate {
          width: 100px;
          text-align: right;
        }

        .line-gst {
          width: 60px;
          text-align: center;
        }

        .line-amount {
          width: 100px;
          text-align: right;
          font-weight: 500;
        }

        .no-items {
          text-align: center;
          padding: 40px;
          color: #9ca3af;
          font-style: italic;
        }

        /* Totals Section */
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 25px;
        }

        .totals-box {
          width: 280px;
          background: #f8fafc;
          border-radius: 6px;
          overflow: hidden;
        }

        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 15px;
          font-size: 12px;
        }

        .totals-row.subtotal {
          border-bottom: 1px solid #e5e7eb;
        }

        .totals-row.tax {
          font-size: 11px;
          color: #6b7280;
          padding: 6px 15px;
        }

        .totals-row.total {
          background: #1e3a5f;
          color: white;
          font-size: 14px;
          font-weight: 600;
          padding: 12px 15px;
        }

        .totals-label {
          color: inherit;
        }

        .totals-value {
          font-weight: 500;
        }

        /* Notes Section */
        .notes-section {
          margin-top: 25px;
          padding: 15px 18px;
          background: #fffbeb;
          border-left: 4px solid #b8860b;
          border-radius: 0 4px 4px 0;
        }

        .notes-section h4 {
          color: #1e3a5f;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .notes-section p {
          font-size: 11px;
          color: #4b5563;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .terms-section {
          margin-top: 15px;
          padding: 15px 18px;
          background: #f0f9ff;
          border-left: 4px solid #1e3a5f;
          border-radius: 0 4px 4px 0;
        }

        /* Footer */
        .footer {
          margin-top: 40px;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }

        .thank-you {
          color: #1e3a5f;
          font-size: 14px;
          font-weight: 500;
        }

        /* Print Styles */
        @media print {
          body {
            padding: 0;
            font-size: 11px;
          }

          .document-container {
            max-width: 100%;
          }

          .header {
            border-bottom-width: 2px;
          }

          .items-table tr:hover {
            background: transparent;
          }

          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="document-container">
        <div class="header">
          <div class="company-section">
            ${logoHtml}
            <div class="company-name">${data.company.name}</div>
            <div class="company-details">
              ${companyAddress ? `<div>${companyAddress}</div>` : ''}
              ${data.company.gstin ? `<div>GSTIN: ${data.company.gstin}</div>` : ''}
              ${data.company.pan ? `<div>PAN: ${data.company.pan}</div>` : ''}
              ${data.company.email ? `<div>${data.company.email}</div>` : ''}
              ${data.company.phone ? `<div>${data.company.phone}</div>` : ''}
            </div>
          </div>
          <div class="document-info">
            <div class="document-title">${title}</div>
            <div class="document-number"># ${data.documentNumber}</div>
          </div>
        </div>

        <div class="info-section">
          <div class="bill-to">
            <h3>${partyLabel}</h3>
            <div class="customer-name">${data.customer.name}</div>
            <div class="customer-details">
              ${customerAddress ? `<div>${customerAddress}</div>` : ''}
              ${data.customer.gstin ? `<div>GSTIN: ${data.customer.gstin}</div>` : ''}
              ${data.customer.email ? `<div>${data.customer.email}</div>` : ''}
              ${data.customer.phone ? `<div>${data.customer.phone}</div>` : ''}
            </div>
          </div>
          <div class="dates-section">
            <div class="date-row">
              <span class="date-label">${dateLabels.primary}:</span>
              <span class="date-value">${formatDateValue(data.documentDate)}</span>
            </div>
            ${secondaryDate ? `
            <div class="date-row">
              <span class="date-label">${dateLabels.secondary}:</span>
              <span class="date-value">${formatDateValue(secondaryDate)}</span>
            </div>
            ` : ''}
            ${data.status === 'overdue' ? `
            <div class="status-badge status-overdue">OVERDUE</div>
            ` : ''}
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="text-center">#</th>
              <th>Description</th>
              <th class="text-center">HSN/SAC</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Rate</th>
              <th class="text-center">GST</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="totals-row subtotal">
              <span class="totals-label">Subtotal</span>
              <span class="totals-value">${formatCurrencyValue(data.subtotal)}</span>
            </div>
            ${data.taxBreakdown.cgst > 0 ? `
            <div class="totals-row tax">
              <span class="totals-label">CGST</span>
              <span class="totals-value">${formatCurrencyValue(data.taxBreakdown.cgst)}</span>
            </div>
            ` : ''}
            ${data.taxBreakdown.sgst > 0 ? `
            <div class="totals-row tax">
              <span class="totals-label">SGST</span>
              <span class="totals-value">${formatCurrencyValue(data.taxBreakdown.sgst)}</span>
            </div>
            ` : ''}
            ${data.taxBreakdown.igst > 0 ? `
            <div class="totals-row tax">
              <span class="totals-label">IGST</span>
              <span class="totals-value">${formatCurrencyValue(data.taxBreakdown.igst)}</span>
            </div>
            ` : ''}
            ${totalTax > 0 && (data.taxBreakdown.cgst > 0 || data.taxBreakdown.sgst > 0 || data.taxBreakdown.igst > 0) ? '' : totalTax > 0 ? `
            <div class="totals-row tax">
              <span class="totals-label">Tax</span>
              <span class="totals-value">${formatCurrencyValue(totalTax)}</span>
            </div>
            ` : ''}
            <div class="totals-row total">
              <span class="totals-label">Total</span>
              <span class="totals-value">${formatCurrencyValue(data.totalAmount)}</span>
            </div>
          </div>
        </div>

        ${data.notes && data.notes.trim() ? `
        <div class="notes-section">
          <h4>Notes</h4>
          <p>${data.notes}</p>
        </div>
        ` : ''}

        ${data.terms && data.terms.trim() ? `
        <div class="terms-section">
          <h4>Terms & Conditions</h4>
          <p>${data.terms}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p class="thank-you">Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
