import ExcelJS from 'exceljs';
import { Company, FiscalYear } from '@shared/schema';

interface StatementLine {
  code: string;
  name: string;
  amount: number;
  previousAmount?: number;
  indentLevel: number;
  isBold: boolean;
  isTotal: boolean;
  hasSubSchedule: boolean;
}

export async function generateBalanceSheetExcel(
  company: Company,
  fiscalYear: FiscalYear,
  data: { statement: StatementLine[]; netProfit: number }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zara Books';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Balance Sheet', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  // Set column widths
  sheet.columns = [
    { key: 'particulars', width: 50 },
    { key: 'amount', width: 18 },
    { key: 'previous', width: 18 },
  ];

  // Company Header
  sheet.mergeCells('A1:C1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = company.name || 'Company Name';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  // Legal name / CIN
  if (company.cin || company.legalName) {
    sheet.mergeCells('A2:C2');
    const subTitle = sheet.getCell('A2');
    subTitle.value = company.legalName || company.cin || '';
    subTitle.font = { size: 10 };
    subTitle.alignment = { horizontal: 'center' };
  }

  // Balance Sheet title
  sheet.mergeCells('A3:C3');
  const bsTitle = sheet.getCell('A3');
  bsTitle.value = `Balance Sheet as at ${fiscalYear.endDate}`;
  bsTitle.font = { bold: true, size: 12 };
  bsTitle.alignment = { horizontal: 'center' };

  // Schedule III note
  sheet.mergeCells('A4:C4');
  const note = sheet.getCell('A4');
  note.value = '(As per Schedule III of Companies Act, 2013)';
  note.font = { italic: true, size: 10 };
  note.alignment = { horizontal: 'center' };

  // Amount in Rupees note
  sheet.mergeCells('A5:C5');
  const amountNote = sheet.getCell('A5');
  amountNote.value = '(Amount in ₹)';
  amountNote.font = { italic: true, size: 9 };
  amountNote.alignment = { horizontal: 'right' };

  // Header row
  const headerRow = sheet.getRow(7);
  headerRow.values = ['Particulars', 'Current Year', 'Previous Year'];
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  headerRow.getCell(2).alignment = { horizontal: 'right' };
  headerRow.getCell(3).alignment = { horizontal: 'right' };

  // Data rows
  let rowIndex = 8;
  for (const line of data.statement) {
    const row = sheet.getRow(rowIndex);

    // Indent based on level
    const indent = '    '.repeat(line.indentLevel);
    row.getCell(1).value = indent + line.name;
    row.getCell(2).value = line.amount !== 0 ? line.amount : '-';
    row.getCell(3).value = line.previousAmount !== undefined && line.previousAmount !== 0
      ? line.previousAmount
      : '-';

    // Formatting
    if (line.isBold || line.isTotal) {
      row.font = { bold: true };
    }

    if (line.isTotal) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'double' },
        };
      });
    }

    // Number formatting
    row.getCell(2).numFmt = '#,##0.00;(#,##0.00);"-"';
    row.getCell(3).numFmt = '#,##0.00;(#,##0.00);"-"';
    row.getCell(2).alignment = { horizontal: 'right' };
    row.getCell(3).alignment = { horizontal: 'right' };

    rowIndex++;
  }

  // Add Net Profit row
  const profitRow = sheet.getRow(rowIndex + 1);
  profitRow.getCell(1).value = 'Net Profit/(Loss) for the period';
  profitRow.getCell(2).value = data.netProfit;
  profitRow.getCell(2).numFmt = '#,##0.00;(#,##0.00);"-"';
  profitRow.font = { italic: true };

  // Footer
  const footerRow = sheet.getRow(rowIndex + 4);
  footerRow.getCell(1).value = 'For ' + (company.name || 'Company Name');
  footerRow.font = { bold: true };

  const signatureRow = sheet.getRow(rowIndex + 7);
  signatureRow.getCell(1).value = 'Authorized Signatory';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generatePLExcel(
  company: Company,
  fiscalYear: FiscalYear,
  data: { statement: StatementLine[]; fromDate: string; toDate: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zara Books';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Profit & Loss', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  sheet.columns = [
    { key: 'particulars', width: 50 },
    { key: 'amount', width: 18 },
    { key: 'previous', width: 18 },
  ];

  // Company Header
  sheet.mergeCells('A1:C1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = company.name || 'Company Name';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  if (company.cin || company.legalName) {
    sheet.mergeCells('A2:C2');
    const subTitle = sheet.getCell('A2');
    subTitle.value = company.legalName || company.cin || '';
    subTitle.font = { size: 10 };
    subTitle.alignment = { horizontal: 'center' };
  }

  // P&L title
  sheet.mergeCells('A3:C3');
  const plTitle = sheet.getCell('A3');
  plTitle.value = `Statement of Profit and Loss for the period ${data.fromDate} to ${data.toDate}`;
  plTitle.font = { bold: true, size: 12 };
  plTitle.alignment = { horizontal: 'center' };

  sheet.mergeCells('A4:C4');
  const note = sheet.getCell('A4');
  note.value = '(As per Schedule III of Companies Act, 2013)';
  note.font = { italic: true, size: 10 };
  note.alignment = { horizontal: 'center' };

  sheet.mergeCells('A5:C5');
  const amountNote = sheet.getCell('A5');
  amountNote.value = '(Amount in ₹)';
  amountNote.font = { italic: true, size: 9 };
  amountNote.alignment = { horizontal: 'right' };

  // Header row
  const headerRow = sheet.getRow(7);
  headerRow.values = ['Particulars', 'Current Period', 'Previous Period'];
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  headerRow.getCell(2).alignment = { horizontal: 'right' };
  headerRow.getCell(3).alignment = { horizontal: 'right' };

  // Data rows
  let rowIndex = 8;
  for (const line of data.statement) {
    const row = sheet.getRow(rowIndex);

    const indent = '    '.repeat(line.indentLevel);
    row.getCell(1).value = indent + line.name;
    row.getCell(2).value = line.amount !== 0 ? line.amount : '-';
    row.getCell(3).value = line.previousAmount !== undefined && line.previousAmount !== 0
      ? line.previousAmount
      : '-';

    if (line.isBold || line.isTotal) {
      row.font = { bold: true };
    }

    if (line.isTotal) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'double' },
        };
      });
    }

    if (line.code === 'PL_PAT') {
      row.font = { bold: true, size: 12 };
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF0CC' },
        };
      });
    }

    row.getCell(2).numFmt = '#,##0.00;(#,##0.00);"-"';
    row.getCell(3).numFmt = '#,##0.00;(#,##0.00);"-"';
    row.getCell(2).alignment = { horizontal: 'right' };
    row.getCell(3).alignment = { horizontal: 'right' };

    rowIndex++;
  }

  // Footer
  const footerRow = sheet.getRow(rowIndex + 3);
  footerRow.getCell(1).value = 'For ' + (company.name || 'Company Name');
  footerRow.font = { bold: true };

  const signatureRow = sheet.getRow(rowIndex + 6);
  signatureRow.getCell(1).value = 'Authorized Signatory';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateTrialBalanceExcel(
  company: Company,
  fiscalYear: FiscalYear,
  data: {
    asOfDate: string;
    items: Array<{
      accountCode: string;
      accountName: string;
      openingDebit: number;
      openingCredit: number;
      periodDebit: number;
      periodCredit: number;
      closingDebit: number;
      closingCredit: number;
    }>;
    totals: {
      openingDebit: number;
      openingCredit: number;
      periodDebit: number;
      periodCredit: number;
      closingDebit: number;
      closingCredit: number;
    };
  }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zara Books';

  const sheet = workbook.addWorksheet('Trial Balance', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
    },
  });

  sheet.columns = [
    { key: 'code', width: 12 },
    { key: 'name', width: 40 },
    { key: 'openingDr', width: 15 },
    { key: 'openingCr', width: 15 },
    { key: 'periodDr', width: 15 },
    { key: 'periodCr', width: 15 },
    { key: 'closingDr', width: 15 },
    { key: 'closingCr', width: 15 },
  ];

  // Header
  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = company.name || 'Company Name';
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = `Trial Balance as at ${data.asOfDate}`;
  sheet.getCell('A2').font = { bold: true, size: 12 };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  // Column headers
  const headerRow = sheet.getRow(4);
  headerRow.values = [
    'Code',
    'Account Name',
    'Opening Dr',
    'Opening Cr',
    'Period Dr',
    'Period Cr',
    'Closing Dr',
    'Closing Cr',
  ];
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { horizontal: 'center' };
  });

  // Data rows
  let rowIndex = 5;
  for (const item of data.items) {
    const row = sheet.getRow(rowIndex);
    row.values = [
      item.accountCode,
      item.accountName,
      item.openingDebit || '-',
      item.openingCredit || '-',
      item.periodDebit || '-',
      item.periodCredit || '-',
      item.closingDebit || '-',
      item.closingCredit || '-',
    ];

    for (let i = 3; i <= 8; i++) {
      row.getCell(i).numFmt = '#,##0.00;(#,##0.00);"-"';
      row.getCell(i).alignment = { horizontal: 'right' };
    }

    rowIndex++;
  }

  // Totals row
  const totalsRow = sheet.getRow(rowIndex);
  totalsRow.values = [
    '',
    'TOTAL',
    data.totals.openingDebit,
    data.totals.openingCredit,
    data.totals.periodDebit,
    data.totals.periodCredit,
    data.totals.closingDebit,
    data.totals.closingCredit,
  ];
  totalsRow.font = { bold: true };
  totalsRow.eachCell((cell, colNumber) => {
    if (colNumber >= 3) {
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
    }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
