import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReceiverEmail } from './recipient.mjs';

test('rejects invalid domain endings and likely Gmail typos while allowing other providers', () => {
  for (const address of ['person@gmail.com', 'person@outlook.com', 'person@yahoo.com', 'person@example.com.my', 'person@example.technology']) {
    assert.equal(validateReceiverEmail(address), '', `${address} should be accepted`);
  }
  for (const address of ['person@gmail.con', 'person@gmail.c', 'person@gmail.co', 'person@gmial.com', 'person@example.con', 'person@example.c', 'person@example..com', 'person@example']) {
    assert.notEqual(validateReceiverEmail(address), '', `${address} should be rejected`);
  }
});
