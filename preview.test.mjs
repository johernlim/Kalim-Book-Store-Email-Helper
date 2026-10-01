import test from 'node:test';
import assert from 'node:assert/strict';
import { previewType, formatSize } from './preview.mjs';

test('recognizes preview formats when the operating system omits MIME types', () => {
  assert.equal(previewType({ name: 'SCAN.PDF', type: '' }), 'pdf');
  assert.equal(previewType({ name: 'scan.jpeg', type: '' }), 'image');
  assert.equal(previewType({ name: 'notes.txt', type: '' }), 'text');
  assert.equal(previewType({ name: 'letter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'unsupported');
  assert.equal(previewType({ name: 'markup.html', type: 'text/html' }), 'text', 'HTML is shown as inert text');
  assert.equal(formatSize(0), '0 B');
});
