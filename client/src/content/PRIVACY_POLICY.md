# Privacy Policy

Last updated: November 24, 2026

Zephyreader is an open-source teleprompter. You write or import a script, and it scrolls the script for you to read, at a steady speed or following your voice, on as many of your own screens as you like. You can also record yourself while you read. This policy explains what Zephyreader stores about you, why, and how to get it removed.

Zephyreader is maintained by Jameson R Grieve. Its full source code is public, mirrored at [github.com/JamesonRGrieve/Zephyreader](https://github.com/JamesonRGrieve/Zephyreader), so everything described here can be checked against the code.

## Two ways to run it

- **The hosted service** is the Zephyreader that the maintainer runs for anyone to use. New accounts and paid plans are waitlist only for now. This policy covers it.
- **A self-hosted copy** is one someone runs on their own server from the published code. Whoever runs that copy holds its data, not the maintainer, and their own policy applies. A self-hosted copy stores the same things described here, except recordings, captions, payments, the AI writer and server speech recognition, which only the hosted service has.

## What we store

### Your account

On the hosted service you sign in with a Zephyrex account, at the sign-in service the maintainer runs for Zephyrex's apps (Authentik, not a third party). A self-hosted copy signs in with Google. Either way, Zephyreader has no passwords of its own. When you sign in for the first time, an account is created from what the sign-in service returns:

- your email address (only accepted if the sign-in service confirms you own it)
- your name and display name
- the address of your profile picture, if it has one
- your stable identifier there, which is how you're recognised on later sign-ins

You can also set a time zone and a language on your account page, and edit your name there.

### Your scripts and settings

- **Scripts** you write or import: their title, text, folder, whether you starred them, their word count, and where they were imported from (a Google Drive file's id, or a file's name).
- **Folders** you file scripts in.
- **Prompter settings**: text size, colours, margins, scroll speed and the other display and scrolling choices you save.

### Your Google connection

To import from Google Drive, Zephyreader asks Google for read-only access to your Drive. Google gives an access token and a refresh token. They're stored encrypted, so they're never on disk in readable form, along with when the access token expires and which permissions were granted. A file you import is copied into your scripts; nothing else in your Drive is stored.

### Recordings and captions (hosted service, paid plans)

If you keep a recording in your recordings library, the video is stored with its title, length, size and type. If you ask for captions, the recording's speech is transcribed and the transcript and its timings are stored with it. Recordings you don't keep stay in your browser and never reach the server.

### Your plan (hosted service)

If you subscribe to a paid plan, the plan, the subscription's status and renewal date, and Square's identifiers for you and your payments are stored. Square is the payment processor: your card details go to Square and are never seen or stored by Zephyreader.

### The waitlist (hosted service)

If you join the waitlist for accounts and paid plans, we keep your email address, the name if you give one, which you're waiting for (an account or a paid plan), and that you agreed to be emailed. It goes into the maintainer's customer records (an ERPNext system the maintainer runs, not a third party), marked as a Zephyreader waitlist sign-up, and is used only to email you when accounts and paid plans open. It is kept until you ask for it to be removed, as described under Contact below. The waitlist allows a few sign-ups an hour from one network address, so the address your request came from is held, in memory only, for an hour.

### Sign-in records

Each sign-in creates a session record: an identifier, when it started, when it expires, and whether you've signed out. While a sign-in is in progress, a short-lived record holds the security values for that attempt. It's deleted when you return from the sign-in service, and it expires after 10 minutes if you don't.

## What we don't store

- **Your voice.** How voice-follow hears you depends on the engine you pick in the prompter's settings:
  - **On this device** runs a speech model inside your browser. Your voice never leaves your device. The model is downloaded from Zephyreader itself and cached by your browser.
  - **Browser speech** uses the speech recognition built into your browser. Your browser may send your voice to its maker to be transcribed (Chrome sends it to Google, Safari to Apple), under their privacy policies.
  - **Zephyreader server** (hosted service, paid plans) sends short clips of your voice to the server, which transcribes them and returns the words. The clips and words aren't kept.
- **What the AI writer works on.** When you ask the AI writer (hosted service, paid plans) to draft, shorten, rewrite or translate, the text you give it is sent to the server and its AI provider, and the result is sent back to you. Neither is kept unless you save it into a script.
- **Your scroll position and remote control.** Syncing your screens and remote control happens in the server's memory, only between your own signed-in windows and devices, and is gone when they close.
- **Analytics.** Zephyreader has no analytics, advertising or tracking scripts, and pages load nothing from other websites.

## How we use Google user data

Zephyreader uses the Google Drive read-only permission for one purpose: listing your Drive files so you can pick one to import as a script. It doesn't change, delete or share anything in your Drive.

Zephyreader's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Google user data is used only to provide the teleprompter. It isn't sold, used for advertising, used to train AI models, or transferred to anyone else, and no person reads it unless you ask for help with a problem and agree to it.

## Who else receives data

- **Google** handles sign-in on a self-hosted copy, and serves the Drive files you import, under [Google's Privacy Policy](https://policies.google.com/privacy). The hosted service's sign-in is the maintainer's own.
- **Your browser's maker**, if you choose browser speech for voice-follow, as described above.
- **Square** (hosted service) handles checkout and billing for paid plans, under [Square's Privacy Notice](https://squareup.com/legal/general/privacy).
- **The AI and speech providers** the hosted service uses for the AI writer, captions and server speech recognition receive the text or audio you send to those features, only to process it.

Nothing is sold to anyone.

## Cookies and browser storage

Zephyreader uses only the cookies it needs to work:

- **`zx_session`** keeps you signed in; scripts can't read it. It lasts 24 hours, or until you sign out.
- **`zx_csrf`** protects your account from forged requests. It lasts 24 hours, or until you sign out.
- **`zx_oauth_binding`** ties a sign-in to the browser that began it. It lasts 10 minutes, or until you return from the sign-in service.
- **`theme`** remembers light or dark mode, until you clear it.

Each browser tab also keeps a random name for itself in session storage, so your other devices can tell it apart, and the on-device speech model is kept in your browser's cache. Both stay on your device.

## Logs

The server keeps error logs to diagnose problems. They record what went wrong, and may include an account's internal identifier. They don't record scripts, recordings, tokens or your email address.

## How long we keep it

Your account, scripts, settings, recordings and Google connection are kept until you delete them or delete your account.

- **Deleting a script, folder or recording** removes it from everything you see straight away, and a recording's video is deleted at once.
- **Deleting your account**, on your account page, deletes it and everything listed under _What we store_ with it, including every recording's video, signs you out on every device, and cancels your subscription so you're never charged again. The only exception is the payment records the law requires to be kept for tax and accounting, with the name and email address of the account they were made out to.
- **On the hosted service**, a deleted record other than a video is hidden at once, so it can never be used or seen again, and kept for 30 days so a mistaken deletion can be undone on request. After 30 days it's deleted for good. On a self-hosted copy it is gone at once.

You can stop Zephyreader using your Google account at any time, without deleting anything, by removing Zephyreader at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). After that, the stored tokens no longer work.

## Your choices

- **See and correct** your details on the account page.
- **Delete** any script, folder or recording yourself, at any time.
- **Revoke Google access** at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- **Delete your account and its data** yourself, on your account page.
- **Ask for a copy** of what's stored about you, as described under Contact below.
- **Leave the waitlist** by asking, as described under Contact below.

## Children

Zephyreader isn't meant for children under 13, and it doesn't knowingly hold data about them. If you believe a child has an account, ask for it to be deleted.

## Changes

If this policy changes, the date at the top changes with it, and the previous versions stay in the project's public history on GitHub.

## Contact

Questions about your privacy, and requests for a copy of your data or its deletion, go to [privacy@zephyrex.ca](mailto:privacy@zephyrex.ca). Write from the email address on your account, so the request can be matched to it; you'll be asked to confirm the account is yours before anything is sent or removed. Questions about the code itself are welcome on [the project's GitHub page](https://github.com/JamesonRGrieve/Zephyreader/issues), but never post personal details there.
