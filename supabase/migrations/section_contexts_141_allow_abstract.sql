UPDATE section_contexts
SET style_rules = $$   A. EQUATION ALWAYS IN y = b₀ + b₁x FORM.
      Every regression equation in the stem, choices, and explanation is written in textbook notation: y = b₀ + b₁x with the actual numeric coefficients substituted in (e.g. "y = 10 + 0.8x", "y = 100 + 5x", "y = 120 + 0.18x"). For SCENARIO questions, NEVER write the equation with named variables on either side ("Sales = 100 + 5·Advertising" is NOT used). NEVER use ŷ / yhat — write y.
      When hasGraph is true, the numeric b₀ and b₁ in the equation MUST equal graphConfig.regressionLine.intercept and .slope.

   B. SCENARIO VS ABSTRACT QUESTIONS — both are allowed, but the mix is constrained.

      SCENARIO QUESTIONS (default — at least 75% of any generated set):
        Most questions use a real-world business context with named predictor and response variables and explicit units. The question text introduces the scenario and defines the variables. Use the pattern:
          "A business examines [predictor variable] (units) and [response variable] (units). The regression equation is y = <b₀> + <b₁>x, where x represents [predictor] and y represents [response]."
        The "where x represents … and y represents …" clause is REQUIRED for scenario questions — students must always know which real-world quantity each symbol stands for.

      ABSTRACT QUESTIONS (allowed, but at most 25% of any generated set — i.e. at most 1 in every 4):
        Abstract questions provide an (x, y) data table or set of pairs with no business context, and ask the student to identify the regression equation, compute b₀ or b₁, or predict y for a given x.
        Stem pattern: "Given the following observations for two variables x and y, [data table or pairs]. Identify the estimated regression equation." or "... predict the value of y when x = [value]."
        Abstract questions are useful for testing pure computational skill and pattern recognition. Use them sparingly — never more than 1 in every 4 questions, and never two abstract questions in a row.

   C. PREDICTIONS AND INTERPRETATIONS ARE PHRASED IN BUSINESS TERMS (scenario questions only).
      For scenario questions, the question asks the student to act on the scenario, not on abstract symbols.
        RIGHT: "Predict the sales when temperature is 80°F."
        WRONG: "Find y when x = 80."
        RIGHT: "What does the value 0.8 represent in this regression equation?" (followed by sentence choices in scenario terms)
        WRONG: "What does the slope of y on x represent?"
      For abstract questions, "Find y when x = …" phrasing is appropriate and expected.

   D. SCENARIO DIVERSITY (scenario questions only) — rotate across the question set, do not reuse the same scenario twice in a row:
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

      a. Interpret b₀ (y-intercept) in context. (SCENARIO ONLY)
         Stem pattern: "A business examines [predictor] (units) and [response] (units). The regression equation is y = <b₀> + <b₁>x, where x represents [predictor] and y represents [response]. What does the value <b₀> represent in this regression equation?"
         All four choices are FULL ENGLISH SENTENCES describing the scenario meaning of b₀ — NOT formulas, NOT "y when x = 0".
         Example correct choice: "The predicted sales (in $1000s) when temperature is 0°F."
         Example wrong choice: "y when x = 0."

      b. Interpret b₁ (slope) in context. (SCENARIO ONLY)
         Stem pattern: same setup as (a), ending with: "What does the slope <b₁> mean in this scenario?"
         All four choices are FULL ENGLISH SENTENCES in scenario terms.
         Example correct choice: "For each additional 1°F in temperature, predicted sales increase by $800."
         Example wrong choice: "y increases by 0.8 for each unit of x."

      c. Find b₀ and b₁ from a scatter plot or summary table. (SCENARIO OR ABSTRACT)
         For scenario questions: stem provides Σx, Σy, Σxy, Σx², n or a small data set with named variables.
         For abstract questions: stem provides only an (x, y) table or pairs with no scenario.
         Stem ends with: "... the estimated regression equation is approximately:"
         All four choices are equations in y = b₀ + b₁x form (e.g. "y = 10 + 0.8x", "y = 12 + 0.5x"). NEVER named-variable form for these choices.

      d. Identify the full regression equation from a graph. (SCENARIO ONLY)
         Stem describes the scenario, defines x and y, and asks which equation matches the fitted line in the scatter plot.
         All four choices are equations in y = b₀ + b₁x form. NEVER named-variable form.

      e. Predict the response for a given predictor value. (SCENARIO OR ABSTRACT)
         For scenario questions: phrased as a business question, e.g. "Predict the sales when temperature is 80°F." All four choices are numeric values WITH UNITS (e.g. "$74,000", "74 thousand dollars").
         For abstract questions: phrased as "Predict the value of y when x = 80." All four choices are numeric values with no units.

      f. Direction and strength of the linear relationship from a scatter plot. (SCENARIO ONLY)
         Stem: "Based on the scatter plot of [predictor] vs [response], describe the direction and strength of the linear relationship."
         All four choices are full sentences: "Positive and strong", "Positive and weak", "Negative and moderate", "No linear relationship", etc.

   G. FORBIDDEN in 14.1 — these belong in later sections, do NOT generate them here:
      - Residual calculations. The word "residual" must NOT appear anywhere in question text, choices, or explanation.
      - SSE, SSR, SST, MSE, standard error of the estimate (s_e or s).
      - R² / coefficient of determination (that is section 14.3).
      - Hypothesis tests, t-statistics, p-values, or confidence intervals on slope or intercept (those are 14.5).
      - "ŷ" or "yhat" (write y instead) and any equation form using named variables on either side ("Sales = 100 + 5·Advertising").$$
WHERE course = 'Quantitative Methods II'
  AND section = '14.1 Simple Linear Regression Model';
