import { Request, Response, NextFunction } from 'express';

/**
 * Simple HTML sanitization to prevent XSS attacks
 * Removes script tags, event handlers, and other dangerous HTML
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  return input
    // Remove script tags and their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers (onclick, onerror, onload, etc.)
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs that could contain scripts
    .replace(/data:\s*text\/html/gi, '')
    // Encode common XSS characters
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Recursively sanitize an object's string values
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Skip base64 data URLs (images, etc.) - they're safe binary data
    if (obj.startsWith('data:image/')) {
      return obj;
    }
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      // Skip password fields from sanitization (they should be hashed, not displayed)
      // Skip logoUrl and similar fields that contain base64 image data
      if (key.toLowerCase().includes('password') || key.toLowerCase() === 'logourl') {
        sanitized[key] = obj[key];
      } else {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Express middleware to sanitize request body, query, and params
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
}

export { sanitizeString, sanitizeObject };
