/* Offline until endpoint is a worker URL. Leave both values empty to stay
   on the mock provider in this browser. Nothing is sent.
   endpoint: "https://fdh-rule-studio.<account>.workers.dev"
   turnstileSiteKey: the Turnstile site key from the Cloudflare widget */
window.FDH_RULE_STUDIO = window.FDH_RULE_STUDIO || {
  endpoint: "",
  turnstileSiteKey: ""
};
