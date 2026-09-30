// SPDX-License-Identifier: AGPL-3.0-or-later
// Entry point of the container image: publishes runtime config (read by
// /api/v1/alive) and starts Next's standalone server, which itself loads any
// .env files. Configuration normally arrives as container env (--env-file).
globalThis.__RUNTIME_CONFIG__ = {
  APP_URI: process.env.APP_URI,
};

require('./server');
