import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, MAX_FILE_BYTES } from './message.mjs';
test('preserves attachment bytes and UTF-8 headers', async () => {
  const bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);
  const raw = await buildMessage({ recipient: 'receiver@example.com', sender: 'sender@example.com', subject: '扫描 Document', file: new File([bytes], '扫描.pdf', { type: 'application/pdf' }) });
  const mime = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(mime, /To: receiver@example.com\r\nFrom: sender@example.com/);
  assert.ok(mime.includes(Buffer.from('扫描 Document').toString('base64')));
  assert.ok(mime.includes("filename*=UTF-8''%E6%89%AB%E6%8F%8F.pdf"));
  assert.ok(mime.includes(Buffer.from(bytes).toString('base64')));
  assert.doesNotMatch(raw, /[+/=]/);
});
test('rejects header injection and oversized files', async () => {
  const input = { recipient: 'receiver@example.com', sender: 'sender@example.com', subject: 'Document', file: new File(['sample'], 'test.txt') };
  await assert.rejects(buildMessage({...input, recipient: 'receiver@example.com\r\nBcc: other@example.com'}));
  await assert.rejects(buildMessage({...input, subject: 'test\r\nBcc: other@example.com'}));
  await assert.rejects(buildMessage({...input, file: {size: MAX_FILE_BYTES + 1}}));
});
