/* A small JSON Schema checker for the request and response documents
   this worker accepts. It covers the keywords those schemas use. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RuleValidate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var BANNED = {
    timing: 1,
    timings: 1,
    elapsed: 1,
    elapsedms: 1,
    duration: 1,
    durationms: 1,
    speedup: 1,
    speedups: 1,
    benchmark: 1,
    benchmarks: 1,
    milliseconds: 1,
    ms: 1
  };

  function typeOf(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  function check(value, schema, path, errors) {
    if (!schema || typeof schema !== "object") return;
    var here = path || "$";
    if (schema.type) {
      var types = Array.isArray(schema.type) ? schema.type : [schema.type];
      var actual = typeOf(value);
      var ok = types.some(function (kind) {
        if (kind === "integer") return typeof value === "number" && Number.isInteger(value);
        return kind === actual;
      });
      if (!ok) {
        errors.push(here + " should be " + types.join(" or "));
        return;
      }
    }
    if (schema.enum && schema.enum.indexOf(value) < 0) {
      errors.push(here + " is not an allowed value");
    }
    if (typeof value === "string") {
      if (schema.minLength != null && value.length < schema.minLength) errors.push(here + " is too short");
      if (schema.maxLength != null && value.length > schema.maxLength) errors.push(here + " is too long");
    }
    if (typeof value === "number") {
      if (schema.minimum != null && value < schema.minimum) errors.push(here + " is below the minimum");
      if (schema.maximum != null && value > schema.maximum) errors.push(here + " is above the maximum");
    }
    if (schema.type === "array" && Array.isArray(value) && schema.items) {
      value.forEach(function (item, index) { check(item, schema.items, here + "[" + index + "]", errors); });
    }
    if (value && typeOf(value) === "object" && (schema.properties || schema.required || schema.additionalProperties === false)) {
      var props = schema.properties || {};
      (schema.required || []).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(here + "." + key + " is required");
      });
      Object.keys(value).forEach(function (key) {
        if (props[key]) check(value[key], props[key], here + "." + key, errors);
        else if (schema.additionalProperties === false) errors.push(here + "." + key + " is not allowed");
      });
    }
  }

  function validate(value, schema) {
    var errors = [];
    check(value, schema, "$", errors);
    return errors;
  }

  function bannedKeys(value, path, found) {
    if (!value || typeof value !== "object") return found;
    var here = path || "$";
    if (Array.isArray(value)) {
      value.forEach(function (item, index) { bannedKeys(item, here + "[" + index + "]", found); });
      return found;
    }
    Object.keys(value).forEach(function (key) {
      if (BANNED[key.toLowerCase()]) found.push(here + "." + key);
      bannedKeys(value[key], here + "." + key, found);
    });
    return found;
  }

  return { validate: validate, bannedKeys: bannedKeys };
});
