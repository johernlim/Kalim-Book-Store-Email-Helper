export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export function validateFiles(files) {
  if (!files?.length) return 'Choose at least one file.';
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) return 'Choose files totaling 20 MB or less.';
  return '';
}
function base64(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(binary);
}
const utf8 = text => new TextEncoder().encode(text);
const wrap = text => text.match(/.{1,76}/g)?.join('\r\n') || '';
function encodedHeader(text) {
  const chunks = [];
  let chunk = '';
  for (const character of text) {
    if (utf8(chunk + character).length > 42) { chunks.push(chunk); chunk = ''; }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map(value => `=?UTF-8?B?${base64(utf8(value))}?=`).join('\r\n ');
}
export async function buildMessage({ recipient, sender, subject, files }) {
  for (const address of [recipient, sender]) if (!/^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+$/.test(address)) throw new Error('Enter a valid email address.');
  if (!subject.trim() || /[\r\n]/.test(subject)) throw new Error('Enter a valid email title.');
  const fileError = validateFiles(files);
  if (fileError) throw new Error(fileError);
  const boundary = `kalim_${crypto.randomUUID()}`;
  const parts = [
    `To: ${recipient}`, `From: ${sender}`, `Subject: ${encodedHeader(subject)}`,
    'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    base64(utf8('Please find the scanned documents attached.')), '',
  ];
  // Read each file in order; every attachment gets its own MIME part.
  for (const file of files) {
    const type = /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type : 'application/octet-stream';
    const filename = file.name.replace(/[\r\n]/g, '_');
    const encodedName = encodeURIComponent(filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    const attachment = base64(new Uint8Array(await file.arrayBuffer()));
    parts.push(`--${boundary}`, `Content-Type: ${type}`, `Content-Disposition: attachment; filename*=UTF-8''${encodedName}`,
      'Content-Transfer-Encoding: base64', '', wrap(attachment), '');
  }
  const mime = [...parts, `--${boundary}--`, ''].join('\r\n');
  return base64(utf8(mime)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
