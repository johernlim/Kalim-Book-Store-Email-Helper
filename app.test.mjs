import test from 'node:test';
import assert from 'node:assert/strict';

test('reuses valid authorization, renews expired or rejected tokens, and handles denial', async (t) => {
  const saved = new Map(['document', 'window', 'google', 'fetch', 'DataTransfer'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const element = (value = '') => ({
    value, textContent: '', listeners: {}, disabled: false, children: [], focus() {},
    addEventListener(event, fn) { this.listeners[event] = fn; },
    setCustomValidity(message) { this.validationMessage = message; }, setAttribute() {}, reportValidity() { return true; },
    replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
  });
  const nodes = Object.fromEntries(['email-form', 'document', 'file-info', 'file-list', 'status', 'title', 'sender-note', 'email', 'popup-setup', 'popup-status', 'check-popups'].map(id => [id, element()]));
  const form = nodes['email-form'];
  form.elements = [nodes.title, nodes.email, nodes.document];
  form.reportValidity = () => !nodes.email.validationMessage;
  nodes.title.value = 'Kalim test';
  nodes.email.value = 'receiver@example.com';
  nodes.document.files = [new File(['harmless sample'], 'test.txt', { type: 'text/plain' }), new File(['second sample'], 'second.txt', { type: 'text/plain' })];
  globalThis.DataTransfer = class {
    constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; }
  };
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
  const navigated = [];
  const popups = [];
  let blockPopup = true;
  const storage = new Map();
  globalThis.window = {
    KALIM_CONFIG: { googleClientId: 'test-client' }, google,
    localStorage: { getItem(key) { return storage.get(key); }, setItem(key, value) { storage.set(key, value); } },
    location: { assign() { assert.fail('The helper tab must never navigate away'); } },
    open(url) {
      opened.push(url);
      if (blockPopup) return null;
      const popup = { opener: window, document: { title: '', body: {} }, closed: false,
        location: { replace(url) { navigated.push(url); } }, close() { this.closed = true; } };
      popups.push(popup);
      return popup;
    },
  };
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

  submit();
  assert.equal(authRequests.length, 0, 'setup runs before authorization or upload');
  blockPopup = true;
  nodes['check-popups'].listeners.click();
  assert.match(nodes['popup-status'].textContent, /blocked/);
  submit();
  assert.equal(authRequests.length, 0);
  blockPopup = false;
  nodes['check-popups'].listeners.click();
  assert.equal(nodes['popup-setup'].hidden, true);
  assert.equal(form.hidden, false);
  assert.equal(popups.at(-1).closed, true, 'check closes its blank window');
  assert.equal(storage.get('kalim-email-helper:popup-setup-complete'), 'true');
  opened.length = 0;

  nodes.document.listeners.change();
  assert.equal(nodes['file-list'].children.length, 2);
  assert.equal(nodes['file-list'].children[0].children[0].textContent, 'test.txt');
  assert.match(nodes['file-info'].textContent, /2 files selected/);
  const originalFiles = [...nodes.document.files];
  const firstRemove = nodes['file-list'].children[0].children[2];
  assert.equal(firstRemove.textContent, '×');
  assert.equal(firstRemove.listeners.click instanceof Function, true);
  firstRemove.listeners.click();
  assert.deepEqual(nodes.document.files.map(file => file.name), ['second.txt']);
  assert.equal(nodes['file-list'].children.length, 1);
  assert.match(nodes['file-info'].textContent, /1 file selected/);
  nodes['file-list'].children[0].children[2].listeners.click();
  assert.equal(nodes.document.files.length, 0);
  assert.equal(nodes['file-list'].children.length, 0);
  assert.match(nodes.document.validationMessage, /Choose at least one file/);
  nodes.document.files = originalFiles;
  nodes.document.listeners.change();

  nodes.email.value = 'receiver@gmail.con';
  submit();
  assert.match(nodes.email.validationMessage, /@gmail.com/);
  assert.equal(authRequests.length, 0, 'invalid receiver cannot start Google authorization');
  nodes.email.value = 'receiver@outlook.com';
  nodes.email.listeners.input();
  assert.equal(nodes.email.validationMessage, '');
  nodes.email.value = 'receiver@example.com';
  nodes.email.listeners.input();

  submit();
  assert.equal(authRequests.length, 1);
  await authorize();
  assert.equal(draftCount, 1);
  assert.equal(navigated.at(-1), 'https://mail.google.com/mail/u/?authuser=sender%40example.com#drafts?compose=message-id');
  assert.equal(opened.length, 1, 'authorization flow opens a separate Gmail tab');
  assert.equal(popups.at(-1).opener, null);
  assert.ok(nodes.status.children.some(child => child.href === 'https://mail.google.com/mail/u/?authuser=sender%40example.com#drafts'));
  assert.match(nodes['sender-note'].textContent, /sender@example.com/);
  await submit();
  assert.equal(draftCount, 1, 'unchanged form only reopens existing draft');
  change();
  const creating = submit();
  assert.equal(opened.at(-1), 'about:blank', 'window opens synchronously before upload finishes');
  assert.equal(popups.at(-1).opener, null);
  await creating;
  assert.equal(draftCount, 2);
  assert.equal(authRequests.length, 1, 'second document reuses authorization');
  assert.equal(profileCount, 1, 'cached identity belongs to cached token');
  blockPopup = true;
  change();
  const beforeFallback = navigated.length;
  await submit();
  assert.equal(navigated.length, beforeFallback, 'blocked popup keeps the helper tab open');
  assert.ok(nodes.status.children.some(child => typeof child === 'string' && child.includes('could not open a new tab')));
  blockPopup = false;
  const beforeRetry = draftCount;
  await submit();
  assert.equal(draftCount, beforeRetry, 'retry after blocked tab opens existing message without duplication');
  assert.equal(navigated.length, beforeFallback + 1);

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
  assert.equal(popups.at(-1).closed, true, 'failed upload closes the waiting window');
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

  form.hidden = true;
  nodes['popup-setup'].hidden = false;
  blockPopup = true;
  const beforeReload = opened.length;
  await import('./app.js?remembered-setup-test');
  assert.equal(form.hidden, false, 'return visit goes straight to form');
  assert.equal(nodes['popup-setup'].hidden, true);
  assert.equal(opened.length, beforeReload, 'remembered setup does not open a test window');

  storage.clear();
  form.hidden = true;
  nodes['popup-setup'].hidden = false;
  blockPopup = false;
  await import('./app.js?already-allowed-test');
  assert.equal(form.hidden, false, 'already allowed popups reveal form automatically');

  window.localStorage = { getItem() { throw new Error('Unavailable'); }, setItem() { throw new Error('Unavailable'); } };
  form.hidden = true;
  await import('./app.js?storage-unavailable-test');
  assert.equal(form.hidden, false, 'storage restrictions do not block access');
});
