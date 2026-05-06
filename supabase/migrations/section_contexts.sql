CREATE TABLE IF NOT EXISTS section_contexts (
  course text NOT NULL,
  section text NOT NULL,
  key_concepts text,
  key_formulas text,
  notation_rules text,
  common_mistakes text,
  question_style text,
  PRIMARY KEY (course, section)
);

ALTER TABLE section_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated users" ON section_contexts;
CREATE POLICY "Allow read for authenticated users"
  ON section_contexts FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO section_contexts (course, section, key_concepts, key_formulas, notation_rules, common_mistakes, question_style) VALUES
('Quantitative Methods II', '14.1 Simple Linear Regression Model',
$$Regression model: y = beta_0 + beta_1*x + epsilon. Regression equation (deterministic): E(y) = beta_0 + beta_1*x. Estimated regression equation: y_hat = b_0 + b_1*x. beta_0 and beta_1 are POPULATION parameters; b_0 and b_1 are SAMPLE estimates. epsilon is the random error term, assumed N(0, sigma^2) and independent across observations. Distinguish carefully: regression model (population) vs estimated regression equation (sample). Assumptions: E(epsilon) = 0; Var(epsilon) = sigma^2 constant for all x (homoscedasticity); epsilon values are independent; epsilon is normally distributed for any given x.$$,
$$y = beta_0 + beta_1*x + epsilon (model). E(y) = beta_0 + beta_1*x (regression equation). y_hat = b_0 + b_1*x (estimated regression equation).$$,
$$Use y_hat (read as "y-hat") for predicted/estimated values. Use beta (Greek) for population parameters; b for sample estimates. Subscripts in plain text: beta_0, beta_1, b_0, b_1. Random error: epsilon.$$,
$$Confusing population parameters (beta_0, beta_1) with sample estimates (b_0, b_1). Thinking the regression equation predicts epsilon when it predicts E(y). Believing the model assumes y is normally distributed (it assumes epsilon is). Treating y_hat as the actual observed y rather than the predicted value. Confusing regression equation E(y) = beta_0 + beta_1*x with estimated regression equation y_hat = b_0 + b_1*x. Forgetting that independence of errors is an assumption. Thinking homoscedasticity means errors are zero (it means errors have constant variance).$$,
$$Conceptual questions about which symbol represents what (beta vs b, y_hat vs y). "Which of the following is an assumption of the simple linear regression model?" Identifying dependent vs independent variable in a real business scenario. Distinguishing between regression equation and estimated regression equation. Identifying which equation form represents the population vs the sample.$$),
('Quantitative Methods II', '14.2 Least Squares Method',
$$Least squares chooses b_0 and b_1 to minimize SSE = sum((y_i - y_hat_i)^2). The least-squares line always passes through (x_bar, y_bar). Sums of squares decomposition: SST = SSR + SSE where SST = sum((y_i - y_bar)^2), SSE = sum((y_i - y_hat_i)^2), SSR = sum((y_hat_i - y_bar)^2). Coefficient of determination r^2 = SSR/SST = 1 - SSE/SST, interpreted as the proportion of total variability in y explained by x; 0 <= r^2 <= 1. Sample correlation coefficient r = (sign of b_1) * sqrt(r^2).$$,
$$b_1 = sum((x_i - x_bar)(y_i - y_bar)) / sum((x_i - x_bar)^2). b_0 = y_bar - b_1*x_bar. y_hat = b_0 + b_1*x. SST = sum((y_i - y_bar)^2). SSE = sum((y_i - y_hat_i)^2). SSR = sum((y_hat_i - y_bar)^2). SST = SSR + SSE. r^2 = SSR/SST = 1 - SSE/SST. r = (sign of b_1) * sqrt(r^2).$$,
$$x_bar = sample mean of x; y_bar = sample mean of y. Use sum(...) for summation. Subscripts in plain text: x_i, y_i, y_hat_i.$$,
$$Reversing slope formula numerator/denominator. Computing b_0 as y_bar + b_1*x_bar instead of y_bar - b_1*x_bar (sign error). Putting deviations of y in the slope denominator. Calculating SSE as sum((y_i - y_bar)^2) (that is SST) or sum((y_hat_i - y_bar)^2) (that is SSR). Stating r^2 = SSE/SST instead of SSR/SST. Forgetting to apply sign of b_1 when going from r^2 to r. Computing r^2 > 1 from arithmetic error and not catching it. Predicting y_hat for x outside the observed range without flagging extrapolation.$$,
$$Given a small data set (5-10 points), compute b_0 and b_1. Given summary statistics (sum_x, sum_y, sum_xy, sum_x_squared, n), compute slope and intercept. Given a fitted regression equation, predict y_hat for a specific x. Compute r^2 from SSR and SST, or from SSE and SST. Interpret what r^2 = 0.85 means in business context. Identify the residual y_i - y_hat_i for a specific point. Use realistic business contexts: ad spending vs sales, hours studied vs exam score, square footage vs price, miles driven vs maintenance cost. Numbers should produce clean intermediate sums and slope/intercept rounding to 1-2 decimals.$$)
ON CONFLICT (course, section) DO UPDATE SET
  key_concepts = EXCLUDED.key_concepts,
  key_formulas = EXCLUDED.key_formulas,
  notation_rules = EXCLUDED.notation_rules,
  common_mistakes = EXCLUDED.common_mistakes,
  question_style = EXCLUDED.question_style;
