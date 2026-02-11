// Minimal Template - Simple monochrome design with lots of whitespace

import { DocumentData, TemplateFunction } from '../types';
import { getDocumentTitle, getDateLabel, getPartyLabel, formatCurrencyValue, formatDateValue } from '../index';

export const minimalTemplate: TemplateFunction = (data: DocumentData): string => {
  const title = getDocumentTitle(data.type);
  const dateLabels = getDateLabel(data.type);
  const partyLabel = getPartyLabel(data.type);
  const secondaryDate = data.dueDate || data.expiryDate || data.deliveryDate;

  const logoHtml = data.company.logoUrl
    ? `<img src="${data.company.logoUrl}" alt="${data.company.name}" style="max-height: 40px; max-width: 150px; object-fit: contain; opacity: 0.9;" />`
    : '';

  const hasItems = data.items && data.items.length > 0 && data.items.some(item => item.description);

  const linesHtml = hasItems
    ? data.items.filter(item => item.description).map(item => `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="font-weight: 500;">${item.description}</div>
          ${item.hsnSac ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">HSN/SAC: ${item.hsnSac}</div>` : ''}
        </td>
        <td style="padding: 16px 0; border-bottom: 1px solid #f3f4f6; text-align: center; color: #6b7280;">${item.quantity}</td>
        <td style="padding: 16px 0; border-bottom: 1px solid #f3f4f6; text-align: right; color: #6b7280;">${formatCurrencyValue(item.rate)}</td>
        <td style="padding: 16px 0; border-bottom: 1px solid #f3f4f6; text-align: center; color: #9ca3af;">${item.taxRate || 0}%</td>
        <td style="padding: 16px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 500;">${formatCurrencyValue(item.amount)}</td>
      </tr>
    `).join('')
    : '';

  // Helper to clean address parts (remove trailing commas, extra spaces)
  const cleanAddressPart = (part: string | null | undefined): string => {
    if (!part) return '';
    return part.replace(/,+\s*$/, '').replace(/\s+/g, ' ').trim();
  };

  const customerAddress = [
    data.customer.address,
    data.customer.city,
    data.customer.state,
    data.customer.pincode,
  ].map(cleanAddressPart).filter(Boolean).join(', ');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} ${data.documentNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 60px 50px;
          color: #374151;
          background: #fff;
          line-height: 1.6;
          font-size: 14px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 60px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .company-name {
          font-size: 18px;
          font-weight: 500;
          color: #111827;
        }
        .document-type {
          text-align: right;
        }
        .document-title {
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 3px;
        }
        .document-number {
          font-size: 24px;
          font-weight: 300;
          color: #111827;
          margin-top: 4px;
        }
        .meta-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 50px;
        }
        .address-block { }
        .address-label {
          font-size: 10px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }
        .address-name {
          font-weight: 500;
          color: #111827;
          margin-bottom: 4px;
        }
        .address-details {
          color: #6b7280;
          font-size: 13px;
        }
        .dates-block {
          text-align: right;
        }
        .date-row {
          margin-bottom: 8px;
        }
        .date-label {
          font-size: 11px;
          color: #9ca3af;
        }
        .date-value {
          font-weight: 500;
          color: #111827;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 40px;
        }
        th {
          padding: 12px 0;
          text-align: left;
          font-size: 10px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 2px solid #111827;
        }
        th:nth-child(2), th:nth-child(4) { text-align: center; }
        th:nth-child(3), th:nth-child(5) { text-align: right; }
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 60px;
        }
        .totals-box {
          width: 280px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 13px;
          color: #6b7280;
        }
        .totals-row.subtotal {
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 12px;
          margin-bottom: 8px;
        }
        .totals-row.total {
          font-size: 20px;
          font-weight: 500;
          color: #111827;
          padding-top: 16px;
          border-top: 2px solid #111827;
        }
        .notes-section {
          max-width: 500px;
          color: #6b7280;
          font-size: 13px;
        }
        .notes-label {
          font-size: 10px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }
        .footer {
          margin-top: 80px;
          padding-top: 20px;
          border-top: 1px solid #f3f4f6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #9ca3af;
          font-size: 11px;
        }
        .company-info {
          display: flex;
          gap: 20px;
        }
        .company-info span {
          display: flex;
          gap: 6px;
        }
        @page {
          size: A4;
          margin: 10mm 15mm;
        }
        @media print {
          body { padding: 30px; }
          button, .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          ${logoHtml}
          ${!logoHtml ? `<div class="company-name">${data.company.name}</div>` : ''}
        </div>
        <div class="document-type">
          <div class="document-title">${title}</div>
          <div class="document-number">${data.documentNumber}</div>
        </div>
      </div>

      <div class="meta-section">
        <div class="address-block">
          <div class="address-label">${partyLabel}</div>
          <div class="address-name">${data.customer.name}</div>
          ${customerAddress ? `<div class="address-details">${customerAddress}</div>` : ''}
          ${data.customer.gstin ? `<div class="address-details" style="margin-top: 4px;">GSTIN: ${data.customer.gstin}</div>` : ''}
        </div>
        <div class="dates-block">
          <div class="date-row">
            <div class="date-label">${dateLabels.primary}</div>
            <div class="date-value">${formatDateValue(data.documentDate)}</div>
          </div>
          ${secondaryDate ? `
          <div class="date-row">
            <div class="date-label">${dateLabels.secondary}</div>
            <div class="date-value">${formatDateValue(secondaryDate)}</div>
          </div>
          ` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Tax</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml || '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #d1d5db;">No items</td></tr>'}
        </tbody>
      </table>

      <div class="totals-section">
        <div class="totals-box">
          <div class="totals-row subtotal">
            <span>Subtotal</span>
            <span>${formatCurrencyValue(data.subtotal)}</span>
          </div>
          ${data.taxBreakdown.cgst > 0 ? `<div class="totals-row"><span>CGST</span><span>${formatCurrencyValue(data.taxBreakdown.cgst)}</span></div>` : ''}
          ${data.taxBreakdown.sgst > 0 ? `<div class="totals-row"><span>SGST</span><span>${formatCurrencyValue(data.taxBreakdown.sgst)}</span></div>` : ''}
          ${data.taxBreakdown.igst > 0 ? `<div class="totals-row"><span>IGST</span><span>${formatCurrencyValue(data.taxBreakdown.igst)}</span></div>` : ''}
          <div class="totals-row total">
            <span>Total</span>
            <span>${formatCurrencyValue(data.totalAmount)}</span>
          </div>
        </div>
      </div>

      ${data.notes && data.notes.trim() ? `
      <div class="notes-section">
        <div class="notes-label">Notes</div>
        <p>${data.notes}</p>
      </div>
      ` : ''}

      ${data.terms && data.terms.trim() ? `
      <div class="notes-section" style="margin-top: 20px;">
        <div class="notes-label">Terms</div>
        <p>${data.terms}</p>
      </div>
      ` : ''}

      <div class="footer">
        <div class="company-info">
          <span>${data.company.name}</span>
          ${data.company.gstin ? `<span>GSTIN: ${data.company.gstin}</span>` : ''}
        </div>
        <div>Thank you</div>
      </div>
    </body>
    </html>
  `;
};
