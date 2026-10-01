import { buildMessage, MAX_FILE_BYTES } from './message.mjs';
const form = document.querySelector('#email-form');
const fileInput = document.querySelector('#document');
const fileInfo = document.querySelector('#file-info');
const status = document.querySelector('#status');
const titleInput = document.querySelector('#title');
let busy = false;
let lastDraft = null;
const clientId = window.KALIM_CONFIG?.googleClientId?.trim();
if (!clientId) status.textContent = 'One-time Google setup is needed. Follow GOOGLE-SETUP.md and add your OAuth client ID to config.js.';
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInput.setCustomValidity(file && file.size > MAX_FILE_BYTES ? 'Choose a file smaller than 20 MB.' : '');
  fileInfo.textContent = file ? `${file.name} · ${(file.size / 1048576).toFixed(2)} MB · Maximum 20 MB` : 'Choose a file from your computer.';
});
titleInput.addEventListener('input', () => titleInput.setCustomValidity(''));
form.addEventListener('input', () => { lastDraft = null; });
function setBusy(value) {
  busy = value;
  form.setAttribute('aria-busy', String(value));
  for (const control of form.elements) control.disabled = value;
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy) return;
  titleInput.setCustomValidity(titleInput.value.trim() ? '' : 'Enter an email title.');
  if (!form.reportValidity()) return;
  if (lastDraft) { window.open(lastDraft, '_blank', 'noopener,noreferrer'); return; }
  if (!clientId) { status.textContent = 'Google setup is not complete. Add your Google OAuth client ID to config.js first.'; return; }
  if (!window.google?.accounts?.oauth2) { status.textContent = 'Google sign-in could not load. Check your connection and reload.'; return; }
  const input = { recipient: document.querySelector('#email').value.trim(), subject: titleInput.value.trim(), file: fileInput.files[0] };
  setBusy(true);
  status.textContent = 'Choose the Google account you want to send from…';
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/userinfo.email',
    include_granted_scopes: false,
    callback: async (response) => {
      if (response.error || !response.access_token) { status.textContent = 'Google access was not granted. Your file has not been uploaded.'; setBusy(false); return; }
      try {
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, 'https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/userinfo.email')) throw new Error('Allow Gmail draft access and email address access to continue.');
        status.textContent = 'Creating your Gmail draft and attaching the document…';
        const headers = { Authorization: `Bearer ${response.access_token}` };
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers });
        if (!profileResponse.ok) throw new Error('Could not identify the sender account. Please try again.');
        const profile = await profileResponse.json();
        if (!profile.email) throw new Error('Google did not return the sender email address.');
        const raw = await buildMessage({ ...input, sender: profile.email });
        // Never retry automatically: an ambiguous network failure may have created a draft.
        const result = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw } }) });
        if (!result.ok) {
          const errors = { 401: 'Google authorization expired. Click Sent to authorize again.', 403: 'Check that the Gmail API is enabled and the sender is an allowed test user.', 413: 'This attachment is too large. Choose a smaller file.', 429: 'Gmail is limiting requests. Please wait before trying again.' };
          throw new Error(errors[result.status] || `Gmail could not confirm the draft (${result.status}). Check Gmail Drafts before trying again.`);
        }
        // Gmail has no documented API-to-compose deep link. Open this account's Drafts.
        const url = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(profile.email)}#drafts`;
        lastDraft = url;
        status.replaceChildren(document.createTextNode(`Draft created for ${input.recipient}, with “${input.file.name}” attached. Sender: ${profile.email}. `));
        const link = document.createElement('a');
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open Gmail Drafts';
        status.append(link, document.createTextNode(' and open your new draft to review and send.'));
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (error) {
        status.textContent = error instanceof TypeError ? 'Connection interrupted. Check Gmail Drafts before retrying to avoid duplicates.' : error.message;
      } finally { response.access_token = ''; setBusy(false); }
    },
    error_callback: () => { status.textContent = 'Google sign-in was closed or blocked. Allow pop-ups for this page and try again.'; setBusy(false); },
  });
  try { client.requestAccessToken({ prompt: 'select_account' }); }
  catch { status.textContent = 'Google sign-in could not start. Reload and try again.'; setBusy(false); }
});
