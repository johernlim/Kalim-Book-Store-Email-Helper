# Kalim Book Store Email Helper

A simple, responsive HTML form for preparing scanned-document emails. Styled with a dark card and mint accents.

## Use

1. Keep or edit the prefilled title: **Kalim BookStore Scanned Document**.
2. Enter the receiver email and select a file from your computer.
3. Click **Sent** to open Gmail with the receiver and subject filled in.
4. Attach the selected file in Gmail and click Gmail's **Send** button.

The page does not send email itself or upload/store files. A Gmail compose URL cannot attach a local file. Automatic attachments require Google OAuth authorization and the Gmail API to create a draft containing a MIME attachment. See [Google's Gmail API guide](https://developers.google.com/workspace/gmail/api/guides/sending).

## Preview

Open `index.html` in a browser. There are no dependencies or build steps.

## GitHub Pages

In the repository, choose **Settings → Pages → Deploy from a branch → main → /(root) → Save**. All assets use relative paths and work under a repository URL.

Only application source belongs in this repository. Do not commit scanned files or credentials.
