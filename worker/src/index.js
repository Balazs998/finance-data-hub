import { BudgetGate } from "./budget.js";
import { handleRequest } from "./handler.js";

export { BudgetGate };

export default {
  fetch: function (request, env) {
    return handleRequest(request, env);
  }
};
