import test from 'node:test';
import assert from 'node:assert/strict';

test('reuses valid authorization, renews expired or rejected tokens, and handles denial', async (t) => {
  const saved = new Map(['document', 'window', 'google', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const element = (value = '') => ({
    value, textContent: '', listeners: {}, disabled: false, children: [],
    addEventListener(event, fn) { this.listeners[event] = fn; },
    setCustomValidity() {}, setAttribute() {}, reportValidity() { return true; },
    replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
  });
  const nodes = Object.fromEntries(['email-form', 'document', 'file-info', 'file-list', 'status', 'title', 'sender-note', 'email'].map(id => [id, element()]));
  const form = nodes['email-form'];
  form.elements = [nodes.title, nodes.email, nodes.document];
  nodes.title.value = 'Kalim test';
  nodes.email.value = 'receiver@example.com';
  nodes.document.files = [new File(['harmless sample'], 'test.txt', { type: 'text/plain' }), new File(['second sample'], 'second.txt', { type: 'text/plain' })];
  globalThis.document = {
    querySelector: selector => nodes[selector.slice(1)],
    createElement: () => element(), createTextNode: text => text,
  };
  let authConfig;
  const authRequests = [];
  let scopesGranted = true;
  const oauth2 = {
    initTokenClient(config) {
      authConfig = config;
      return { requestAccessToken: options => authRequests.push(options) };
    },
    hasGrantedAllScopes: () => scopesGranted,
  };
  globalThis.google = { accounts: { oauth2 } };
  const opened = [];
  globalThis.window = { KALIM_CONFIG: { googleClientId: 'test-client' }, google, open(url) { opened.push(url); } };
  let draftCount = 0;
  let draftStatus = 200;
  let profileCount = 0;
  globalThis.fetch = async (url, options) => {
    assert.match(options.headers.Authorization, /^Bearer test-token-/);
    if (url.endsWith('/userinfo')) {
      profileCount++;
      return { ok: true, json: async () => ({ email: 'sender@example.com' }) };
    }
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/drafts');
    assert.ok(JSON.parse(options.body).message.raw);
    const mime = Buffer.from(JSON.parse(options.body).message.raw, 'base64url').toString('utf8');
    assert.equal((mime.match(/Content-Disposition: attachment/g) || []).length, 2);
    draftCount++;
    return { ok: draftStatus === 200, status: draftStatus, json: async () => ({ id: 'draft-id', message: { id: 'message-id' } }) };
  };
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  await import(`./app.js?auth-test=${now}`);
  const submit = () => form.listeners.submit({ preventDefault() {} });
  const change = () => form.listeners.input();
  const authorize = () => authConfig.callback({ access_token: `test-token-${authRequests.length}`, expires_in: 3600 });

  nodes.document.listeners.change();
  assert.equal(nodes['file-list'].children.length, 2);
  assert.equal(nodes['file-list'].children[0].children[0].textContent, 'test.txt');
  assert.match(nodes['file-info'].textContent, /2 files selected/);

  submit();
  assert.equal(authRequests.length, 1);
  await authorize();
  assert.equal(draftCount, 1);
  assert.equal(opened.at(-1), 'https://mail.google.com/mail/u/?authuser=sender%40example.com#drafts?compose=message-id');
  assert.ok(nodes.status.children.some(child => child.href === 'https://mail.google.com/mail/u/?authuser=sender%40example.com#drafts'));
  assert.match(nodes['sender-note'].textContent, /sender@example.com/);
  await submit();
  assert.equal(draftCount, 1, 'unchanged form only reopens existing draft');
  change();
  await submit();
  assert.equal(draftCount, 2);
  assert.equal(authRequests.length, 1, 'second document reuses authorization');
  assert.equal(profileCount, 1, 'cached identity belongs to cached token');

  now += 3_600_000;
  change();
  submit();
  assert.equal(authRequests.length, 2);
  assert.deepEqual(authRequests[1], { prompt: '', hint: 'sender@example.com' });
  await authorize();
  assert.equal(profileCount, 2, 'renewed token identity is checked again');

  draftStatus = 401;
  change();
  await submit();
  const beforeReconnect = draftCount;
  assert.match(nodes.status.textContent, /expired/);
  submit();
  assert.equal(authRequests.length, 3, 'rejected token requires reconnection');
  assert.equal(draftCount, beforeReconnect, 'does not retry a draft automatically');
  await authConfig.callback({ error: 'access_denied' });
  assert.equal(draftCount, beforeReconnect);
  assert.ok(form.elements.every(control => !control.disabled));

  submit();
  scopesGranted = false;
  await authorize();
  assert.equal(draftCount, beforeReconnect, 'missing permissions prevent upload');
  assert.match(nodes.status.textContent, /Allow Gmail draft access/);
});
