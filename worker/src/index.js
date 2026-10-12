import { createRequire } from "node:module";
import { BudgetGate } from "./budget.js";

var require = createRequire(import.meta.url);
var handler = require("./handler.cjs");

export { BudgetGate };

export default {
  fetch: function (request, env) {
    return handler.handleRequest(request, env);
  }
};
