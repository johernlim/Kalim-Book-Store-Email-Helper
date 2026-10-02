# Kalim Book Store Email Helper

A responsive HTML form with a prefilled title, receiver email, multiple-file picker, and **Sent** button. Creates a Gmail draft with every selected file attached using Google Identity Services and the Gmail API.

## Setup

Follow [GOOGLE-SETUP.md](GOOGLE-SETUP.md), then put your public OAuth client ID in `config.js`. No client secret or backend is needed. The sender is the Google account chosen during authorization. The form email is the receiver.

## Use

Before the form appears, click **Check pop-ups**. The site opens and closes a blank window. If blocked, it shows instructions to allow pop-ups for this site and retry. A successful click reveals the form. This checks a user-initiated window only: it cannot read or change the browser's persistent popup permission or guarantee future asynchronous popups. The check repeats on page load, while any permission saved in the browser is managed by the browser. No files or Google access are involved in this check.

Enter the receiver and select one or more files (up to **20 MB combined**). There is no separate file-count limit. Use Ctrl/Shift in the file picker to select multiple files; choosing again replaces the selection. Each filename and size appears below the picker. Click a filename to open its preview inside the page, then close it to return to the form.

PDFs render with locally hosted Mozilla PDF.js and Previous/Next page controls. Images use the browser's image decoder. Text files show as literal text (first 1 MB for large files). Unsupported formats, password-protected PDFs, and damaged files show an explanation without downloading or launching another application; they can still be attached. Previews stay on the device and do not upload documents to a preview service.

Click **Sent**, choose the sender's Google account if prompted, and authorize access. The app creates one draft with **all selected files** attached, then attempts to open that message in Gmail's compose window with an empty body. Review it and click Gmail's Send button.

When authorization is already valid, clicking Sent immediately opens a waiting tab and redirects it to Gmail after upload. After Google authorization, or if a popup is blocked or closed, the current tab automatically navigates to Gmail. No extra link click is required. Returning to the helper after same-tab navigation may require reconnecting because tokens are kept only in memory. Failed uploads close the waiting tab and leave the form available.

The direct compose link uses the returned message ID (not the draft ID). Gmail does not document this UI route, so it may change or fail to open the message. A Drafts fallback link is always shown. Clicking Sent again without changing the form reopens the same link without creating another draft. The message remains a draft until sent. Direct compose navigation needs a live-account check; automated tests only verify the generated URL.

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
