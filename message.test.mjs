import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, MAX_TOTAL_BYTES, validateFiles } from './message.mjs';
test('preserves every attachment and UTF-8 headers, including duplicate filenames', async () => {
  const bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);
  const second = new Uint8Array([255, 12, 10, 0, 32, 19]);
  const files = [new File([bytes], '扫描.pdf', { type: 'application/pdf' }), new File([second], '扫描.pdf', { type: 'application/pdf' }), new File([], 'empty.txt')];
  const raw = await buildMessage({ recipient: 'receiver@example.com', sender: 'sender@example.com', subject: '扫描 Document', files });
  const mime = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(mime, /To: receiver@example.com\r\nFrom: sender@example.com/);
  assert.ok(mime.includes(Buffer.from('扫描 Document').toString('base64')));
  assert.ok(mime.includes("filename*=UTF-8''%E6%89%AB%E6%8F%8F.pdf"));
  assert.ok(mime.includes(Buffer.from(bytes).toString('base64')));
  assert.ok(mime.includes(Buffer.from(second).toString('base64')));
  const attachments = mime.split(/--kalim_[^\r\n]+\r\n/).filter(part => part.includes('Content-Disposition: attachment'));
  assert.equal(attachments.length, 3);
  for (let i = 0; i < attachments.length; i++) {
    const payload = attachments[i].split('\r\n\r\n')[1].trim();
    assert.deepEqual(Buffer.from(payload, 'base64'), Buffer.from(await files[i].arrayBuffer()));
  }
  assert.doesNotMatch(raw, /[+/=]/);
});
test('rejects header injection and oversized files', async () => {
  const input = { recipient: 'receiver@example.com', sender: 'sender@example.com', subject: 'Document', files: [new File(['sample'], 'test.txt')] };
  await assert.rejects(buildMessage({...input, recipient: 'receiver@example.com\r\nBcc: other@example.com'}));
  await assert.rejects(buildMessage({...input, subject: 'test\r\nBcc: other@example.com'}));
  await assert.rejects(buildMessage({...input, files: [{size: MAX_TOTAL_BYTES - 1}, {size: 2}]}), /20 MB/);
  await assert.rejects(buildMessage({...input, files: []}), /at least one/);
  assert.equal(validateFiles([{size: MAX_TOTAL_BYTES / 2}, {size: MAX_TOTAL_BYTES / 2}]), '');
});
