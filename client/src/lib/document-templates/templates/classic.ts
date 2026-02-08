// Classic Template - Traditional navy & gold design

import { DocumentData, TemplateFunction } from '../types';
import { getDocumentTitle, getDateLabel, formatCurrencyValue, formatDateValue } from '../index';

export const classicTemplate: TemplateFunction = (data: DocumentData): string => {
  const title = getDocumentTitle(data.type);
  const dateLabels = getDateLabel(data.type);
  const secondaryDate = data.dueDate || data.expiryDate || data.deliveryDate;

  const logoHtml = data.company.logoUrl
    ? `<img src="${data.company.logoUrl}" alt="${data.company.name}" style="max-height: 60px; max-width: 200px; object-fit: contain;" />`
    : '';

  const linesHtml = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description || ''}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.hsnSac || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrencyValue(item.rate)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.taxRate || 0}%</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrencyValue(item.amount)}</td>
    </tr>
  `).join('');

  const companyAddress = [
    data.company.address,
    data.company.city,
    data.company.state,
    data.company.pincode,
  ].filter(Boolean).join(', ');

  const customerAddress = [
    data.customer.address,
    data.customer.city,
    data.customer.state,
    data.customer.pincode,
  ].filter(Boolean).join(', ');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} ${data.documentNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Georgia', 'Times New Roman', serif;
          padding: 40px;
          color: #1e3a5f;
          background: #fff;
          line-height: 1.6;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #1e3a5f;
        }
        .company-section { }
        .company-logo { margin-bottom: 10px; }
        .company-name {
          font-size: 26px;
          font-weight: bold;
          color: #1e3a5f;
          letter-spacing: 1px;
        }
        .company-details {
          font-size: 12px;
          color: #4b5563;
          margin-top: 8px;
        }
        .document-info {
          text-align: right;
        }
        .document-title {
          font-size: 32px;
          font-weight: bold;
          color: #1e3a5f;
          letter-spacing: 2px;
        }
        .document-number {
          font-size: 18px;
          color: #b8860b;
          font-weight: bold;
          margin-top: 8px;
        }
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          gap: 40px;
        }
        .bill-to {
          flex: 1;
          background: #f8f9fa;
          padding: 20px;
          border-left: 4px solid #b8860b;
        }
        .bill-to h3 {
          color: #1e3a5f;
          font-size: 11px;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .bill-to p { font-size: 14px; line-height: 1.6; }
        .dates-section {
          text-align: right;
          min-width: 200px;
        }
        .dates-section p {
          font-size: 14px;
          line-height: 2;
        }
        .dates-section strong {
          color: #1e3a5f;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 14px;
        }
        th {
          background: #1e3a5f;
          color: white;
          padding: 14px 12px;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        th:nth-child(3), th:nth-child(4), th:nth-child(5), th:nth-child(6) {
          text-align: right;
        }
        th:nth-child(2), th:nth-child(3), th:nth-child(5) {
          text-align: center;
        }
        .totals {
          display: flex;
          justify-content: flex-end;
        }
        .totals-table {
          width: 320px;
          background: #f8f9fa;
          padding: 15px;
        }
        .totals-table td { padding: 8px 0; font-size: 14px; }
        .totals-table td:last-child { text-align: right; font-weight: 500; }
        .total-row {
          border-top: 2px solid #1e3a5f;
          font-size: 18px;
          font-weight: bold;
          color: #1e3a5f;
        }
        .total-row td { padding-top: 12px; }
        .notes {
          margin-top: 40px;
          padding: 20px;
          background: #fef9e7;
          border-left: 4px solid #b8860b;
        }
        .notes h4 {
          color: #1e3a5f;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }
        .footer {
          margin-top: 60px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
        .footer .thank-you {
          color: #1e3a5f;
          font-size: 16px;
          font-style: italic;
          margin-bottom: 10px;
        }
        @media print {
          body { padding: 20px; }
          button, .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-section">
          ${logoHtml ? `<div class="company-logo">${logoHtml}</div>` : ''}
          <div class="company-name">${data.company.name}</div>
          <div class="company-details">
            ${companyAddress ? `<div>${companyAddress}</div>` : ''}
            ${data.company.gstin ? `<div>GSTIN: ${data.company.gstin}</div>` : ''}
            ${data.company.pan ? `<div>PAN: ${data.company.pan}</div>` : ''}
          </div>
        </div>
        <div class="document-info">
          <div class="document-title">${title}</div>
          <div class="document-number"># ${data.documentNumber}</div>
        </div>
      </div>

      <div class="info-section">
        <div class="bill-to">
          <h3>Bill To</h3>
          <p><strong>${data.customer.name}</strong></p>
          ${customerAddress ? `<p>${customerAddress}</p>` : ''}
          ${data.customer.gstin ? `<p>GSTIN: ${data.customer.gstin}</p>` : ''}
          ${data.customer.email ? `<p>${data.customer.email}</p>` : ''}
        </div>
        <div class="dates-section">
          <p><strong>${dateLabels.primary}:</strong> ${formatDateValue(data.documentDate)}</p>
          ${secondaryDate ? `<p><strong>${dateLabels.secondary}:</strong> ${formatDateValue(secondaryDate)}</p>` : ''}
          ${data.status ? `<p><strong>Status:</strong> ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</p>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>HSN/SAC</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>GST</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml || '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #999;">No line items</td></tr>'}
        </tbody>
      </table>

      <div class="totals">
        <table class="totals-table">
          <tr>
            <td>Subtotal</td>
            <td>${formatCurrencyValue(data.subtotal)}</td>
          </tr>
          ${data.taxBreakdown.cgst > 0 ? `<tr><td>CGST</td><td>${formatCurrencyValue(data.taxBreakdown.cgst)}</td></tr>` : ''}
          ${data.taxBreakdown.sgst > 0 ? `<tr><td>SGST</td><td>${formatCurrencyValue(data.taxBreakdown.sgst)}</td></tr>` : ''}
          ${data.taxBreakdown.igst > 0 ? `<tr><td>IGST</td><td>${formatCurrencyValue(data.taxBreakdown.igst)}</td></tr>` : ''}
          <tr class="total-row">
            <td>Total</td>
            <td>${formatCurrencyValue(data.totalAmount)}</td>
          </tr>
        </table>
      </div>

      ${data.notes ? `
      <div class="notes">
        <h4>Notes</h4>
        <p>${data.notes}</p>
      </div>
      ` : ''}

      ${data.terms ? `
      <div class="notes" style="background: #f0f9ff; border-color: #1e3a5f;">
        <h4>Terms & Conditions</h4>
        <p>${data.terms}</p>
      </div>
      ` : ''}

      <div class="footer">
        <p class="thank-you">Thank you for your business!</p>
        <p>Generated by ${data.company.name}</p>
      </div>
    </body>
    </html>
  `;
};
