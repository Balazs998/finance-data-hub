/* Calls the deployed mock worker. AI_PROVIDER stays mock, so results are
   the stand-in AI (test mode, not a live model). The site build copies
   endpoint into the Rule Studio Content-Security-Policy connect-src.
   turnstileSiteKey is the public Turnstile site key, not a secret.
   Clear endpoint to stay on the offline mock in this browser. Nothing is sent.
   Rebuild after changing endpoint. */
window.FDH_RULE_STUDIO = window.FDH_RULE_STUDIO || {
  endpoint: "https://fdh-rule-studio.balazs998.workers.dev",
  turnstileSiteKey: "0x4AAAAAAFVul5wxe6CirVtR"
};
