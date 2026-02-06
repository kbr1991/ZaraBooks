import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '-';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '-';

  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getGSTReturnPeriod(date: Date = new Date()): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${month}${year}`;
}

export function getFiscalYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 3) {
    // April onwards - current year to next year
    return `${year}-${(year + 1) % 100}`;
  } else {
    // Jan-March - previous year to current year
    return `${year - 1}-${year % 100}`;
  }
}

export function getQuarter(date: Date = new Date()): string {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter}`;
}

export function getAssessmentYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 3) {
    return `${year + 1}-${(year + 2) % 100}`;
  } else {
    return `${year}-${(year + 1) % 100}`;
  }
}
