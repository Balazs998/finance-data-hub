import { createRequire } from "node:module";

var require = createRequire(import.meta.url);
var gate = require("./gate.cjs");

export class BudgetGate {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    var body = await request.json();
    var stored = await this.state.storage.get("gate");
    var result = gate.applyCharge(stored, {
      ip: body.ip,
      tokens: body.tokens,
      spend: body.spend
    }, gate.limitsFrom(this.env), new Date());
    await this.state.storage.put("gate", result.state);
    return Response.json({
      ok: result.ok,
      error: result.error,
      tokens: result.tokens || 0,
      spend: result.spend || 0
    });
  }
}
