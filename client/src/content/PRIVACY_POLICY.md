# Privacy Policy

Last updated: October 3, 2026

Open Teleprompt is an open-source teleprompter. It shows a Google Doc (or a document from a connected Nextcloud) as scrolling text, and keeps the scroll position in sync across the windows you have open. This policy explains what the app stores about you, why, and how to get it removed.

The app is maintained by Jameson R Grieve. Its full source code is public at [github.com/JamesonRGrieve/Zephyreader](https://github.com/JamesonRGrieve/Zephyreader), so everything described here can be checked against the code.

## What we store

### Your account

You sign in with Google. There are no passwords. When you sign in for the first time, the app creates an account from what Google returns:

- your email address (only accepted if Google confirms you own it)
- your name and display name
- the address of your Google profile picture
- your Google account's stable identifier, which is how the app recognises you on later sign-ins

You can also set a time zone and a language on your account page, and edit your name there.

### Your Google connection

To list and open your documents, the app asks Google for read-only access to your Google Drive. Google gives the app an access token and a refresh token. The app stores both, encrypted with AES-256-GCM, so they're never on disk in readable form. It also stores when the access token expires and which permissions it was granted.

### Sign-in records

Each sign-in creates a session record: an identifier, when it started, when it expires, and whether you've signed out. While a Google sign-in is in progress, a short-lived record holds the security values for that attempt. It's deleted when you return from Google, and it expires after 10 minutes if you don't.

## What we don't store

- **Your documents.** When you open a Google Doc, the app fetches it from Google as text and passes it to your browser to display. It isn't saved on the server. The document list (names, descriptions, sizes, starred status and modified times) is fetched fresh each time and not saved either.
- **Your scroll position.** Syncing between your windows happens in the server's memory, only between your own open windows, and is gone when they close.
- **Analytics.** The app has no analytics, advertising or tracking scripts.

## How we use Google user data

The app uses the Google Drive read-only permission for one purpose: listing your Google Docs and opening the one you pick in the teleprompter. It doesn't change, delete or share anything in your Drive.

The app's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Google user data is used only to provide the teleprompter. It isn't sold, used for advertising, or transferred to anyone else, and no person reads it unless you ask for help with a problem and agree to it.

## Who else receives data

- **Google** handles sign-in and serves your documents, under [Google's Privacy Policy](https://policies.google.com/privacy).
- **Gravatar.** The account menu shows your Gravatar picture if you have one. To find it, your browser asks Gravatar (run by Automattic) for an image named after a one-way hash of your email address. Gravatar sees that request and your IP address, under [Automattic's privacy policy](https://automattic.com/privacy/).
- **Nextcloud.** If the server is set up with a Nextcloud connection, documents can also come from that Nextcloud. The server's operator configures the account; the app never asks for your Nextcloud credentials.

Nothing is sold to anyone.

## Cookies

The app uses only the cookies it needs to work:

| Cookie             | What it's for                                                     | How long it lasts                               |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------- |
| `zx_session`       | Keeps you signed in. Your browser's scripts can't read it.        | 24 hours, or until you sign out                 |
| `zx_csrf`          | Protects your account from forged requests made by other websites | 24 hours, or until you sign out                 |
| `zx_oauth_binding` | Ties a Google sign-in to the browser that started it              | 10 minutes, deleted when you return from Google |
| `theme`            | Remembers light or dark mode                                      | Until you clear it                              |

## Logs

The server keeps error logs to diagnose problems. They record what went wrong, and may include an account's internal identifier. They don't record document contents, tokens or your email address.

## How long we keep it

Your account and Google connection are kept until you ask for them to be deleted. Deleting your account also deletes your Google connection (including the stored tokens) and your sign-in records. You can stop the app using your Google account at any time, without deleting anything, by removing Open Teleprompt at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). After that, the stored tokens no longer work.

## Your choices

- **See and correct** your details on the account page.
- **Revoke Google access** at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- **Delete your account and its data** by asking, as described under Contact below. You can also ask for a copy of what's stored about you.

## Children

Open Teleprompt isn't meant for children under 13, and it doesn't knowingly hold data about them. If you believe a child has an account, ask for it to be deleted.

## Changes

If this policy changes, the date at the top changes with it, and the previous versions stay in the project's public history on GitHub.

## Contact

Questions and deletion or copy requests go to the maintainer through [the project's GitHub page](https://github.com/JamesonRGrieve/Zephyreader/issues). For a deletion request, open an issue saying you want your account deleted. Don't post your email address; you'll be contacted privately to confirm the account is yours.
