import { TOP_LEVEL_DOMAINS } from './tlds.mjs';

const gmailTypos = new Set(['gmial.com', 'gamil.com', 'gmai.com', 'gmailcom']);
const domainLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function validateReceiverEmail(value) {
  const address = value.trim();
  if (!address) return 'Enter the receiver email address.';
  const parts = address.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return 'Enter a complete email address, such as name@example.com.';
  const domain = parts[1].toLowerCase();
  if (domain.startsWith('gmail.') && domain !== 'gmail.com' || gmailTypos.has(domain)) {
    return 'Check the Gmail address. Gmail receivers use @gmail.com.';
  }
  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2 || labels.some(label => !domainLabel.test(label))) {
    return 'Check the email domain after @, such as example.com.';
  }
  if (!TOP_LEVEL_DOMAINS.has(labels.at(-1).toUpperCase())) {
    return `The domain ending .${labels.at(-1)} is not recognised. Check the receiver email address.`;
  }
  return '';
}
