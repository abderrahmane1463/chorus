/**
 * Escapes one CSV field.
 *
 * A leading =, +, - or @ is prefixed with a quote: spreadsheet apps otherwise
 * treat such a value as a formula, which turns participant-supplied text into
 * something executable when the file is opened.
 */
function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (/["\n\r,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','));
  }
  // A BOM makes Excel read the file as UTF-8 rather than the system codepage.
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Turns an event title into a safe download filename. */
export function csvFilename(title: string, suffix: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'event';

  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${suffix}-${date}.csv`;
}
