ALTER TABLE section_contexts
  ADD COLUMN IF NOT EXISTS style_rules text,
  ADD COLUMN IF NOT EXISTS answer_choice_rules text;

UPDATE section_contexts
SET
  style_rules = $$   A. EQUATION ALWAYS IN y = b₀ + b₁x FORM.
      Every regression equation in the stem, choices, and explanation is written in textbook notation: y = b₀ + b₁x with the actual numeric coefficients substituted in (e.g. "y = 10 + 0.8x", "y = 100 + 5x", "y = 120 + 0.18x"). NEVER write the equation with named variables on either side ("Sales = 100 + 5·Advertising" is NOT used in 14.1 questions). NEVER use ŷ / yhat — write y.
      When hasGraph is true, the numeric b₀ and b₁ in the equation MUST equal graphConfig.regressionLine.intercept and .slope.

   B. THE QUESTION MUST DEFINE WHAT x AND y REPRESENT.
      Every question text introduces the scenario and explicitly defines the variables before (or just after) the equation. Use the pattern:
        "A business examines [predictor variable] (units) and [response variable] (units). The regression equation is y = <b₀> + <b₁>x, where x represents [predictor] and y represents [response]."
      The "where x represents … and y represents …" clause is REQUIRED — students must always know which real-world quantity each symbol stands for.

   C. PREDICTIONS AND INTERPRETATIONS ARE PHRASED IN BUSINESS TERMS.
      Even though the equation uses y and x, the question asks the student to act on the scenario, not on abstract symbols.
        RIGHT: "Predict the sales when temperature is 80°F."
        WRONG: "Find y when x = 80."
        RIGHT: "What does the value 0.8 represent in this regression equation?" (followed by sentence choices in scenario terms)
        WRONG: "What does the slope of y on x represent?"

   D. SCENARIO DIVERSITY — rotate across the question set, do not reuse the same scenario twice in a row:
      - Advertising spend (in $1000s) vs Sales (in $1000s)
      - Hours studied vs Test score
      - Years of experience vs Annual salary (in $1000s)
      - Temperature (°F) vs Ice cream sales (in $1000s)
      - Square footage vs House price (in $1000s)
      - Production volume (units) vs Total cost (in $1000s)
      - Marketing budget (in $1000s) vs Customer acquisitions
      - Number of in-store promotions vs Weekly revenue (in $1000s)
      Always include units in the axis labels (xLabel/yLabel), in the variable definitions in the stem, and in any predicted-value answer choice.

   E. ALLOWED QUESTION TYPES — generate a mix across the set, never all the same type:

      a. Interpret b₀ (y-intercept) in context.
         Stem pattern: "A business examines [predictor] (units) and [response] (units). The regression equation is y = <b₀> + <b₁>x, where x represents [predictor] and y represents [response]. What does the value <b₀> represent in this regression equation?"
         All four choices are FULL ENGLISH SENTENCES describing the scenario meaning of b₀ — NOT formulas, NOT "y when x = 0".
         Example correct choice: "The predicted sales (in $1000s) when temperature is 0°F."
         Example wrong choice: "y when x = 0."

      b. Interpret b₁ (slope) in context.
         Stem pattern: same setup as (a), ending with: "What does the slope <b₁> mean in this scenario?"
         All four choices are FULL ENGLISH SENTENCES in scenario terms.
         Example correct choice: "For each additional 1°F in temperature, predicted sales increase by $800."
         Example wrong choice: "y increases by 0.8 for each unit of x."

      c. Find b₀ and b₁ from a scatter plot or summary table (Σx, Σy, Σxy, Σx², n).
         Stem ends with: "... the estimated regression equation is approximately:"
         All four choices are equations in y = b₀ + b₁x form (e.g. "y = 10 + 0.8x", "y = 12 + 0.5x"). NEVER named-variable form for these choices.

      d. Identify the full regression equation from a graph.
         Stem describes the scenario, defines x and y, and asks which equation matches the fitted line in the scatter plot.
         All four choices are equations in y = b₀ + b₁x form. NEVER named-variable form.

      e. Predict the response for a given predictor value, phrased as a business question.
         Stem pattern: "A business examines [predictor] (units) and [response] (units). The regression equation is y = <b₀> + <b₁>x, where x represents [predictor] and y represents [response]. Predict the [response in business terms] when [predictor] is [value]."
         RIGHT: "Predict the sales when temperature is 80°F."
         WRONG: "Find y when x = 80."
         All four choices are numeric values WITH UNITS (e.g. "$74,000", "74 thousand dollars").

      f. Direction and strength of the linear relationship from a scatter plot.
         Stem: "Based on the scatter plot of [predictor] vs [response], describe the direction and strength of the linear relationship."
         All four choices are full sentences: "Positive and strong", "Positive and weak", "Negative and moderate", "No linear relationship", etc.

   G. FORBIDDEN in 14.1 — these belong in later sections, do NOT generate them here:
      - Residual calculations. The word "residual" must NOT appear anywhere in question text, choices, or explanation.
      - SSE, SSR, SST, MSE, standard error of the estimate (s_e or s).
      - R² / coefficient of determination (that is section 14.3).
      - Hypothesis tests, t-statistics, p-values, or confidence intervals on slope or intercept (those are 14.5).
      - Pure abstract math with no scenario or no x/y definition (the "where x represents … and y represents …" clause is required).
      - "ŷ" or "yhat" (write y instead) and any equation form using named variables on either side ("Sales = 100 + 5·Advertising").$$,
  answer_choice_rules = $$   F. ANSWER CHOICE STYLE — strict per type:
      - Types a, b, f (interpretation): all four choices are FULL ENGLISH SENTENCES describing the scenario meaning, with units. No formulas. No "y when x = …" wording.
      - Types c, d (equation identification): all four choices are equations in y = b₀ + b₁x form. Never "Sales = 100 + 5·Advertising" form for choices.
      - Type e (prediction): all four choices are numeric values with the response variable's units.$$
WHERE course = 'Quantitative Methods II'
  AND section = '14.1 Simple Linear Regression Model';
