# Kalim Book Store Email Helper

A responsive HTML form with a prefilled title, receiver email, multiple-file picker, and **Sent** button. Creates a Gmail draft with every selected file attached using Google Identity Services and the Gmail API.

## Setup

Follow [GOOGLE-SETUP.md](GOOGLE-SETUP.md), then put your public OAuth client ID in `config.js`. No client secret or backend is needed. The sender is the Google account chosen during authorization. The form email is the receiver.

## Use

Enter the receiver and select one or more files (up to **20 MB combined**). There is no separate file-count limit. Use Ctrl/Shift in the file picker to select multiple files; choosing again replaces the selection. Each filename and size appears below the picker. Click a filename to open its preview inside the page, then close it to return to the form.

PDFs render with locally hosted Mozilla PDF.js and Previous/Next page controls. Images use the browser's image decoder. Text files show as literal text (first 1 MB for large files). Unsupported formats, password-protected PDFs, and damaged files show an explanation without downloading or launching another application; they can still be attached. Previews stay on the device and do not upload documents to a preview service.

Click **Sent**, choose the sender's Google account if prompted, and authorize access. The app creates one draft with **all selected files** attached, then opens Gmail Drafts. Open the new draft, review it, and click Gmail's Send button.

Gmail has no documented API-to-compose URL for opening an API-created draft directly. The page opens the authorized account's Drafts folder and provides a fallback link if the browser blocks the new tab. Clicking Sent again without changing the form reopens Drafts without creating another draft.

Documents upload directly from the browser to Google. Access tokens stay in memory only. The app has no analytics, document storage, or server. Gmail compose permissions include sending and draft management; this code only calls create-draft.

The page reuses a valid Google access token for subsequent documents in the same open tab. It requests a new token only after expiry or a rejected token, with the previous sender as an account hint. Google controls whether another prompt is required. Reloading or closing the page clears the connection; reload to choose a different sender. Initial permission is still required.

## Preview and check

Serve the folder over HTTP, then open `http://localhost:8080`. Modules and OAuth require HTTP/HTTPS. Add this localhost origin to your OAuth client for local Gmail testing. With Python, use the following command so Windows serves JavaScript modules with the correct content type:

```sh
python -c "import mimetypes,http.server; mimetypes.add_type('application/javascript','.mjs'); http.server.test(port=8080,bind='127.0.0.1')"
```

Run `node --test --test-isolation=none app.test.mjs message.test.mjs preview.test.mjs` for authorization reuse, expiry, denied access, multiple binary attachments, Unicode, header injection, total size, and preview-type checks. Authorization tests simulate Google responses. Live Google authorization and draft creation require a configured client ID and a sender account and must be verified after setup.

## GitHub Pages

In repository Settings → Pages, select Deploy from a branch → main → /(root) → Save. No build step is needed. Never commit scanned documents or credentials.
