# WORKitOUT

A personal training and nutrition planner that runs entirely in the browser: weekly schedule,
workout logging with rest timers, daily menus with editable calories and protein, weekly tracking
and touch-base check-ins that adjust the recommendations.

Built by [Oren Lulu](https://www.linkedin.com/in/oren2020).

## Your data

Everything you enter stays in your browser (localStorage). There is no account and no server.
Use **Download backup** and **Restore from backup** on the home page to keep a copy or move to
another device. Clearing your browser data deletes your history, so back up regularly.

## How plans are made

Plans, menus and recommendations come from fixed, documented rules (`src/engine.js`), so the same
inputs always give the same plan. This is general fitness information, not medical advice. Stop any
movement that causes pain, and check with a doctor before starting if you have a health condition.

## Optional: connect your own Claude API key

With a key, the app can ask a few clarifying questions about what you write (injuries, food
restrictions) and add a short coach note to your touch-base results. Without a key everything
else works the same.

1. Create an account at [console.anthropic.com](https://console.anthropic.com) and add a small
   credit balance.
2. Create an API key and set a monthly spending limit on it.
3. Open WORKitOUT, scroll to **Optional AI review**, paste the key and tap **Save key**.
4. Use **Remove key** at any time.

What to know before you do:
- The key is stored only in this browser and is never included in backups.
- Requests go directly from your browser to Anthropic. The text you write in limits, notes,
  daily feedback and check-ins is sent with them. Do not enter anything you do not want sent.
- You pay Anthropic for usage. A review is a short request, but set a limit anyway.
- Keys saved in a browser can be read by anything running on that device. Use a limited key and
  only on a device you trust.
- The model is set by `AI_MODEL` in `src/app.js`. This integration has been tested against a mocked
  endpoint, not a live account. If a review fails, check the key, your balance and the model name.

## Develop

```
node build.js            # public build -> dist/index.html
node build.js --stub     # test build with fake storage -> dist/stub.html
node test/engine.test.js # plan generator checks
```

No dependencies. The private personal build (`--personal`) reads `private/personal.json`, which is
not part of this repository.

(c) 2026 Oren Lulu. All rights reserved. See LICENSE.
