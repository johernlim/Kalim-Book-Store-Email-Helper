export const MAX_FILE_BYTES = 20 * 1024 * 1024;
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
export async function buildMessage({ recipient, sender, subject, file }) {
  for (const address of [recipient, sender]) if (!/^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+$/.test(address)) throw new Error('Enter a valid email address.');
  if (!subject.trim() || /[\r\n]/.test(subject)) throw new Error('Enter a valid email title.');
  if (!file || file.size > MAX_FILE_BYTES) throw new Error('Choose a file smaller than 20 MB.');
  const boundary = `kalim_${crypto.randomUUID()}`;
  const type = /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type : 'application/octet-stream';
  const filename = file.name.replace(/[\r\n]/g, '_');
  const encodedName = encodeURIComponent(filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const attachment = base64(new Uint8Array(await file.arrayBuffer()));
  const mime = [
    `To: ${recipient}`, `From: ${sender}`, `Subject: ${encodedHeader(subject)}`,
    'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    base64(utf8('Please find the scanned document attached.')), '',
    `--${boundary}`, `Content-Type: ${type}`, `Content-Disposition: attachment; filename*=UTF-8''${encodedName}`,
    'Content-Transfer-Encoding: base64', '', wrap(attachment), '', `--${boundary}--`, '',
  ].join('\r\n');
  return base64(utf8(mime)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
