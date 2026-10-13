import gate from "./gate.cjs";

export class BudgetGate {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    var body = await request.json();
    var stored = await this.state.storage.get("gate");
    var limits = gate.limitsFrom(this.env);
    var now = new Date();
    var result = body.op === "settle"
      ? gate.applySettle(stored, {
        reservedTokens: body.reservedTokens,
        reservedSpend: body.reservedSpend,
        actualTokens: body.actualTokens,
        actualSpend: body.actualSpend
      }, limits, now)
      : gate.applyReserve(stored, {
        ip: body.ip,
        tokens: body.tokens,
        spend: body.spend
      }, limits, now);
    await this.state.storage.put("gate", result.state);
    return Response.json({
      ok: result.ok,
      error: result.error,
      tokens: result.tokens || 0,
      spend: result.spend || 0
    });
  }
}
