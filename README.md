# Kalim Book Store Email Helper

A responsive HTML form with a prefilled title, receiver email, file picker, and one **Sent** button. Creates a Gmail draft with the selected file attached using Google Identity Services and the Gmail API.

## Setup

Follow [GOOGLE-SETUP.md](GOOGLE-SETUP.md), then put your public OAuth client ID in `config.js`. No client secret or backend is needed. The sender is the Google account chosen during authorization. The form email is the receiver.

## Use

Enter the receiver, select a document (up to 20 MB), and click **Sent**. Choose the sender's Google account and authorize access. The app creates a draft with the file attached, then opens Gmail Drafts. Open the new draft, review it, and click Gmail's Send button.

Gmail has no documented API-to-compose URL for opening an API-created draft directly. The page opens the authorized account's Drafts folder and provides a fallback link if the browser blocks the new tab. Clicking Sent again without changing the form reopens Drafts without creating another draft.

Documents upload directly from the browser to Google. Access tokens stay in memory only. The app has no analytics, document storage, or server. Gmail compose permissions include sending and draft management; this code only calls create-draft.

## Preview and check

Serve the folder over HTTP, for example `python -m http.server 8080`, then open `http://localhost:8080`. Modules and OAuth require HTTP/HTTPS. Add this localhost origin to your OAuth client for local testing.

Run `node --test message.test.mjs` for binary attachment, Unicode, header injection, and size checks. Live Google authorization and draft creation require a configured client ID and a sender account and must be verified after setup.

## GitHub Pages

In repository Settings → Pages, select Deploy from a branch → main → /(root) → Save. No build step is needed. Never commit scanned documents or credentials.
