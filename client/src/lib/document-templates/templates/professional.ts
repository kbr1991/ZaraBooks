// Professional Template - Corporate gray & black for CA firms and corporates

import { DocumentData, TemplateFunction } from '../types';
import { getDocumentTitle, getDateLabel, formatCurrencyValue, formatDateValue } from '../index';

export const professionalTemplate: TemplateFunction = (data: DocumentData): string => {
  const title = getDocumentTitle(data.type);
  const dateLabels = getDateLabel(data.type);
  const secondaryDate = data.dueDate || data.expiryDate || data.deliveryDate;

  const logoHtml = data.company.logoUrl
    ? `<img src="${data.company.logoUrl}" alt="${data.company.name}" style="max-height: 55px; max-width: 180px; object-fit: contain;" />`
    : '';

  const hasItems = data.items && data.items.length > 0 && data.items.some(item => item.description);

  const linesHtml = hasItems
    ? data.items.filter(item => item.description).map(item => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-size: 12px;">${item.hsnSac || '-'}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrencyValue(item.rate)}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.taxRate || 0}%</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatCurrencyValue(item.amount)}</td>
      </tr>
    `).join('')
    : '';

  // Helper to clean address parts (remove trailing commas, extra spaces)
  const cleanAddressPart = (part: string | null | undefined): string => {
    if (!part) return '';
    return part.replace(/,+\s*$/, '').replace(/\s+/g, ' ').trim();
  };

  const companyAddress = [
    data.company.address,
    data.company.city,
    data.company.state,
    data.company.pincode,
  ].map(cleanAddressPart).filter(Boolean).join(', ');

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
          font-family: 'Helvetica Neue', Arial, sans-serif;
          padding: 40px;
          color: #374151;
          background: #fff;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
        }
        .company-block {
          border: 2px solid #111827;
          padding: 20px 25px;
          min-width: 300px;
        }
        .company-logo { margin-bottom: 12px; }
        .company-name {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .company-details {
          font-size: 11px;
          color: #6b7280;
          margin-top: 8px;
          line-height: 1.6;
        }
        .company-tax-info {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
        }
        .document-block {
          text-align: right;
        }
        .document-title {
          font-size: 36px;
          font-weight: 700;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 3px;
        }
        .document-meta {
          margin-top: 15px;
          font-size: 13px;
        }
        .document-meta-row {
          display: flex;
          justify-content: flex-end;
          gap: 15px;
          padding: 6px 0;
        }
        .meta-label {
          color: #6b7280;
          min-width: 100px;
          text-align: right;
        }
        .meta-value {
          font-weight: 600;
          color: #111827;
          min-width: 120px;
          text-align: left;
        }
        .divider {
          height: 1px;
          background: #111827;
          margin: 30px 0;
        }
        .billing-section {
          display: flex;
          gap: 60px;
          margin-bottom: 30px;
        }
        .billing-block {
          flex: 1;
        }
        .billing-block h3 {
          font-size: 10px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid #111827;
        }
        .billing-block p {
          font-size: 13px;
          line-height: 1.6;
        }
        .billing-block .name {
          font-weight: 600;
          color: #111827;
          font-size: 15px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 13px;
        }
        th {
          background: #111827;
          color: white;
          padding: 12px 10px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }
        th:nth-child(3), th:nth-child(4), th:nth-child(5), th:nth-child(6) {
          text-align: right;
        }
        th:nth-child(2), th:nth-child(3), th:nth-child(5) {
          text-align: center;
        }
        .totals-section {
          display: flex;
          justify-content: flex-end;
        }
        .totals-table {
          width: 320px;
          border: 2px solid #111827;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 15px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 13px;
        }
        .totals-row:last-child { border-bottom: none; }
        .totals-row.total {
          background: #111827;
          color: white;
          font-size: 16px;
          font-weight: 700;
          padding: 14px 15px;
        }
        .notes-block {
          margin-top: 40px;
          padding: 20px;
          background: #f9fafb;
          border-left: 3px solid #111827;
        }
        .notes-block h4 {
          font-size: 10px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 10px;
        }
        .notes-block p {
          font-size: 13px;
          color: #4b5563;
        }
        .footer {
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .signature-block {
          text-align: center;
          min-width: 200px;
        }
        .signature-line {
          border-top: 1px solid #111827;
          margin-top: 60px;
          padding-top: 8px;
          font-size: 11px;
          color: #6b7280;
        }
        .thank-you {
          font-size: 14px;
          color: #111827;
          font-weight: 500;
        }
        @page {
          size: A4;
          margin: 10mm 15mm;
        }
        @media print {
          body { padding: 20px; }
          button, .no-print { display: none !important; }
          th, .totals-row.total { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-block">
          ${logoHtml ? `<div class="company-logo">${logoHtml}</div>` : ''}
          <div class="company-name">${data.company.name}</div>
          ${companyAddress ? `<div class="company-details">${companyAddress}</div>` : ''}
          <div class="company-tax-info">
            ${data.company.gstin ? `GSTIN: ${data.company.gstin}` : ''}
            ${data.company.gstin && data.company.pan ? ' | ' : ''}
            ${data.company.pan ? `PAN: ${data.company.pan}` : ''}
          </div>
        </div>
        <div class="document-block">
          <div class="document-title">${title}</div>
          <div class="document-meta">
            <div class="document-meta-row">
              <span class="meta-label">${title.split(' ')[0]} No.</span>
              <span class="meta-value">${data.documentNumber}</span>
            </div>
            <div class="document-meta-row">
              <span class="meta-label">${dateLabels.primary}</span>
              <span class="meta-value">${formatDateValue(data.documentDate)}</span>
            </div>
            ${secondaryDate ? `
            <div class="document-meta-row">
              <span class="meta-label">${dateLabels.secondary}</span>
              <span class="meta-value">${formatDateValue(secondaryDate)}</span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="billing-section">
        <div class="billing-block">
          <h3>Bill To</h3>
          <p class="name">${data.customer.name}</p>
          ${customerAddress ? `<p>${customerAddress}</p>` : ''}
          ${data.customer.gstin ? `<p style="margin-top: 8px;">GSTIN: ${data.customer.gstin}</p>` : ''}
        </div>
        ${data.shippingAddress ? `
        <div class="billing-block">
          <h3>Ship To</h3>
          <p>${data.shippingAddress}</p>
        </div>
        ` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>HSN/SAC</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Tax</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml || '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #9ca3af;">No line items</td></tr>'}
        </tbody>
      </table>

      <div class="totals-section">
        <div class="totals-table">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${formatCurrencyValue(data.subtotal)}</span>
          </div>
          ${data.taxBreakdown.cgst > 0 ? `<div class="totals-row"><span>CGST</span><span>${formatCurrencyValue(data.taxBreakdown.cgst)}</span></div>` : ''}
          ${data.taxBreakdown.sgst > 0 ? `<div class="totals-row"><span>SGST</span><span>${formatCurrencyValue(data.taxBreakdown.sgst)}</span></div>` : ''}
          ${data.taxBreakdown.igst > 0 ? `<div class="totals-row"><span>IGST</span><span>${formatCurrencyValue(data.taxBreakdown.igst)}</span></div>` : ''}
          <div class="totals-row total">
            <span>Total Due</span>
            <span>${formatCurrencyValue(data.totalAmount)}</span>
          </div>
        </div>
      </div>

      ${data.notes && data.notes.trim() ? `
      <div class="notes-block">
        <h4>Notes</h4>
        <p>${data.notes}</p>
      </div>
      ` : ''}

      ${data.terms && data.terms.trim() ? `
      <div class="notes-block" style="margin-top: 15px;">
        <h4>Terms & Conditions</h4>
        <p>${data.terms}</p>
      </div>
      ` : ''}

      <div class="footer">
        <div class="thank-you">Thank you for your business.</div>
        <div class="signature-block">
          <div class="signature-line">Authorized Signatory</div>
        </div>
      </div>
    </body>
    </html>
  `;
};
