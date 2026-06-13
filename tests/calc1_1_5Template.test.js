// §1.5 template-output guard for the UNIFIED log convention (log = base-10,
// ln = natural, log(x)/log(b) change-of-base for other bases). The template's
// LOG GRAPH RENDERING rule previously told the model "the renderer's log is
// natural log" and to write fn:"log(x)" to mean y=ln(x) — now FALSE after the
// evaluators were unified to base-10 (commit cd86d15). These assertions lock the
// rewritten guidance and prove the old log-means-ln instruction is gone.

const { calc1_1_5_template } = require("../lib/templates/calc1_1_5.js");

// Flatten every prompt-rule string the template emits into one searchable blob.
const RULES = JSON.stringify(calc1_1_5_template);
const notation = (calc1_1_5_template.section_specific_rules?.notation_additions || []).join("\n");

describe("calc1_1_5 template — log-convention prompt rules", () => {
  test("the OLD log-means-ln instruction is GONE", () => {
    expect(RULES).not.toContain("the renderer's log is natural log");
    // old example that told the model to emit fn:"log(x)" for y=ln(x)
    expect(RULES).not.toContain('y = ln(x) -> fn: "log(x)"');
  });

  test("LOG GRAPH RENDERING rule now pins log=base-10 and ln for natural", () => {
    expect(notation).toMatch(/graph renderer's "log" is base-10/);
    // ln must be written as ln(x), NOT log(x)
    expect(notation).toContain('y = ln(x) -> fn: "ln(x)"');
    // base-10 common log is bare log(x)
    expect(notation).toContain('y = log_10(x) -> fn: "log(x)"');
    // other bases via change-of-base (base cancels)
    expect(notation).toContain('y = log_3(x) -> fn: "log(x)/log(3)"');
    // explicit prohibition
    expect(notation).toContain('NEVER write fn: "log(x)" to mean ln(x)');
  });

  test("display LOGARITHM NOTATION agrees: log = base-10 (common log), ln = natural", () => {
    expect(notation).toMatch(/ln\(x\) for natural log/);
    expect(notation).toMatch(/log\(x\) or log_10\(x\) for common log \(base 10\)/);
  });

  test("no remaining text anywhere claims the RENDERER's log is natural", () => {
    // the only dangerous phrasings — the rewrite removed these exact claims
    expect(RULES).not.toContain("renderer's log is natural");
    expect(RULES).not.toContain('renderer\\u0027s log is natural');
    expect(RULES).not.toContain("log is natural log");
  });
});
