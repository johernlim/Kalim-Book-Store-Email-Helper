# One-time Google setup

The simplest arrangement is to sign in to Google Cloud with the Gmail account you want to send from. The project owner and sender may be different accounts. The receiver needs no setup.

1. Open https://console.cloud.google.com/ and create a project named **Kalim BookStore Email Helper**.
2. In **APIs & Services → Library**, find **Gmail API** and enable it.
3. Open **Google Auth Platform** (or **OAuth consent screen**) and complete the app details. Use **Kalim BookStore Email Helper** as the app name and your own support/contact email.
4. For a normal Gmail account, choose an **External** audience. Keep the app in **Testing** and add the sender Gmail address under **Audience → Test users**. Add any other sender accounts you intend to use. Google Workspace organizations may also offer an Internal audience.
5. Under **Data Access**, add `https://www.googleapis.com/auth/gmail.compose` and `https://www.googleapis.com/auth/userinfo.email`.
6. Under **Clients**, create an **OAuth client ID** of type **Web application**.
7. Add `https://johernlim.github.io` to **Authorized JavaScript origins**. Do not include the repository path or a trailing slash. For local testing, also add `http://localhost:8080`. This browser token flow needs no redirect URI.
8. Copy the **Client ID** ending in `.apps.googleusercontent.com` into `googleClientId` in `config.js`. The client ID is public and can be committed. Never put a client secret, password, or access token in the repository.
9. Commit and deploy the configuration. Open the page, enter a test receiver you control, select a harmless sample file, and click **Sent**. Choose your sender account and grant the requested permissions yourself.
10. Verify the new Gmail draft has the expected sender, receiver, subject, and attachment. Open the draft and click Send in Gmail when ready.

The app opens Gmail Drafts because Gmail provides no documented API-to-compose link for opening a particular API-created draft directly. The file is already attached; open the new draft to review it.

Testing apps are limited to their configured test users and may need repeat consent. Gmail compose is a restricted scope that allows managing drafts and sending email; this app only creates drafts. A broadly available public app may require Google verification. Review Google's requirements before expanding access beyond your own configured accounts.

For `origin_mismatch`, check the exact website origin in the Web application client. For access-blocked errors, confirm the sender is a test user. For Gmail 403 errors, confirm the API is enabled and permissions were granted.

References:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
