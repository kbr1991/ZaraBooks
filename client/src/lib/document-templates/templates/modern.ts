// Modern Template - Clean blue & teal gradient for tech and startups

import { DocumentData, TemplateFunction } from '../types';
import { getDocumentTitle, getDateLabel, formatCurrencyValue, formatDateValue } from '../index';

export const modernTemplate: TemplateFunction = (data: DocumentData): string => {
  const title = getDocumentTitle(data.type);
  const dateLabels = getDateLabel(data.type);
  const secondaryDate = data.dueDate || data.expiryDate || data.deliveryDate;

  const logoHtml = data.company.logoUrl
    ? `<img src="${data.company.logoUrl}" alt="${data.company.name}" style="max-height: 50px; max-width: 180px; object-fit: contain;" />`
    : '';

  const linesHtml = data.items.map((item, index) => `
    <tr style="background: ${index % 2 === 0 ? '#f0f9ff' : 'white'};">
      <td style="padding: 14px 16px; border-bottom: 1px solid #e0f2fe;">${item.description || ''}</td>
      <td style="padding: 14px 16px; border-bottom: 1px solid #e0f2fe; text-align: center; color: #64748b;">${item.hsnSac || '-'}</td>
      <td style="padding: 14px 16px; border-bottom: 1px solid #e0f2fe; text-align: center;">${item.quantity}</td>
      <td style="padding: 14px 16px; border-bottom: 1px solid #e0f2fe; text-align: right;">${formatCurrencyValue(item.rate)}</td>
      <td style="padding: 14px 16px; border-bottom: 1px solid #e0f2fe; text-align: center;">${item.taxRate || 0}%</td>
      <td style="padding: 14px 16px; border-bottom: 1px solid #e0f2fe; text-align: right; font-weight: 600;">${formatCurrencyValue(item.amount)}</td>
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
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          padding: 0;
          color: #334155;
          background: #fff;
          line-height: 1.5;
        }
        .header-bar {
          background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%);
          padding: 30px 40px;
          color: white;
        }
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .company-section {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .company-logo {
          background: white;
          padding: 10px;
          border-radius: 8px;
        }
        .company-name {
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .document-info {
          text-align: right;
        }
        .document-title {
          font-size: 28px;
          font-weight: 300;
          letter-spacing: 4px;
          opacity: 0.9;
        }
        .document-number {
          font-size: 16px;
          margin-top: 8px;
          font-weight: 500;
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 20px;
          display: inline-block;
        }
        .main-content {
          padding: 40px;
        }
        .info-cards {
          display: flex;
          gap: 30px;
          margin-bottom: 40px;
        }
        .info-card {
          flex: 1;
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid #e2e8f0;
        }
        .info-card h3 {
          color: #0ea5e9;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .info-card p {
          font-size: 14px;
          margin-bottom: 4px;
        }
        .info-card .primary {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }
        .dates-grid {
          display: grid;
          gap: 12px;
        }
        .date-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .date-item:last-child { border-bottom: none; }
        .date-label {
          color: #64748b;
          font-size: 13px;
        }
        .date-value {
          font-weight: 600;
          color: #1e293b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 14px;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th {
          background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%);
          color: white;
          padding: 16px;
          text-align: left;
          font-size: 11px;
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
        .totals {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        .totals-card {
          width: 340px;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 12px;
          padding: 20px 24px;
          border: 1px solid #bae6fd;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          font-size: 14px;
        }
        .totals-row.total {
          border-top: 2px solid #0ea5e9;
          margin-top: 10px;
          padding-top: 15px;
          font-size: 20px;
          font-weight: 700;
          color: #0369a1;
        }
        .notes-section {
          background: #f8fafc;
          border-radius: 12px;
          padding: 24px;
          margin-top: 30px;
          border: 1px solid #e2e8f0;
        }
        .notes-section h4 {
          color: #0ea5e9;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 12px;
        }
        .notes-section p {
          font-size: 14px;
          color: #475569;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
        }
        .footer .company-ref {
          font-size: 14px;
          color: #0ea5e9;
          font-weight: 500;
        }
        @media print {
          body { padding: 0; }
          button, .no-print { display: none !important; }
          .header-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header-bar">
        <div class="header-content">
          <div class="company-section">
            ${logoHtml ? `<div class="company-logo">${logoHtml}</div>` : ''}
            <div class="company-name">${data.company.name}</div>
          </div>
          <div class="document-info">
            <div class="document-title">${title}</div>
            <div class="document-number">${data.documentNumber}</div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div class="info-cards">
          <div class="info-card">
            <h3>From</h3>
            <p class="primary">${data.company.name}</p>
            ${companyAddress ? `<p>${companyAddress}</p>` : ''}
            ${data.company.gstin ? `<p style="margin-top: 8px;"><strong>GSTIN:</strong> ${data.company.gstin}</p>` : ''}
          </div>
          <div class="info-card">
            <h3>Bill To</h3>
            <p class="primary">${data.customer.name}</p>
            ${customerAddress ? `<p>${customerAddress}</p>` : ''}
            ${data.customer.gstin ? `<p style="margin-top: 8px;"><strong>GSTIN:</strong> ${data.customer.gstin}</p>` : ''}
          </div>
          <div class="info-card">
            <h3>Details</h3>
            <div class="dates-grid">
              <div class="date-item">
                <span class="date-label">${dateLabels.primary}</span>
                <span class="date-value">${formatDateValue(data.documentDate)}</span>
              </div>
              ${secondaryDate ? `
              <div class="date-item">
                <span class="date-label">${dateLabels.secondary}</span>
                <span class="date-value">${formatDateValue(secondaryDate)}</span>
              </div>
              ` : ''}
              ${data.status ? `
              <div class="date-item">
                <span class="date-label">Status</span>
                <span class="date-value">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span>
              </div>
              ` : ''}
            </div>
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
            ${linesHtml || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">No line items</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-card">
            <div class="totals-row">
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

        ${data.notes ? `
        <div class="notes-section">
          <h4>Notes</h4>
          <p>${data.notes}</p>
        </div>
        ` : ''}

        ${data.terms ? `
        <div class="notes-section" style="margin-top: 20px;">
          <h4>Terms & Conditions</h4>
          <p>${data.terms}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p class="company-ref">Thank you for choosing ${data.company.name}!</p>
          <p style="margin-top: 8px;">Questions? Contact us anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
