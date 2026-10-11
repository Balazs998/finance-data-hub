# Rule Studio worker setup

The site works without this worker. Leave `endpoint` empty in `docs/javascripts/rule-studio-config.js` and the page stays in offline mock mode: static checks run in the browser, and the draft is labelled **Mock provider – not real AI**.

Deploy the worker only when you want `/analyze`, `/generate`, and `/refine` on Cloudflare. Do not commit API keys.

## 1. Cloudflare account

1. Create a free Cloudflare account at <https://dash.cloudflare.com/sign-up>.
2. Note the account ID under **Workers & Pages**.
3. Install Wrangler (Node 20 or newer) and log in:

```bash
npm install -g wrangler
wrangler login
```

`wrangler login` opens a browser and stores an OAuth token on your machine. It does not put a secret in this repository.

## 2. Turnstile keys

1. In the Cloudflare dashboard open **Turnstile** and create a widget.
2. Add the site hostname. For the published docs site that is `balazs998.github.io`. For a local preview you can add `localhost`.
3. Copy the **site key** and the **secret key**. The site key is public. The secret is not.

The widget mode can be managed. The page renders it only when both `endpoint` and `turnstileSiteKey` are set.

## 3. Deploy

From the repository root:

```bash
cd worker
npx wrangler deploy
```

Wrangler reads `worker/wrangler.toml`. The first deploy creates the `BudgetGate` Durable Object (migration `v1`). That object stores hourly request counts and the daily token and spend totals. It does not store rule text.

The default vars keep `AI_PROVIDER` as `mock`, so a deploy is safe before you add a model key. Mock responses are labelled and are not a live model.

## 4. Set the API key

The provider key is a secret, not a var in `wrangler.toml`:

```bash
cd worker
npx wrangler secret put AI_API_KEY
```

Paste the key when prompted. Wrangler stores it on the Worker. It never prints the value back into the repo.

Set the provider and model as plain vars when you leave mock mode. Edit `worker/wrangler.toml` and deploy again, or set them without a file:

```bash
npx wrangler secret put AI_API_KEY
```

`AI_PROVIDER` and `AI_MODEL` are vars, not secrets (the model name is not a credential):

```toml
[vars]
AI_PROVIDER = "openai"   # mock, openai, or anthropic
AI_MODEL = "gpt-4o-mini"
```

Then `npx wrangler deploy`.

For Anthropic use `AI_PROVIDER = "anthropic"` and an Anthropic model name in `AI_MODEL`. The same `AI_API_KEY` secret is sent as `x-api-key`. Switching provider is that var plus a new deploy. Put a new key with `wrangler secret put AI_API_KEY` if the vendor changes.

Also set the Turnstile secret:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

If `TURNSTILE_SECRET` is missing, the worker refuses requests. It does not skip the check.

## 5. Spend limit

The worker hard-stops when a request's reservation would pass either daily cap. Defaults in `wrangler.toml`:

| Var | Default | Meaning |
| --- | --- | --- |
| `DAILY_TOKEN_BUDGET` | `100000` | Token cap for the UTC day. |
| `DAILY_SPEND_BUDGET_USD` | `2` | Dollar cap for the UTC day. |
| `MAX_TOKENS` | `1500` | `max_tokens` sent on every provider call, including a repair call. |
| `INPUT_TOKEN_USD` | `0.000002` | Dollars per prompt token. |
| `OUTPUT_TOKEN_USD` | `0.000002` | Dollars per completion token. |
| `RATE_LIMIT_PER_IP` | `30` | Requests per IP per hour. |
| `RATE_LIMIT_GLOBAL` | `400` | Requests per hour for the whole worker. |
| `MAX_BODY_BYTES` | `48000` | Largest request body. |
| `ALLOWED_ORIGIN` | `https://balazs998.github.io` | Browser origin allowed to POST. Comma-separate more than one. |
| `TURNSTILE_HOSTNAME` | `balazs998.github.io` | Hostname that Turnstile siteverify must return. |

Before the provider is called, the worker reserves `input estimate + MAX_TOKENS`. Prompt tokens and completion tokens are priced separately: `input estimate × INPUT_TOKEN_USD + MAX_TOKENS × OUTPUT_TOKEN_USD`. OpenAI and Anthropic can run `repair()`, which is a second call, so that reservation is doubled for those providers. If the reservation does not fit under both caps, the worker returns the static findings and does not call the provider.

After the call, the reservation is replaced with the provider's reported prompt and completion tokens, priced with the same two rates. A repair adds the second call's usage. The stored daily totals are clamped to the caps. If the provider errors before it reports usage, the reservation stays, so an unreported completion cannot open more budget. Mock mode reports zero tokens and releases the reservation. The rate-limit counter is not released.

`TOKEN_USD` is still read when `INPUT_TOKEN_USD` is unset, so an older deploy keeps a single input price. Set both new vars to match the model you chose. Also set a cap in the provider dashboard. This counter is not an invoice.

Counts are kept until the next UTC day. Rule text is not written to the Durable Object and is not written to logs. Logs are the path, status, token count, and an error code.

The client address is `CF-Connecting-IP` only. `x-forwarded-for` is ignored. A POST whose `Origin` is missing or not in `ALLOWED_ORIGIN` is rejected with 403 before the body is used. Turnstile must succeed and its `hostname` must equal `TURNSTILE_HOSTNAME`.

## 6. Point the site at the worker

Edit `docs/javascripts/rule-studio-config.js`:

```javascript
window.FDH_RULE_STUDIO = {
  endpoint: "https://fdh-rule-studio.<account>.workers.dev",
  turnstileSiteKey: "<turnstile site key>"
};
```

Publish the site after that change. The Rule Studio page's Content-Security-Policy is built from this `endpoint` and from `extra.goatcounter_code`, so a new endpoint is allowed only after the next site build. Clearing `endpoint` returns the page to offline mock mode without undeploying the worker.

## 7. Check

```bash
curl -s https://fdh-rule-studio.<account>.workers.dev/health
```

A healthy worker answers `{"ok":true,"provider":"mock"}` (or `openai` / `anthropic` after you switch). `/health` does not accept a rule.

A rule request without a Turnstile token is rejected. Use the page, not curl, for `/analyze`.
