# Report relay

Handles machine-ID and problem reports forwarded by the frontend Worker through its `RELAY` service binding. Reports require Turnstile verification before delivery to Telegram.

This folder is connected to Cloudflare Workers Builds through the GitHub repository. Push relay changes to deploy them.

The Worker requires the secrets `TURNSTILE_SECRET`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID`.
