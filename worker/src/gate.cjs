/* Hourly rate counters and a hard daily token/spend budget.
   The stored record is counts only. Rule text is never passed in.
   reserve() holds the worst case before a provider call.
   settle() replaces that hold with the actual usage and never records
   a daily total above the cap. */
function limitsFrom(env) {
  env = env || {};
  return {
    perIp: Number(env.RATE_LIMIT_PER_IP || 30),
    global: Number(env.RATE_LIMIT_GLOBAL || 400),
    tokens: Number(env.DAILY_TOKEN_BUDGET || 100000),
    spend: Number(env.DAILY_SPEND_BUDGET_USD || 2)
  };
}

function fresh(day) {
  return { day: day, tokens: 0, spend: 0, hours: {} };
}

function clamp(value, limit) {
  if (value < 0) return 0;
  if (value > limit) return limit;
  return value;
}

function applyReserve(state, request, limits, now) {
  var day = now.toISOString().slice(0, 10);
  var hour = now.toISOString().slice(0, 13);
  if (!state || state.day !== day) state = fresh(day);
  Object.keys(state.hours).forEach(function (key) {
    if (key !== hour) delete state.hours[key];
  });
  if (!state.hours[hour]) state.hours[hour] = { global: 0, ips: {} };
  var bucket = state.hours[hour];
  var ip = request.ip || "unknown";
  var used = bucket.ips[ip] || 0;
  if (used >= limits.perIp) return { ok: false, error: "rate_ip", state: state };
  if (bucket.global >= limits.global) return { ok: false, error: "rate_global", state: state };
  var tokens = Number(request.tokens) || 0;
  var spend = Number(request.spend) || 0;
  if (state.tokens + tokens > limits.tokens) return { ok: false, error: "budget_tokens", state: state };
  if (state.spend + spend > limits.spend + 1e-9) return { ok: false, error: "budget_spend", state: state };
  bucket.ips[ip] = used + 1;
  bucket.global += 1;
  state.tokens += tokens;
  state.spend = Math.round((state.spend + spend) * 1000000) / 1000000;
  return { ok: true, error: null, state: state, tokens: state.tokens, spend: state.spend };
}

function applySettle(state, request, limits, now) {
  var day = now.toISOString().slice(0, 10);
  if (!state || state.day !== day) state = fresh(day);
  var tokens = (Number(state.tokens) || 0)
    - (Number(request.reservedTokens) || 0)
    + (Number(request.actualTokens) || 0);
  var spend = (Number(state.spend) || 0)
    - (Number(request.reservedSpend) || 0)
    + (Number(request.actualSpend) || 0);
  state.tokens = clamp(tokens, limits.tokens);
  state.spend = Math.round(clamp(spend, limits.spend) * 1000000) / 1000000;
  return { ok: true, error: null, state: state, tokens: state.tokens, spend: state.spend };
}

var memory = fresh("1970-01-01");

function resetMemory() {
  memory = fresh("1970-01-01");
}

function reserveMemory(request, limits, now) {
  var result = applyReserve(memory, request, limits, now || new Date());
  memory = result.state;
  return result;
}

function settleMemory(request, limits, now) {
  var result = applySettle(memory, request, limits, now || new Date());
  memory = result.state;
  return result;
}

function snapshot() {
  return { day: memory.day, tokens: memory.tokens, spend: memory.spend };
}

module.exports = {
  limitsFrom: limitsFrom,
  applyReserve: applyReserve,
  applySettle: applySettle,
  applyCharge: applyReserve,
  reserveMemory: reserveMemory,
  settleMemory: settleMemory,
  chargeMemory: reserveMemory,
  resetMemory: resetMemory,
  snapshot: snapshot
};
