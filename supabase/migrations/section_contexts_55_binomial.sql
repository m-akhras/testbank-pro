INSERT INTO section_contexts (course, section, key_concepts, key_formulas, notation_rules, common_mistakes, question_style, style_rules, answer_choice_rules) VALUES
('Quantitative Methods II', '5.5 Binomial Probability Distribution',
$$A binomial experiment has four required conditions: (1) a fixed number n of trials; (2) each trial has exactly two possible outcomes, labeled success and failure; (3) the probability of success p is constant across trials; (4) trials are independent. The binomial random variable X is the number of successes in the n trials. X can take values 0, 1, 2, ..., n. The probability mass function gives P(X = k) for each value, and from it we can compute cumulative probabilities, expected value, variance, and standard deviation.$$,
$$P(X = k) = C(n, k) * p^k * (1-p)^(n-k) for k = 0, 1, ..., n. C(n, k) = n! / (k! * (n-k)!). E(X) = n*p. Var(X) = n*p*(1-p). SD(X) = sqrt(n*p*(1-p)). P(X <= k) = sum from i=0 to k of P(X = i). P(X >= k) = 1 - P(X <= k-1). P(X > k) = P(X >= k+1) = 1 - P(X <= k). f(k) is shorthand for P(X = k).$$,
$$Use n for the number of trials, p for the probability of success on a single trial, X for the count of successes, k for a specific value of X. Combinations: C(n, k) or equivalently nCk. Probabilities written as P(X = k), P(X <= k), P(X >= k), P(X > k). f(k) and P(X = k) are interchangeable. Plain-text math: write 0.20 not 20%, p^k not p superscript k, sqrt(...) for square roots.$$,
$$Computing P(X = k) using only p^k or only (1-p)^(n-k), forgetting the C(n, k) coefficient. Swapping p and (1-p) — counting failures when the question asks for successes (or vice versa). For "at least k", computing P(X = k) instead of P(X >= k). For "more than k", computing P(X >= k) instead of P(X > k) = P(X >= k+1). For "at most k", computing P(X = k) instead of P(X <= k). Computing Var(X) as n*p instead of n*p*(1-p). Confusing the formulas for E(X) and Var(X). Forgetting the independence requirement when checking if a scenario is binomial. Misidentifying scenarios with non-constant p (e.g. selecting without replacement from a small population) as binomial when they are not.$$,
$$Identification: is this scenario a binomial experiment? Compute P(X = k), P(X <= k), P(X >= k), or P(X > k) for given n, p, k. Compute E(X), Var(X), SD(X). Real-world scenarios use defective items, customer survey responses, satisfaction polls, detection systems, treatment success rates. Abstract problems use the form "Consider a binomial experiment with n = 5 and p = 0.4..."$$,
$$   A. NOTATION CONVENTIONS.
      Use n for trials, p for success probability on a single trial, X for the count of successes, k for a specific value. Write probabilities as P(X = k), P(X <= k), P(X >= k), P(X > k) — never with bare X. f(k) is acceptable shorthand for P(X = k). Use C(n, k) or nCk for combinations. Plain-text math throughout: p^k, sqrt(n*p*(1-p)), 0.20 not 20%.

   B. SCENARIO VS ABSTRACT QUESTIONS — both are encouraged, roughly 50/50.

      SCENARIO QUESTIONS use a real-world business or research context with named events: "A study finds that 30% of customers click the ad. In a random sample of 20 customers, what is the probability that exactly 5 click the ad?" Define n, p, and the success event explicitly in the stem.

      ABSTRACT QUESTIONS use the textbook form: "Consider a binomial experiment with n = [value] and p = [value]. Compute P(X = k)" or "Compute f(k)" or "Compute E(X), Var(X), SD(X)." Abstract questions are allowed up to 50% of any generated set. Mix scenario and abstract — never two abstract or two scenario in a row.

   C. PHRASING — exact-meaning rules. NON-NEGOTIABLE:
      "exactly k" means P(X = k).
      "at least k" means P(X >= k).
      "at most k" means P(X <= k).
      "more than k" means P(X > k), i.e. P(X >= k+1).
      "fewer than k" or "less than k" means P(X < k), i.e. P(X <= k-1).
      "none" means P(X = 0). "all" means P(X = n).
      The stem MUST use one of these phrasings unambiguously. The explanation MUST translate the phrasing to the corresponding probability statement before computing.

   D. SCENARIO DIVERSITY — rotate across the question set, do not reuse the same context twice in a row:
      - Defective items in a manufacturing batch
      - Customer survey or poll response (Pew, Gallup, Nielsen-style)
      - Satisfaction or approval rating
      - Online behavior (browser usage, social media reactions, streaming choices)
      - Medical or treatment success rate
      - Detection or alarm system reliability
      - Withdrawal or completion rates
      - Contribution rates (e.g., proportion of adults contributing to expenses)
      Always state n and p explicitly in the stem; define what "success" means in scenario terms.

   E. ALLOWED QUESTION TYPES — generate a mix across the set, never all the same type:

      a. Identification: "Is this a binomial experiment?" (SCENARIO ONLY)
         Stem describes a sampling or trial scenario and asks whether it satisfies the binomial conditions. Choices are full sentences: "Yes, because [reasoning]" or "No, because [reasoning citing the violated condition]".

      b. Compute P(X = k) — exact probability. (SCENARIO OR ABSTRACT)
         Stem provides n, p, and asks for the probability of exactly k successes. Choices are numeric values rounded to 4 decimal places.

      c. Compute P(X <= k), P(X >= k), P(X > k), or P(X < k) — cumulative probability. (SCENARIO OR ABSTRACT)
         Stem uses one of the exact phrasings from rule C ("at least", "at most", "more than", "fewer than", "none", "all"). Choices are numeric values rounded to 4 decimal places.

      d. Compute E(X) — expected count. (SCENARIO OR ABSTRACT)
         For scenario questions, stem asks for the expected number in scenario terms (e.g., "expected number of defective units"). Choices are numeric values, with units in scenario questions and bare numbers in abstract questions.

      e. Compute Var(X) or SD(X). (SCENARIO OR ABSTRACT)
         Stem asks for variance or standard deviation. Choices are numeric values, rounded to 2-4 decimal places. For scenario questions, units may include squared units for variance (e.g., "1.68 customers²") and base units for SD ("1.30 customers").

      f. Combined E(X) and SD(X) interpretation. (SCENARIO ONLY)
         Stem asks for both expected number and the spread, asking the student to interpret in scenario terms. Choices combine both values: "Expected: 12 customers, SD: 1.30 customers".

      g. Abstract problems with explicit n and p. (ABSTRACT ONLY)
         Stem: "Consider a binomial experiment with n = [value] and p = [value]. Compute [f(k) / P(X <= k) / E(X) / Var(X) / SD(X)]." Choices are bare numeric values without units.

      h. Tree-diagram-style 2 or 3 trial problems. (SCENARIO ONLY)
         Stem describes a small n (n = 2 or n = 3) scenario such as "Each item produced has a 0.03 probability of being defective. Two items are randomly selected." Asks the student to compute probabilities of specific outcomes. Choices are numeric values rounded to 4 decimal places.

   G. FORBIDDEN in 5.5 — these belong in later sections, do NOT generate them here:
      - Normal approximation to the binomial. The phrase "normal approximation" must NOT appear, nor any use of np >= 5 / n(1-p) >= 5 thresholds, nor any z-score calculation from a binomial scenario.
      - Continuity correction (e.g., P(X <= 3) approximated as P(Y <= 3.5) for Y normal).
      - Poisson approximation to the binomial.
      - Hypergeometric distribution (sampling without replacement from a finite population) — those scenarios should be flagged as NOT binomial in identification questions but should not appear as questions to compute hypergeometric probabilities.
      - Inference (confidence intervals, hypothesis tests) on p.$$,
$$   F. ANSWER CHOICE STYLE — strict per type:
      - Type a (identification): all four choices are full sentences. The correct answer should reference all four binomial conditions; distractors should each cite a plausibly violated condition.
      - Types b, c (probability): numeric values rounded to 4 decimal places, e.g. "0.2013", "0.8042". Distractors should reflect the common mistakes from the common_mistakes field — wrong tail direction, swapped p and (1-p), missing C(n, k) coefficient, off-by-one on cumulative bounds.
      - Type d (E(X)): numeric values with units for scenarios ("6 successes", "8.0 customers"), bare numbers for abstract ("8.0").
      - Type e (Var/SD): numeric values rounded to 2-4 decimal places. For scenarios, include units; for variance, squared units are acceptable.
      - Type f (combined): each choice combines the two values in the same labeled format, e.g. "E(X) = 8.0, SD(X) = 1.79".
      - Type g (abstract): bare numeric values, no units.
      - Type h (tree-diagram): numeric values rounded to 4 decimal places.$$);
