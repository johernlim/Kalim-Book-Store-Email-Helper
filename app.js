import { buildMessage, validateFiles } from './message.mjs';
import { openPreview, closePreview, formatSize } from './preview.mjs';
const form = document.querySelector('#email-form');
const fileInput = document.querySelector('#document');
const fileInfo = document.querySelector('#file-info');
const fileList = document.querySelector('#file-list');
const status = document.querySelector('#status');
const titleInput = document.querySelector('#title');
const senderNote = document.querySelector('#sender-note');
const popupSetup = document.querySelector('#popup-setup');
const popupStatus = document.querySelector('#popup-status');
let popupCheckPassed = false;
const popupSetupKey = 'kalim-email-helper:popup-setup-complete';
function showEmailForm(focus = false) {
  popupCheckPassed = true;
  popupSetup.hidden = true;
  form.hidden = false;
  if (focus) document.querySelector('#email').focus();
}
function checkPopups(focus = false) {
  let probe;
  try { probe = window.open('about:blank', '_blank'); } catch { /* Browser or extension blocked the check. */ }
  if (!probe || probe.closed) {
    if (focus) popupStatus.textContent = 'The check window was blocked. Allow pop-ups for this site using the steps above, then click Check pop-ups again.';
    return;
  }
  try { probe.opener = null; probe.close(); } catch { /* Window cleanup must not block the form. */ }
  try { window.localStorage.setItem(popupSetupKey, 'true'); } catch { /* Continue even when storage is unavailable. */ }
  showEmailForm(focus);
}
document.querySelector('#check-popups').addEventListener('click', () => checkPopups(true));
let setupRemembered = false;
try { setupRemembered = window.localStorage.getItem(popupSetupKey) === 'true'; } catch { /* Check without storage. */ }
if (setupRemembered) showEmailForm();
else checkPopups();
let busy = false;
let lastDraft = null;
// Reuse authorization only in this tab's memory, and stop before its expiry.
let accessToken = '';
let tokenExpiresAt = 0;
let senderEmail = '';
const clientId = window.KALIM_CONFIG?.googleClientId?.trim();
if (!clientId) status.textContent = 'One-time Google setup is needed. Follow GOOGLE-SETUP.md and add your OAuth client ID to config.js.';
fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  lastDraft = null;
  closePreview();
  const error = validateFiles(files);
  fileInput.setCustomValidity(error);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  fileInfo.textContent = files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected · ${formatSize(total)} total · Maximum 20 MB${error ? ' — ' + error : ''}` : 'Choose one or more files. Maximum 20 MB in total.';
  fileList.replaceChildren();
  for (const file of files) {
    const item = document.createElement('li');
    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'file-preview-button';
    name.textContent = file.name;
    name.setAttribute('aria-label', `Preview ${file.name}`);
    name.addEventListener('click', () => openPreview(file));
    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = formatSize(file.size);
    item.append(name, size);
    fileList.append(item);
  }
});
titleInput.addEventListener('input', () => titleInput.setCustomValidity(''));
form.addEventListener('input', () => { lastDraft = null; });
function setBusy(value) {
  busy = value;
  form.setAttribute('aria-busy', String(value));
  for (const control of form.elements) control.disabled = value;
}
function forgetToken() { accessToken = ''; tokenExpiresAt = 0; }

function reserveGmailWindow() {
  // Open during the click, before uploads consume the browser's user activation.
  const popup = window.open('about:blank', '_blank');
  if (popup) {
    popup.opener = null;
    popup.document.title = 'Preparing your Gmail message';
    popup.document.body.textContent = 'Attaching your files… Gmail will open here automatically when ready.';
  }
  return popup;
}

function navigateToGmail(url, popup) {
  if (popup && !popup.closed) {
    try { popup.location.replace(url); return; } catch { /* Use this tab if the window became unavailable. */ }
  }
  // Authorization already uses a popup. This tab needs no second popup permission.
  window.location.assign(url);
}

async function createDraft(input, popup = null) {
  try {
    status.textContent = `Creating your Gmail draft and attaching ${input.files.length} file${input.files.length === 1 ? '' : 's'}…`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (!senderEmail) {
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers });
      if (!profileResponse.ok) {
        if (profileResponse.status === 401) forgetToken();
        throw new Error('Could not identify the sender account. Click Sent to try again.');
      }
      const profile = await profileResponse.json();
      if (!profile.email) throw new Error('Google did not return the sender email address.');
      senderEmail = profile.email;
    }
    senderNote.textContent = `Sender: ${senderEmail}. This account will be reused while the connection is valid. Reload the page to choose another account.`;
    const raw = await buildMessage({ ...input, sender: senderEmail });
    // Never retry automatically: an ambiguous network failure may have created a draft.
    const result = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw } }) });
    if (!result.ok) {
      if (result.status === 401) forgetToken();
      const errors = { 401: 'Google authorization expired. Click Sent to reconnect.', 403: 'Check that the Gmail API is enabled and the sender is an allowed test user.', 413: 'These attachments are too large. Choose fewer or smaller files.', 429: 'Gmail is limiting requests. Please wait before trying again.' };
      throw new Error(errors[result.status] || `Gmail could not confirm the draft (${result.status}). Check Gmail Drafts before trying again.`);
    }
    // Gmail's compose route is undocumented; retain Drafts as a recovery link.
    const draft = await result.json();
    const draftsUrl = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(senderEmail)}#drafts`;
    const messageId = draft.message?.id;
    const url = messageId ? `${draftsUrl}?compose=${encodeURIComponent(messageId)}` : draftsUrl;
    lastDraft = url;
    status.replaceChildren(document.createTextNode(`Draft created for ${input.recipient} with ${input.files.length} file${input.files.length === 1 ? '' : 's'} attached: ${input.files.map(file => file.name).join(', ')}. Sender: ${senderEmail}. `));
    const link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = messageId ? 'Open Gmail compose' : 'Open Gmail Drafts';
    status.append(link, document.createTextNode(' to review and send. '));
    if (messageId) {
      const fallback = document.createElement('a');
      fallback.href = draftsUrl; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; fallback.textContent = 'Find it in Drafts';
      status.append(document.createTextNode('If the message does not open, '), fallback, document.createTextNode('.'));
    }
    navigateToGmail(url, popup);
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    status.textContent = error instanceof TypeError ? 'Connection interrupted. Check Gmail Drafts before retrying to avoid duplicates.' : error.message;
  } finally { setBusy(false); }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!popupCheckPassed) return;
  if (busy) return;
  titleInput.setCustomValidity(titleInput.value.trim() ? '' : 'Enter an email title.');
  fileInput.setCustomValidity(validateFiles(Array.from(fileInput.files)));
  if (!form.reportValidity()) return;
  if (lastDraft) { navigateToGmail(lastDraft, reserveGmailWindow()); return; }
  if (!clientId) { status.textContent = 'Google setup is not complete. Add your Google OAuth client ID to config.js first.'; return; }
  const input = { recipient: document.querySelector('#email').value.trim(), subject: titleInput.value.trim(), files: Array.from(fileInput.files) };
  setBusy(true);
  if (accessToken && Date.now() < tokenExpiresAt) return createDraft(input, reserveGmailWindow());
  forgetToken();
  if (!window.google?.accounts?.oauth2) { status.textContent = 'Google sign-in could not load. Check your connection and reload.'; setBusy(false); return; }
  status.textContent = senderEmail ? 'Reconnecting to Google…' : 'Choose the Google account you want to send from…';
  try {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/userinfo.email',
      include_granted_scopes: false,
      callback: async (response) => {
        if (response.error || !response.access_token) { status.textContent = 'Google access was not granted. Your files have not been uploaded.'; setBusy(false); return; }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, 'https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/userinfo.email')) {
          response.access_token = '';
          status.textContent = 'Allow Gmail draft access and email address access to continue.';
          setBusy(false);
          return;
        }
        accessToken = response.access_token;
        const lifetime = Number(response.expires_in);
        tokenExpiresAt = Date.now() + (Number.isFinite(lifetime) ? Math.max(0, lifetime - 60) * 1000 : 0);
        response.access_token = '';
        // Resolve identity again in case Google returned a different account.
        senderEmail = '';
        senderNote.textContent = '';
        await createDraft(input);
      },
      error_callback: () => { status.textContent = 'Google sign-in was closed or blocked. Allow pop-ups for this page and try again.'; setBusy(false); },
    });
    client.requestAccessToken(senderEmail ? { prompt: '', hint: senderEmail } : { prompt: 'select_account' });
  } catch { status.textContent = 'Google sign-in could not start. Reload and try again.'; setBusy(false); }
});
