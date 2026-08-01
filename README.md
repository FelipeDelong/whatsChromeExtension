# WhatsApp Web Monitor

WhatsApp Web Monitor is a Manifest V3 extension for Chrome and Chromium
browsers. It watches configured WhatsApp Web conversations and sends a saved
reply when an incoming message matches a configured keyword.

The extension is built with static web files. It requires no build step,
dependency installation, or dedicated backend.

## Features

- Define rules for WhatsApp groups or direct conversations.
- Add optional participant filters for group conversations.
- Match words and phrases without case sensitivity.
- Save multiple replies and select one when a message matches.
- Keep settings in the browser with `chrome.storage.local`.

## Requirements

- Google Chrome or another Chromium browser with Manifest V3 support.
- An authenticated WhatsApp Web session.
- Browser Developer mode for unpacked installation.

## Installation

1. Clone this repository or download and extract its source code.
2. Open `chrome://extensions` in the browser.
3. Use **Developer mode** and select **Load unpacked**.
4. Select the repository root, which contains `manifest.json`.

## Usage

1. Open the configuration page from the extension popup.
2. Choose the action for adding a monitoring rule.
3. Enter a group or contact name, at least one keyword, and at least one reply.
4. Add participant, date, or time filters when needed.
5. Confirm the entry, then save the configuration.
6. Open WhatsApp Web and keep the relevant conversation available in the
   browser.

## Technologies

- Chrome Extensions Manifest V3 APIs.
- HTML5, CSS3, and JavaScript.
- Bootstrap 5.3.8.
- jQuery 3.7.1 and jQuery btnSwitch 1.0.1.
- SweetAlert2.

All runtime assets are bundled with the extension.

## Privacy

The extension stores its rules and state in `chrome.storage.local`. It has no
analytics or dedicated backend. Its content script runs only on
`https://web.whatsapp.com/*` to inspect the page interface and submit configured
replies. The manifest also requests the `activeTab`, `storage`, and `tabs`
permissions.

## Third-party licenses

- [Bootstrap 5.3.8](assets/licenses/bootstrap-LICENSE.txt) — MIT License.
- [jQuery 3.7.1](assets/licenses/jquery-LICENSE.txt) — MIT License.
- [jQuery btnSwitch 1.0.1](assets/licenses/jquery-btnswitch-LICENSE.txt) — MIT
  License.
- [SweetAlert2 11.26.25](assets/licenses/sweetalert2-LICENSE.txt) — MIT License.
- [highlight.js 9.9.0](assets/licenses/highlightjs-LICENSE.txt) — BSD 3-Clause
  License.

WhatsApp is a trademark of Meta Platforms, Inc. This project is independent
and is not affiliated with or endorsed by Meta or WhatsApp.
