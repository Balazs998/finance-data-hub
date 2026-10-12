/* Line diff used by the mock provider and the page. No network. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RuleDiff = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function linesOf(text) {
    return String(text || "").replace(/\s+$/, "").split("\n");
  }

  function diffLines(before, after) {
    var a = linesOf(before);
    var b = linesOf(after);
    var n = a.length;
    var m = b.length;
    var dp = [];
    for (var i = 0; i <= n; i++) {
      dp[i] = new Array(m + 1).fill(0);
    }
    for (var x = n - 1; x >= 0; x--) {
      for (var y = m - 1; y >= 0; y--) {
        dp[x][y] = a[x] === b[y] ? dp[x + 1][y + 1] + 1 : Math.max(dp[x + 1][y], dp[x][y + 1]);
      }
    }
    var rows = [];
    var i = 0;
    var j = 0;
    var left = 1;
    var right = 1;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        rows.push({ type: "same", text: a[i], left: left, right: right });
        i += 1;
        j += 1;
        left += 1;
        right += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        rows.push({ type: "del", text: a[i], left: left, right: "" });
        i += 1;
        left += 1;
      } else {
        rows.push({ type: "add", text: b[j], left: "", right: right });
        j += 1;
        right += 1;
      }
    }
    while (i < n) {
      rows.push({ type: "del", text: a[i], left: left, right: "" });
      i += 1;
      left += 1;
    }
    while (j < m) {
      rows.push({ type: "add", text: b[j], left: "", right: right });
      j += 1;
      right += 1;
    }
    return rows;
  }

  return { diffLines: diffLines };
});
