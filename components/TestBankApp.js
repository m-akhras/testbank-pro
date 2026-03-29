"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

// ─── KaTeX helpers ───────────────────────────────────────────────────────────
// Helper: convert plain math expression to LaTeX WITHOUT \(...\) wrapper
function innerLatex(expr) {
  let e = String(expr ?? "");
  e = e.replace(/\btheta\b/gi, '\\theta');
  e = e.replace(/\bphi\b/gi, '\\phi');
  e = e.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, '\\pi');
  const toks = [];
  function stash2(v) { toks.push(v); return '\x03'+(toks.length-1)+'\x03'; }
  function unstash2(t) { return t.replace(/\x03(\d+)\x03/g, function(_,i){ return toks[parseInt(i)]; }); }
  // Stash fn(x) calls but NOT sqrt/cbrt
  let p1; do { p1=e; e=e.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)'?\(([^()]*)\)/g, function(m){ return stash2(m); }); } while(e!==p1);
  // Stash (expr)^n
  let p2; do { p2=e; e=e.replace(/\(([^()]+)\)\^(-?[0-9a-zA-Z]+)/g, function(m){ return stash2(m); }); } while(e!==p2);
  // Stash (a)/(b) fractions inside sqrt args
  let p4; do { p4=e; e=e.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, function(m){ return stash2(m); }); } while(e!==p4);
  // Step 3: sqrt now sees flat content
  let p3;
  do { p3=e; e=e.replace(/sqrt\(([^()]*)\)/g, function(_,x){ return '\\sqrt{'+unstash2(x)+'}'; }); } while(e!==p3);
  e = unstash2(e);
  // Convert remaining math
  e = e.replace(/\(([^()]+)\)\^\((-?[0-9]+)\/([0-9]+)\)/g, function(_,b,n,d){ return '\\left('+b+'\\right)^{\\frac{'+n+'}{'+d+'}}'; });
  e = e.replace(/([a-zA-Z0-9])\^\((-?[0-9]+)\/([0-9]+)\)/g, function(_,b,n,d){ return b+'^{\\frac{'+n+'}{'+d+'}}'; });
  e = e.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g, function(_,b,x){ return b+'^{'+x+'}'; });
  e = e.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, function(_,n,d){ return '\\frac{'+n+'}{'+d+'}'; });
  e = e.replace(/\b([0-9]+)\/([0-9]+)\b/g, function(_,n,d){ return '\\frac{'+n+'}{'+d+'}'; });
  e = e.replace(/\b(sin|cos|tan|sec|csc|cot|ln|log|arcsin|arccos|arctan)\b/g, function(_,fn){ return '\\'+fn; });
  return e;
}

function toLatex(raw) {
  let s = String(raw ?? "");

  // Already has \( \) — pass through
  if (s.includes("\\(")) return s;

  const inf = "\\infty";
  const fix = x => x.replace(/\binf(inity)?\b/gi, inf).trim();

  // Integrals — convert inner expression fully before wrapping
  s = s.replace(/\bintegral\s+from\s+(\S+)\s+to\s+(\S+)\s+of\s+(.+?)\s+d([a-z])\b/gi,
    (_,a,b,f,v)=>`\\(\\int_{${fix(innerLatex(a))}}^{${fix(innerLatex(b))}} ${innerLatex(f)}\\,d${v}\\)`);
  s = s.replace(/\bintegral\s+of\s+(.+?)\s+d([a-z])\b/gi,
    (_,f,v)=>`\\(\\int ${innerLatex(f)}\\,d${v}\\)`);

  // Limits
  s = s.replace(/\blim(?:it)?\s+as\s+\(([^)]+)\)\s*(?:->|→)\s*\(([^)]+)\)/gi,
    (_,v,a)=>`\\(\\lim_{(${v})\\to(${fix(a)})}\\)`);
  s = s.replace(/\blim(?:it)?\s+as\s+([a-zA-Z,\s]+?)\s*(?:->|→)\s*([^\s,;.(]+)/gi,
    (_,v,a)=>`\\(\\lim_{${v.trim()}\\to ${fix(a)}}\\)`);

  // Derivatives
  s = s.replace(/\bd\/d([a-z])\s*\[([^\]]+)\]/g, (_,v,f)=>`\\(\\dfrac{d}{d${v}}\\left[${f}\\right]\\)`);
  s = s.replace(/\bd\/d([a-z])\s*\(([^)]+)\)/g,  (_,v,f)=>`\\(\\dfrac{d}{d${v}}\\left(${f}\\right)\\)`);
  s = s.replace(/\bd\^2([a-zA-Z])\/d([a-z])\^2\b/g, (_,y,x)=>`\\(\\dfrac{d^2${y}}{d${x}^2}\\)`);
  s = s.replace(/\bd([a-zA-Z])\/d([a-z])\b/g,    (_,y,x)=>`\\(\\dfrac{d${y}}{d${x}}\\)`);
  s = s.replace(/\bd\/d([a-z])\b/g,              (_,v)  =>`\\(\\dfrac{d}{d${v}}\\)`);

  // Partial derivatives
  s = s.replace(/∂([a-zA-Z0-9]*)\/∂([a-z])/g, (_,f,v)=>`\\(\\dfrac{\\partial ${f}}{\\partial ${v}}\\)`);

  // Trig & log functions with args
  s = s.replace(/\b(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|ln|log)\(([^)]+)\)/g,
    (_,fn,arg)=>`\\(\\${fn}(${innerLatex(arg)})\\)`);

  // Pre-process for sqrt: temporarily replace f'(x), g(x) style calls and (expr)^n
  // so sqrt() sees flat content with no nested parens
  const tokens = [];
  function stash(val) { tokens.push(val); return `\x02${tokens.length-1}\x02`; }
  function unstash(t) { return t.replace(/\x02(\d+)\x02/g, (_,i) => tokens[parseInt(i)]); }

  // Stash (expr)^n — innermost first
  let pp;
  do {
    pp = s;
    s = s.replace(/\(([^()]+)\)\^(\{[^}]+\}|-?[0-9]+(?:\.[0-9]+)?|[a-zA-Z])/g,
      (m) => stash(m));
  } while (s !== pp);

  // Stash fn(expr) calls — including single-letter like f(x), g(x), but NOT sqrt/cbrt
  s = s.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)'?\(([^()]*)\)/g, function(m, fn) {
    if (fn === 'sqrt' || fn === 'cbrt') return m;
    return stash(m);
  });

  // NOW sqrt can see flat content
  let prev;
  do {
    prev = s;
    s = s.replace(/sqrt\(([^()]*)\)/g, (_, x) => {
      const inner = unstash(x);
      return `\\(\\sqrt{${innerLatex(inner)}}\\)`;
    });
  } while (s !== prev);
  s = s.replace(/cbrt\(([^()]*)\)/g, (_, x) => `\\(\\sqrt[3]{${unstash(x)}}\\)`);

  // Unstash remaining tokens
  s = unstash(s);

  // Powers with fractional/complex exponents
  s = s.replace(/([a-zA-Z0-9])\^\(([^)]+)\)/g, (_,base,exp) => {
    const expLatex = exp.replace(/(-?[0-9]+)\/([0-9]+)/g, (_,a,b) => `\\frac{${a}}{${b}}`);
    return `\\(${base}^{${expLatex}}\\)`;
  });
  s = s.replace(/([a-zA-Z0-9])\^\{([^}]+)\}/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);

  // frac(a,b)
  s = s.replace(/\bfrac\(([^,)]+),\s*([^)]+)\)/g, (_,a,b)=>`\\(\\dfrac{${a.trim()}}{${b.trim()}}\\)`);

  // Inline fractions
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)\^([0-9]+)/g, (_,a,b,n)=>`\\(\\dfrac{${a}}{(${b})^{${n}}}\\)`);
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\(([^()]+)\)\/([a-zA-Z0-9][a-zA-Z0-9^+\-*]*)/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\b([a-zA-Z0-9]+\^[0-9]+)\/([a-zA-Z0-9]+(?:\^[0-9]+)?)\b/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\b([0-9]+)\/([0-9]+)\b/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);

  // e^(expr)
  s = s.replace(/\be\^\(([^)]+)\)/g, (_,x)=>`\\(e^{${x}}\\)`);
  s = s.replace(/\be\^(-?[a-zA-Z0-9]+)\b/g, (_,x)=>`\\(e^{${x}}\\)`);

  // Sums and products
  s = s.replace(/\bsum\s+from\s+([a-z])=(\S+)\s+to\s+(\S+)/gi,
    (_,v,a,b)=>`\\(\\sum_{${v}=${a}}^{${fix(b)}}\\)`);
  s = s.replace(/\bprod(?:uct)?\s+from\s+([a-z])=(\S+)\s+to\s+(\S+)/gi,
    (_,v,a,b)=>`\\(\\prod_{${v}=${a}}^{${fix(b)}}\\)`);

  // Simple powers
  s = s.replace(/([a-zA-Z0-9])\^(-?[0-9]+(?:\.[0-9]+)?)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);
  s = s.replace(/([a-zA-Z])\^([a-zA-Z][a-zA-Z0-9]*)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);

  // Subscripts
  s = s.replace(/\b([a-zA-Z])_\{([^}]+)\}/g, (_,b,sub)=>`\\(${b}_{${sub}}\\)`);
  s = s.replace(/\b([a-zA-Z])_([0-9a-zA-Z])\b/g, (_,b,sub)=>`\\(${b}_{${sub}}\\)`);

  // Vectors
  s = s.replace(/<(-?[^<>]+(?:,[^<>]+)+)>/g, (_,inner)=>`\\(\\langle ${inner} \\rangle\\)`);

  // Absolute value
  s = s.replace(/\|([a-zA-Z0-9 +\-*/^._]+)\|/g, (_,x)=>`\\(\\left|${x}\\right|\\)`);

  // Symbols — use lookahead/lookbehind to catch pi after ( like (pi/6)
  s = s.replace(/\binfinity\b/gi, `\\(${inf}\\)`);
  s = s.replace(/\binf\b/g, `\\(${inf}\\)`);
  s = s.replace(/→/g, "\\(\\to\\)");
  s = s.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, "\\(\\pi\\)");
  s = s.replace(/\btheta\b/gi, "\\(\\theta\\)");
  s = s.replace(/\brho\b/gi, "\\(\\rho\\)");
  s = s.replace(/\bphi\b/gi, "\\(\\phi\\)");
  s = s.replace(/\blambda\b/gi, "\\(\\lambda\\)");
  s = s.replace(/\bsigma\b/gi, "\\(\\sigma\\)");
  s = s.replace(/\bdelta\b/gi, "\\(\\delta\\)");
  s = s.replace(/\balpha\b/gi, "\\(\\alpha\\)");
  s = s.replace(/\bbeta\b/gi, "\\(\\beta\\)");
  s = s.replace(/\bgamma\b/gi, "\\(\\gamma\\)");
  s = s.replace(/\btimes\b/g, "\\(\\times\\)");
  s = s.replace(/\bcdot\b/g, "\\(\\cdot\\)");

  return s;
}

function tokenize(raw) {
  const s = toLatex(String(raw ?? ""));
  const out = [];
  const re = /\\\((.+?)\\\)/gs;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ kind:"text", val: s.slice(last, m.index) });
    out.push({ kind:"math", val: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ kind:"text", val: s.slice(last) });
  return out;
}

function renderMath(latex) {
  if (!window.katex) return null;
  try {
    return window.katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      strict: false,
      trust: true,
      macros: {
        "\\dfrac": "\\frac",
      }
    });
  } catch(e) {
    // Strip problematic parts and try simpler render
    try {
      const safe = latex.replace(/\\left|\\right/g,"");
      return window.katex.renderToString(safe, { throwOnError:false, strict:false });
    } catch {
      return `<span style="color:#e8e8e0">${latex}</span>`;
    }
  }
}

function MathText({ children }) {
  const ref = useRef(null);
  const src = String(children ?? "");
  useEffect(() => {
    if (!ref.current) return;
    const render = () => {
      if (!window.katex) { setTimeout(render, 80); return; }
      ref.current.innerHTML = tokenize(src).map(tok => {
        if (tok.kind === "math") {
          return renderMath(tok.val) ?? tok.val;
        }
        return tok.val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      }).join("");
    };
    render();
  }, [src]);
  return <span ref={ref}>{src}</span>;
}

// ─── Course data ──────────────────────────────────────────────────────────────
const COURSES = {
  "Calculus 1": {
    color: "#10b981",
    chapters: [
      { ch:"1", title:"Functions and Models", sections:["1.1 Four Ways to Represent a Function","1.2 Mathematical Models: A Catalog of Essential Functions","1.3 New Functions from Old Functions","1.4 Exponential Functions","1.5 Inverse Functions and Logarithms"] },
      { ch:"2", title:"Limits and Derivatives", sections:["2.2 The Limit of a Function","2.3 Calculating Limits Using the Limit Laws","2.5 Continuity","2.6 Limits at Infinity; Horizontal Asymptotes","2.8 The Derivative as a Function"] },
      { ch:"3", title:"Differentiation Rules", sections:["3.1 Derivatives of Polynomials and Exponential Functions","3.2 The Product and Quotient Rules","3.3 Derivatives of Trigonometric Functions","3.4 The Chain Rule","3.5 Implicit Differentiation","3.6 Derivatives of Logarithmic and Inverse Trigonometric Functions"] },
      { ch:"4", title:"Applications of Differentiation", sections:["4.1 Maximum and Minimum Values","4.2 The Mean Value Theorem","4.3 What Derivatives Tell Us about the Shape of a Graph","4.4 Indeterminate Forms and l'Hopital's Rule","4.9 Antiderivatives"] },
      { ch:"5", title:"Integrals", sections:["5.2 The Definite Integral","5.3 The Fundamental Theorem of Calculus","5.4 Indefinite Integrals and the Net Change Theorem","5.5 The Substitution Rule"] },
    ],
  },
  "Calculus 2": {
    color: "#8b5cf6",
    chapters: [
      { ch:"3", title:"Differentiation Rules (cont.)", sections:["3.9 Related Rates","3.10 Linear Approximations and Differentials","3.11 Hyperbolic Functions"] },
      { ch:"6", title:"Applications of Integration", sections:["6.1 Areas Between Curves","6.2 Volumes","6.3 Volumes by Cylindrical Shells"] },
      { ch:"7", title:"Techniques of Integration", sections:["7.1 Integration by Parts","7.2 Trigonometric Integrals","7.3 Trigonometric Substitution","7.4 Integration of Rational Functions by Partial Fractions","7.8 Improper Integrals"] },
      { ch:"8", title:"Further Applications of Integration", sections:["8.1 Arc Length","8.2 Surface Area of Revolution"] },
      { ch:"11", title:"Sequences, Series, and Power Series", sections:["11.1 Sequences","11.2 Series","11.3 The Integral Test and Estimates of Sums","11.4 The Comparison Tests","11.5 Alternating Series and Absolute Convergence","11.6 The Ratio and Root Tests","11.8 Power Series","11.10 Taylor and Maclaurin Series"] },
    ],
  },
  "Calculus 3": {
    color: "#f59e0b",
    chapters: [
      { ch:"12", title:"Vectors and the Geometry of Space", sections:["12.1 Three-Dimensional Coordinate Systems","12.2 Vectors","12.3 The Dot Product","12.4 The Cross Product","12.5 Equations of Lines and Planes"] },
      { ch:"14", title:"Partial Derivatives", sections:["14.1 Functions of Several Variables","14.2 Limits and Continuity","14.3 Partial Derivatives","14.4 Tangent Planes and Linear Approximations","14.5 The Chain Rule","14.6 Directional Derivatives and the Gradient Vector","14.7 Maximum and Minimum Values"] },
      { ch:"15", title:"Multiple Integrals", sections:["15.1 Double Integrals over Rectangles","15.2 Double Integrals over General Regions","15.3 Double Integrals in Polar Coordinates","15.5 Surface Area","15.6 Triple Integrals"] },
      { ch:"16", title:"Vector Calculus", sections:["16.1 Vector Fields","16.2 Line Integrals"] },
    ],
  },
  "Quantitative Methods I": {
    color: "#06b6d4",
    chapters: [
      { ch:"1", title:"Data and Statistics", sections:["1.1 Applications in Business and Economics","1.2 Data","1.3 Data Sources","1.4 Descriptive Statistics","1.5 Statistical Inference"] },
      { ch:"2", title:"Descriptive Statistics: Tabular and Graphical Displays", sections:["2.1 Summarizing Data for a Categorical Variable","2.2 Summarizing Data for a Quantitative Variable","2.3 Summarizing Data for Two Variables Using Tables","2.4 Summarizing Data for Two Variables Using Graphical Displays","2.5 Data Visualization: Best Practices"] },
      { ch:"3", title:"Descriptive Statistics: Numerical Measures", sections:["3.1 Measures of Location","3.2 Measures of Variability","3.3 Measures of Distribution Shape, Relative Location, and Outliers","3.4 Five-Number Summaries and Boxplots","3.5 Measures of Association Between Two Variables","3.6 Data Dashboards and Measures of Performance"] },
    ],
  },
  "Quantitative Methods II": {
    color: "#f43f5e",
    chapters: [
      { ch:"4", title:"Introduction to Probability", sections:["4.1 Experiments, Counting Rules, and Assigning Probabilities","4.2 Events and Their Probabilities","4.3 Some Basic Relationships of Probability","4.4 Conditional Probability","4.5 Bayes Theorem"] },
      { ch:"5", title:"Discrete Probability Distributions", sections:["5.1 Random Variables","5.2 Developing Discrete Probability Distributions","5.3 Expected Value and Variance","5.4 Bivariate Distributions, Covariance, and Financial Portfolios","5.5 Binomial Probability Distribution","5.6 Poisson Probability Distribution","5.7 Hypergeometric Probability Distribution"] },
      { ch:"6", title:"Continuous Probability Distributions", sections:["6.1 Uniform Probability Distribution","6.2 Normal Probability Distribution","6.3 Normal Approximation of Binomial Probabilities","6.4 Exponential Probability Distribution"] },
      { ch:"7", title:"Sampling and Sampling Distributions", sections:["7.1 The Electronics Associates Sampling Problem","7.2 Selecting a Sample","7.3 Point Estimation","7.4 Introduction to Sampling Distributions","7.5 Sampling Distribution of x-bar","7.6 Sampling Distribution of p-bar"] },
      { ch:"8", title:"Interval Estimation", sections:["8.1 Population Mean: sigma Known","8.2 Population Mean: sigma Unknown","8.3 Determining the Sample Size","8.4 Population Proportion"] },
      { ch:"9", title:"Hypothesis Tests", sections:["9.1 Developing Null and Alternative Hypotheses","9.2 Type I and Type II Errors","9.3 Population Mean: sigma Known","9.4 Population Mean: sigma Unknown","9.5 Population Proportion","9.6 Hypothesis Testing and Decision Making","9.7 Calculating the Probability of Type II Errors","9.8 Determining the Sample Size for a Hypothesis Test"] },
      { ch:"14", title:"Simple Linear Regression", sections:["14.1 Simple Linear Regression Model","14.2 Least Squares Method","14.3 Coefficient of Determination","14.4 Model Assumptions","14.5 Testing for Significance","14.6 Using the Estimated Regression Equation for Estimation and Prediction","14.7 Excel and Tools for Regression Analysis","14.8 Residual Analysis: Validating Model Assumptions","14.9 Residual Analysis: Outliers and Influential Observations"] },
    ],
  },
  "Discrete Mathematics": {
    color: "#a855f7",
    chapters: [
      { ch:"1", title:"Speaking Mathematically", sections:["1.1 Variables","1.2 The Language of Sets","1.3 The Language of Relations and Functions","1.4 The Language of Graphs"] },
      { ch:"2", title:"The Logic of Compound Statements", sections:["2.1 Logical Form and Logical Equivalence","2.2 Conditional Statements","2.3 Valid and Invalid Arguments","2.4 Application: Digital Logic Circuits","2.5 Application: Number Systems and Circuits for Addition"] },
      { ch:"3", title:"The Logic of Quantified Statements", sections:["3.1 Predicates and Quantified Statements I","3.2 Predicates and Quantified Statements II","3.3 Statements with Multiple Quantifiers","3.4 Arguments with Quantified Statements"] },
      { ch:"4", title:"Elementary Number Theory and Methods of Proof", sections:["4.1 Direct Proof and Counterexample I: Introduction","4.2 Direct Proof and Counterexample II: Writing Advice","4.3 Direct Proof and Counterexample III: Rational Numbers","4.4 Direct Proof and Counterexample IV: Divisibility","4.5 Direct Proof and Counterexample V: Division into Cases","4.6 Direct Proof and Counterexample VI: Floor and Ceiling","4.7 Indirect Argument: Contradiction and Contraposition","4.8 Indirect Argument: Two Classical Theorems","4.9 Application: Algorithms","4.10 Application: Handshaking"] },
      { ch:"5", title:"Sequences, Mathematical Induction, and Recursion", sections:["5.1 Sequences","5.2 Mathematical Induction I: Proving Formulas","5.3 Mathematical Induction II: Applications","5.4 Strong Mathematical Induction and the Well-Ordering Principle","5.5 Application: Correctness of Algorithms","5.6 Defining Sequences Recursively","5.7 Solving Recurrence Relations by Iteration","5.8 Second-Order Linear Homogeneous Recurrence Relations","5.9 General Recursive Definitions and Structural Induction"] },
      { ch:"6", title:"Set Theory", sections:["6.1 Set Theory: Definitions and the Element Method of Proof","6.2 Properties of Sets","6.3 Disproofs and Algebraic Proofs","6.4 Boolean Algebras, Russell's Paradox, and the Halting Problem"] },
      { ch:"7", title:"Properties of Functions", sections:["7.1 Functions Defined on General Sets","7.2 One-to-One, Onto, and Inverse Functions","7.3 Composition of Functions","7.4 Cardinality with Applications to Computability"] },
      { ch:"8", title:"Properties of Relations", sections:["8.1 Relations on Sets","8.2 Reflexivity, Symmetry, and Transitivity","8.3 Equivalence Relations","8.4 Modular Arithmetic with Applications to Cryptography","8.5 Partial Order Relations"] },
      { ch:"9", title:"Counting and Probability", sections:["9.1 Introduction to Probability","9.2 Possibility Trees and the Multiplication Rule","9.3 Counting Elements of Disjoint Sets: The Addition Rule","9.4 The Pigeonhole Principle","9.5 Counting Subsets of a Set: Combinations","9.6 r-Combinations with Repetition Allowed","9.7 Pascal's Formula and the Binomial Theorem","9.8 Probability Axioms and Expected Value","9.9 Conditional Probability, Bayes' Formula, and Independent Events"] },
      { ch:"10", title:"Theory of Graphs and Trees", sections:["10.1 Trails, Paths, and Circuits","10.2 Matrix Representations of Graphs","10.3 Isomorphisms of Graphs","10.4 Trees: Examples and Basic Properties","10.5 Rooted Trees","10.6 Spanning Trees and a Shortest Path Algorithm"] },
      { ch:"11", title:"Analysis of Algorithm Efficiency", sections:["11.1 Real-Valued Functions of a Real Variable and Their Graphs","11.2 O-, Omega-, and Theta-Notations","11.3 Application: Analysis of Algorithm Efficiency I","11.4 Exponential and Logarithmic Functions: Graphs and Orders","11.5 Application: Analysis of Algorithm Efficiency II"] },
      { ch:"12", title:"Regular Expressions and Finite-State Automata", sections:["12.1 Formal Languages and Regular Expressions","12.2 Finite-State Automata","12.3 Simplifying Finite-State Automata"] },
    ],
  },
};

const QTYPES = ["Multiple Choice","Free Response","True/False","Fill in the Blank","Formula","Branched"];
const DIFFICULTIES = ["Easy","Medium","Hard","Mixed"];
const VERSIONS = ["A","B","C","D","E"];

// ─── Supabase DB helpers ──────────────────────────────────────────────────────
async function loadBank() {
  try {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(r => ({ ...r.data, id: r.id, createdAt: new Date(r.created_at).getTime() }));
  } catch (e) { console.error("loadBank error:", e); return []; }
}

async function saveQuestion(q) {
  try {
    const { error } = await supabase.from("questions").upsert({
      id: q.id,
      course: q.course,
      section: q.section,
      type: q.type,
      difficulty: q.difficulty,
      data: q,
    });
    if (error) throw error;
  } catch (e) { console.error("saveQuestion error:", e); }
}

async function deleteQuestion(id) {
  try {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) throw error;
  } catch (e) { console.error("deleteQuestion error:", e); }
}

async function saveExam(name, versions) {
  try {
    const { data, error } = await supabase.from("exams").insert({
      name,
      versions,
      created_at: new Date().toISOString(),
    }).select();
    if (error) throw error;
    return data[0];
  } catch (e) { console.error("saveExam error:", e); return null; }
}

async function loadExams() {
  try {
    const { data, error } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { console.error("loadExams error:", e); return []; }
}

async function logExport(examName, format, versionLabel) {
  try {
    await supabase.from("export_history").insert({
      exam_name: examName,
      format,
      version_label: versionLabel,
      exported_at: new Date().toISOString(),
    });
  } catch (e) { console.error("logExport error:", e); }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function escapeXML(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// Convert plain-text math to HTML for Canvas QTI display
// Convert plain-text math expression to LaTeX string
// Convert plain-text math to simple HTML entities for Canvas QTI (proven to work)
function mathToHTML(s) {
  let r = String(s ?? "");

  // Greek letters
  r = r.replace(/\btheta\b/gi, '&theta;');
  r = r.replace(/\bphi\b/gi, '&phi;');
  r = r.replace(/\bpi\b/g, '&pi;');
  r = r.replace(/\brho\b/gi, '&rho;');
  r = r.replace(/\balpha\b/gi, '&alpha;');
  r = r.replace(/\bbeta\b/gi, '&beta;');
  r = r.replace(/\bgamma\b/gi, '&gamma;');
  r = r.replace(/\bdelta\b/gi, '&delta;');
  r = r.replace(/\blambda\b/gi, '&lambda;');
  r = r.replace(/\bsigma\b/gi, '&sigma;');
  r = r.replace(/\binfinity\b/gi, '&infin;');
  r = r.replace(/\binf\b/g, '&infin;');

  // sqrt — innermost first
  let prev;
  do {
    prev = r;
    r = r.replace(/sqrt\(([^()]+)\)/g, (_, inner) => `&radic;(${inner})`);
  } while (r !== prev);

  // integral from a to b of
  r = r.replace(/integral from ([^\s]+) to ([^\s]+) of/gi,
    (_, a, b) => `&int;<sub>${a}</sub><sup>${b}</sup>`);
  r = r.replace(/\bintegral of\b/gi, '&int;');

  // lim as x->a
  r = r.replace(/lim as ([a-z])\s*->\s*([^\s,.(]+)/gi,
    (_, v, a) => `lim<sub>${v}&rarr;${a}</sub>`);

  // (expr)^(n/m) fractional exponent
  r = r.replace(/\(([^()]+)\)\^\(([0-9-]+)\/([0-9]+)\)/g,
    (_, b, n, d) => `(${b})<sup>${n}/${d}</sup>`);

  // (expr)^n
  r = r.replace(/\(([^()]+)\)\^(-?[0-9a-zA-Z]+)/g,
    (_, b, e) => `(${b})<sup>${e}</sup>`);

  // x^(n/m)
  r = r.replace(/([a-zA-Z0-9])\^\(([0-9-]+)\/([0-9]+)\)/g,
    (_, b, n, d) => `${b}<sup>${n}/${d}</sup>`);

  // x^(expr)
  r = r.replace(/([a-zA-Z0-9])\^\(([^)]+)\)/g,
    (_, b, e) => `${b}<sup>${e}</sup>`);

  // x^2
  r = r.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g,
    (_, b, e) => `${b}<sup>${e}</sup>`);

  // (a)/(b) fraction → &frasl;
  r = r.replace(/\(([^()]+)\)\/\(([^()]+)\)/g,
    (_, n, d) => `(${n})&frasl;(${d})`);

  // number/number
  r = r.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_, n, d) => `${n}&frasl;${d}`);

  // * → &middot;
  r = r.replace(/\*/g, '&middot;');

  // >= <=
  r = r.replace(/<=/g, '&le;').replace(/>=/g, '&ge;');

  return r;
}

// Difficulty pattern: cycle Easy→Medium→Hard for any count
function difficultyPattern(count) {
  const cycle = ["Easy", "Medium", "Hard"];
  return Array.from({length: count}, (_, i) => cycle[i % 3]);
}

function buildQTI(questions, course, vLabel, useGroups=false, pointsPerQ=1) {
  const canvasQ = questions.filter(q => q.type !== "Branched");

  function makeItem(q, id, num) {
    const qhtml = `Q${num}. ` + mathToHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPerQ}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="c${ci}"><material><mattext texttype="text/html">${mathToHTML(c)}</mattext></material></response_label>`
      ).join("");
      const correct = q.choices.findIndex(c => c === q.answer);
      return `<item ident="${id}" title="Q${num}">
  ${meta}
  <presentation>
    <material><mattext texttype="text/html">${qhtml}</mattext></material>
    <response_lid ident="r${id}" rcardinality="Single">
      <render_choice shuffle="false">${cx}</render_choice>
    </response_lid>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="${pointsPerQ}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
    <respcondition continue="No">
      <conditionvar><varequal respident="r${id}">c${correct}</varequal></conditionvar>
      <setvar action="Set" varname="SCORE">${pointsPerQ}</setvar>
    </respcondition>
  </resprocessing>
</item>`;
    }
    return `<item ident="${id}" title="Q${num}">
  ${meta}
  <presentation>
    <material><mattext texttype="text/html">${qhtml}</mattext></material>
    <response_str ident="r${id}" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="${pointsPerQ}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
  </resprocessing>
</item>`;
  }

  if (!useGroups) {
    const items = canvasQ.map((q,i) => makeItem(q, `q${i+1}`, i+1)).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment title="${escapeXML(course)} — Version ${vLabel}" ident="assessment1">
    <section ident="root_section">
${items}
    </section>
  </assessment>
</questestinterop>`;
  }

  // Canvas Classic Quizzes grouped format
  // Each section = one Canvas question group
  const sectionMap = {};
  canvasQ.forEach((q,i) => {
    const sec = q.section || "General";
    if (!sectionMap[sec]) sectionMap[sec] = [];
    sectionMap[sec].push({q, globalIdx: i});
  });

  const groupSections = Object.entries(sectionMap).map(([sec, qs], gi) => {
    const pickCount = qs.length; // pick all — user can reduce in Canvas
    const items = qs.map(({q, globalIdx}, li) =>
      makeItem(q, `g${gi}q${li+1}`, globalIdx+1)
    ).join("\n");
    return `    <section ident="group_${gi}" title="${escapeXML(sec)}">
      <selection_ordering>
        <selection>
          <selection_number>${pickCount}</selection_number>
          <selection_extension>
            <points_per_item>${pointsPerQ}</points_per_item>
          </selection_extension>
        </selection>
      </selection_ordering>
${items}
    </section>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment title="${escapeXML(course)} — Version ${vLabel}" ident="assessment1">
    <section ident="root_section">
${groupSections}
    </section>
  </assessment>
</questestinterop>`;
}


// ─── Math text → OMML (Word native math) converter ───────────────────────────
function mathToOmml(raw) {
  const s = String(raw ?? "");

  // OMML builders
  const X = t => t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const oT = t => `<m:r><m:t xml:space="preserve">${X(t)}</m:t></m:r>`;
  const oSqrt = inner => `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${inner}</m:e></m:rad>`;
  const oSup = (base, exp) => `<m:sSup><m:e>${base}</m:e><m:sup>${exp}</m:sup></m:sSup>`;
  const oFrac = (n, d) => `<m:f><m:num>${n}</m:num><m:den>${d}</m:den></m:f>`;
  const oInt = (a, b) => `<m:nary><m:naryPr><m:chr m:val="\u222B"/><m:limLoc m:val="subSup"/></m:naryPr><m:sub>${oT(a)}</m:sub><m:sup>${oT(b)}</m:sup><m:e>${oT(" ")}</m:e></m:nary>`;

  // Step 1: replace Greek letters and symbols
  let w = s
    .replace(/\btheta\b/gi, 'θ')
    .replace(/\bphi\b/gi, 'φ')
    .replace(/\brho\b/gi, 'ρ')
    .replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, 'π')
    .replace(/\balpha\b/gi, 'α')
    .replace(/\bbeta\b/gi, 'β')
    .replace(/\bgamma\b/gi, 'γ')
    .replace(/\bdelta\b/gi, 'δ')
    .replace(/\blambda\b/gi, 'λ')
    .replace(/\bsigma\b/gi, 'σ')
    .replace(/\binfinity\b/gi, '∞')
    .replace(/\binf\b/g, '∞');

  // Step 2: parse and build OMML directly
  // We'll do a single-pass conversion using a segment array
  // Each segment is either {type:'text', val} or {type:'sqrt'|'sup'|'frac'|'int', ...}

  // Process in priority order using replacements into a neutral token array
  // Use simple unique separator strings unlikely to appear in math text
  const SEP = '\x01';
  const tokens = [];

  function addToken(obj) { tokens.push(obj); return SEP + (tokens.length-1) + SEP; }

  // * → · (before tokenizing)
  w = w.replace(/\s*\*\s*/g, '·');

  // Stash fn(x) calls like f(x), g'(y), sin(x) — BEFORE exponent processing
  // so (f'(x))^2 becomes (TOKEN)^2 which exponent handler can match
  let prevFn;
  do {
    prevFn = w;
    w = w.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)('?)\(([^()]*)\)/g,
      (_, fn, prime, arg) => addToken({t:'text', val: `${fn}${prime}(${arg})`}));
  } while (w !== prevFn);

  // Process exponents FIRST (innermost), then sqrt can consume the results

  // (expr)^(n/m)
  let prev2;
  do {
    prev2 = w;
    w = w.replace(/(\([^()]+\)|\x01\d+\x01)\^\(([0-9]+)\/([0-9]+)\)/g,
      (_,base,n,d) => addToken({t:'sup', base, exp:`${n}/${d}`}));
    // (expr)^n
    w = w.replace(/(\([^()]+\)|\x01\d+\x01)\^(-?[0-9a-zA-Zα-ωθφ]+)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^(n/m)
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\(([0-9]+)\/([0-9]+)\)/g,
      (_,base,n,d) => addToken({t:'sup', base, exp:`${n}/${d}`}));
    // x^(expr)
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\(([^)]+)\)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^{expr}
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\{([^}]+)\}/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^2 or x^n
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^(-?[0-9]+(?:\.[0-9]+)?)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    w = w.replace(/([a-zA-Z])\^([a-zA-Z][a-zA-Z0-9]*)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
  } while (w !== prev2);

  // NOW handle sqrt — fn calls and exponents already tokenized so parens are flat
  let prev;
  do {
    prev = w;
    w = w.replace(/sqrt\(([^()]*)\)/g, (_,inner) => addToken({t:'sqrt', inner}));
  } while (w !== prev);

  // integral from a to b of
  w = w.replace(/integral from ([^\s]+) to ([^\s]+) of/gi,
    (_,a,b) => addToken({t:'int', a, b}));

  // (a)/(b) fraction — horizontal bar
  w = w.replace(/\(([^()]+)\)\/\(([^()]+)\)/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/number
  w = w.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // Now render: split w by SEP tokens and build OMML
  function renderToken(idx) {
    const tok = tokens[idx];
    if (!tok) return oT('?');
    if (tok.t === 'text') return oT(tok.val);
    if (tok.t === 'sqrt') return oSqrt(renderSegment(tok.inner));
    if (tok.t === 'sup') return oSup(renderSegment(tok.base), renderSegment(tok.exp));
    if (tok.t === 'frac') return oFrac(renderSegment(tok.n), renderSegment(tok.d));
    if (tok.t === 'int') return oInt(tok.a, tok.b);
    return oT('?');
  }

  function renderSegment(seg) {
    if (!seg) return '';
    const parts = seg.split(/\x01(\d+)\x01/);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { if (parts[i]) out += oT(parts[i]); }
      else out += renderToken(parseInt(parts[i]));
    }
    return out;
  }

  const inner = renderSegment(w);
  // Strip any leaked control characters that would break XML
  const clean = inner.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return `<m:oMath>${clean}</m:oMath>`;
}

// ─── Build proper .docx file ──────────────────────────────────────────────────
async function buildDocx(questions, course, vLabel, classSection=null) {
  // We build the docx XML manually for full math support
  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"`;

  function para(text, opts={}) {
    const {bold=false, size=24, color="000000", indent=0, spacing=160} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}${bold?'<w:jc w:val="left"/>' :''}</w:pPr>`;
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</w:t></w:r></w:p>`;
  }

  function mathPara(text, opts={}) {
    const {indent=0} = opts;
    const ppr = indent ? `<w:pPr><w:ind w:left="${indent}"/><w:spacing w:after="80"/></w:pPr>` : `<w:pPr><w:spacing w:after="80"/></w:pPr>`;
    try {
      const omml = mathToOmml(text);
      return `<w:p>${ppr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
    } catch(e) {
      const safe = String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `<w:p>${ppr}<w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    }
  }

  let body = "";
  // Title
  const titleLabel = classSection ? `Section ${classSection} — Version ${vLabel}` : `Exam Version ${vLabel}`;
  body += para(`${course} — ${titleLabel}`, {bold:true, size:32, spacing:120});
  body += para("Stewart: Early Transcendentals, 9th Edition", {size:22, color:"555555", spacing:200});

  questions.forEach((q, i) => {
    const num = i + 1;
    if (q.type === "Branched") {
      body += para(`${num}. [${q.section}] — ${q.difficulty}`, {bold:true, size:24, spacing:80});
      body += mathPara(`Given: ${q.stem}`);
      (q.parts||[]).forEach((p, pi) => {
        body += para(`(${String.fromCharCode(97+pi)})`, {indent:360, size:22, spacing:60});
        body += mathPara(p.question, {indent:360});
        if (p.choices) p.choices.forEach((c,ci) => {
          body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:720});
        });
        if (p.answer) body += para(`Answer: ${p.answer}`, {indent:360, size:22, color:"1a7a4a", spacing:80});
      });
    } else {
      body += para(`${num}. [${q.section}] — ${q.type} — ${q.difficulty}`, {bold:true, size:24, spacing:80});
      body += mathPara(q.question);
      if (q.type==="Formula" && q.variables) {
        body += para(`Variables: ${q.variables.map(v=>v.name+"∈["+v.min+","+v.max+"]").join(", ")}`, {indent:360, size:20, color:"555555", spacing:60});
      }
      if (q.choices) q.choices.forEach((c,ci) => {
        body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:360});
      });
      if (q.answer) body += mathPara(`✓ Answer: ${q.answer}`, {indent:0, size:22, color:"1a7a4a", spacing:60});
      if (q.explanation) body += mathPara(`Note: ${q.explanation}`, {indent:0, size:20, color:"666666", spacing:120});
    }
    body += `<w:p><w:pPr><w:spacing w:after="40"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="DDDDDD"/></w:pBdr></w:pPr></w:p>`;
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns} mc:Ignorable="w14 wp14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
</w:sectPr>
</w:body>
</w:document>`;

  // Build minimal docx zip using JSZip loaded from CDN
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file("word/document.xml", documentXml);

  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

  const blob = await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  return blob;
}

function dlFile(content, name, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content],{type}));
  a.download = name; a.click();
}

function dlBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
}

// ─── Wrap QTI XML in Canvas-compatible ZIP ────────────────────────────────────
async function buildQTIZip(qtiXml, title) {
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
  const assessmentId = `assessment_${Date.now()}`;
  const qtiFile = `${safeTitle}_questions.xml`;

  // imsmanifest.xml — Canvas QTI 1.2 format
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${assessmentId}_manifest"
  xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"
  xmlns:lom="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest"
  xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd">
  <metadata>
    <schema>IMS Content</schema>
    <schemaversion>1.1</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="${assessmentId}" type="imsqti_xmlv1p2">
      <file href="${qtiFile}"/>
    </resource>
  </resources>
</manifest>`;
  const zip = new window.JSZip();
  zip.file("imsmanifest.xml", manifest);
  zip.file(qtiFile, qtiXml);

  return await zip.generateAsync({type:"blob", mimeType:"application/zip"});
}

// ─── Compare-mode exports (grouped by question number across versions) ─────────
function buildQTICompare(versions, course, useGroups=false, pointsPerQ=1) {
  const numQ = versions[0]?.questions?.length || 0;
  const vLabels = versions.map(v => v.label).join(", ");

  function makeCompareItem(q, id, title, qnum, vLabel) {
    const qhtml = mathToHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPerQ}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="c${ci}"><material><mattext texttype="text/html">${mathToHTML(c)}</mattext></material></response_label>`
      ).join("");
      const correct = q.choices.findIndex(c => c === q.answer);
      return `<item ident="${id}" title="${escapeXML(title)}">
  ${meta}
  <presentation>
    <material><mattext texttype="text/html">${qhtml}</mattext></material>
    <response_lid ident="r${id}" rcardinality="Single">
      <render_choice shuffle="false">${cx}</render_choice>
    </response_lid>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="${pointsPerQ}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
    <respcondition continue="No">
      <conditionvar><varequal respident="r${id}">c${correct}</varequal></conditionvar>
      <setvar action="Set" varname="SCORE">${pointsPerQ}</setvar>
    </respcondition>
  </resprocessing>
</item>`;
    }
    return `<item ident="${id}" title="${escapeXML(title)}">
  ${meta}
  <presentation>
    <material><mattext texttype="text/html">${qhtml}</mattext></material>
    <response_str ident="r${id}" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="${pointsPerQ}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
  </resprocessing>
</item>`;
  }

  if (!useGroups) {
    // Flat: Q1-VA, Q1-VB, Q2-VA, Q2-VB...
    let items = "";
    for (let qi = 0; qi < numQ; qi++) {
      versions.forEach(v => {
        const q = v.questions[qi];
        if (!q || q.type === "Branched") return;
        const id = `q${qi+1}_v${v.label}`;
        items += makeCompareItem(q, id, `Q${qi+1} Version ${v.label}`, qi+1, v.label) + "\n";
      });
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment title="${escapeXML(course)} — All Versions (${vLabels})" ident="assessment1">
    <section ident="root_section">
${items}    </section>
  </assessment>
</questestinterop>`;
  }

  // Grouped: one Canvas group per section per version
  // e.g. "5.4 — Version A", "5.4 — Version B", "5.5 — Version A"...
  const sectionMap = {};
  versions.forEach(v => {
    v.questions.filter(q => q.type !== "Branched").forEach((q, qi) => {
      const sec = q.section || "General";
      const key = `${sec}|||${v.label}`;
      if (!sectionMap[key]) sectionMap[key] = {sec, vLabel: v.label, questions: []};
      sectionMap[key].questions.push({q, qi});
    });
  });

  const groupSections = Object.entries(sectionMap).map(([key, {sec, vLabel, questions}], gi) => {
    const items = questions.map(({q, qi}, li) =>
      makeCompareItem(q, `g${gi}q${li}`, `Q${qi+1} V${vLabel}`, qi+1, vLabel)
    ).join("\n");
    return `    <section ident="group_${gi}" title="${escapeXML(sec)} — Version ${vLabel}">
      <selection_ordering>
        <selection>
          <selection_number>${questions.length}</selection_number>
          <selection_extension>
            <points_per_item>${pointsPerQ}</points_per_item>
          </selection_extension>
        </selection>
      </selection_ordering>
${items}
    </section>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment title="${escapeXML(course)} — All Versions (${vLabels})" ident="assessment1">
    <section ident="root_section">
${groupSections}
    </section>
  </assessment>
</questestinterop>`;
}

async function buildDocxCompare(versions, course) {
  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"`;

  function para(text, opts={}) {
    const {bold=false, size=24, color="000000", indent=0, spacing=120} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</w:t></w:r></w:p>`;
  }

  function mathPara(text, opts={}) {
    const {indent=0} = opts;
    const ppr = `<w:pPr><w:spacing w:after="60"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    try {
      const omml = mathToOmml(text);
      return `<w:p>${ppr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
    } catch(e) {
      const safe = String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `<w:p>${ppr}<w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    }
  }

  const vLabels = versions.map(v => v.label).join(", ");
  const numQ = versions[0]?.questions?.length || 0;
  const vColors = ["1a7a4a","6d28d9","b45309","0e7490","be185d"];

  let body = para(`${course} — All Versions (${vLabels})`, {bold:true, size:32, spacing:100});
  body += para("Version Comparison — Grouped by Question Number", {size:22, color:"555555", spacing:200});

  for (let qi = 0; qi < numQ; qi++) {
    body += `<w:p><w:pPr><w:spacing w:after="60"/><w:pBdr><w:top w:val="single" w:sz="6" w:space="1" w:color="334155"/></w:pBdr></w:pPr></w:p>`;
    body += para(`Question ${qi+1} — ${versions[0]?.questions[qi]?.section || ""} — ${versions[0]?.questions[qi]?.difficulty || ""}`, {bold:true, size:26, color:"334155", spacing:80});

    versions.forEach((v, vi) => {
      const q = v.questions[qi];
      if (!q) return;
      const vc = vColors[vi % vColors.length];
      body += para(`Version ${v.label}`, {bold:true, size:22, color:vc, spacing:60});
      body += mathPara(q.question);
      if (q.choices) q.choices.forEach((c,ci) => {
        body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:360});
      });
      body += mathPara(`Answer: ${q.answer}`);
    });
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns} mc:Ignorable="w14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
</w:sectPr>
</w:body>
</w:document>`;

  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);

  return await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}

function buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff) {
  const totalQ = selectedSections.reduce((a,s)=>a+(sectionCounts[s]||3),0);
  // Include difficulty pattern per section
  const breakdown = selectedSections.map(s => {
    const count = sectionCounts[s]||3;
    const pattern = difficultyPattern(count).join(", ");
    return `${s}: ${count} question(s) [difficulties: ${pattern}]`;
  }).join("\n");
  const typeInstructions = {
    "Multiple Choice": "4 choices as plain strings. answer = exact text of correct choice.",
    "True/False": 'choices = ["True","False"]. answer = "True" or "False".',
    "Free Response": "answer = complete worked answer.",
    "Fill in the Blank": "question has blank shown as ___. answer = the missing word or expression.",
    "Formula": "Include variables array [{name,min,max,precision}] with sensible ranges. Include answerFormula as math expression using variable names. Question text uses [varname] placeholders.",
    "Branched": "Include stem (shared given info), parts array [{question,answer,explanation}]. Decide number of parts (2-4) based on topic. All parts share the same stem.",
  };
  const needsChoices = qType==="Multiple Choice"||qType==="True/False";
  const shape = qType==="Branched"
    ? `{"type":"Branched","section":"...","difficulty":"...","stem":"...","parts":[{"question":"...","answer":"...","explanation":"..."}]}`
    : qType==="Formula"
    ? `{"type":"Formula","section":"...","difficulty":"...","question":"...","variables":[{"name":"a","min":1,"max":9,"precision":0}],"answerFormula":"...","answer":"...","explanation":"..."}`
    : needsChoices
    ? `{"type":"${qType}","section":"...","difficulty":"...","question":"...","choices":[...],"answer":"...","explanation":"..."}`
    : `{"type":"${qType}","section":"...","difficulty":"...","question":"...","answer":"...","explanation":"..."}`;
  return `TESTBANK_GENERATE_REQUEST\nCourse: ${course}\nType: ${qType}\nTotal questions: ${totalQ}\n\nSections, counts, and required difficulties:\n${breakdown}\n\nIMPORTANT: For each section, generate questions in the EXACT difficulty order listed (Easy=E, Medium=M, Hard=H). Follow the pattern strictly.\n\nType instructions: ${typeInstructions[qType]}\n\nYou are a college math professor writing a test bank from Stewart Calculus Early Transcendentals 9th Edition.\nUse plain-text math: x^2, sqrt(x), lim as x->0, d/dx, integral from a to b.\nBe rigorous, numerically specific, university-level.\nEach question must have a 'section' field with the exact section name.\nEach question must have a 'difficulty' field matching the required pattern above.\n\nReply with ONLY a valid JSON array, no markdown fences, no explanation:\n[${shape}, ...]`;
}

function buildVersionPrompt(selectedQuestions, mutationType, versionLabel) {
  const lines = selectedQuestions.map((q,i) => {
    const mut = mutationType[q.id]||"numbers";
    const orig = q.type==="Branched" ? q.stem : q.question;
    return (i+1)+". ["+q.section+"] ["+mut+" mutation] ["+q.type+"] Original: "+orig;
  }).join("\n");
  return `TESTBANK_VERSION_REQUEST\nVersion: ${versionLabel}\n\nMutate the following questions to create Version ${versionLabel}:\n${lines}\n\nMUTATION RULES:\n- numbers mutation: keep exact same function type and concept, only change coefficients/constants. Same difficulty, same steps.\n- function mutation: change to different but equivalent-difficulty function of same concept. Same difficulty, same steps.\n- For Branched: mutate the shared stem and regenerate ALL parts consistently.\n- ALWAYS regenerate the correct answer key for the mutated version.\n- Keep same question type, section, and difficulty.\n\nReturn a JSON array of mutated questions in the SAME order preserving the original structure:\n- Regular: {type, section, difficulty, question, answer, explanation, choices if MC}\n- Formula: {type, section, difficulty, question, variables, answerFormula, answer, explanation}\n- Branched: {type, section, difficulty, stem, parts:[{question,answer,explanation}]}\nReply with ONLY valid JSON array, no markdown.`;
}


// Combined prompt for ALL versions at once
function buildAllVersionsPrompt(selectedQuestions, mutationType, labels, classSection=1, numClassSections=1) {
  const lines = selectedQuestions.map((q,i) => {
    const mut = mutationType[q.id]||"numbers";
    const orig = q.type==="Branched" ? q.stem : q.question;
    return (i+1)+". ["+q.section+"] ["+mut+" mutation] ["+q.type+"] Original: "+orig;
  }).join("\n");
  const versionList = labels.join(", ");
  const sectionNote = numClassSections > 1
    ? `\nNOTE: This is Classroom Section ${classSection} of ${numClassSections}. ${classSection === 1 ? "Use numbers mutation — change only coefficients/constants." : `Use function mutation — change to DIFFERENT but equivalent-difficulty functions. Must be completely different from Section 1${classSection > 2 ? " and all previous sections" : ""}.`}`
    : "";
  return `TESTBANK_ALL_VERSIONS_REQUEST\nVersions to create: ${versionList}\n${sectionNote}\nFor each version, mutate ALL of the following questions:\n${lines}\n\nMUTATION RULES:\n- numbers mutation: keep exact same function type and concept, only change coefficients/constants. Same difficulty, same steps.\n- function mutation: change to different but equivalent-difficulty function of same concept. Same difficulty, same steps.\n- For Branched: mutate the shared stem and regenerate ALL parts consistently.\n- ALWAYS regenerate a correct answer key for each mutated version.\n- Keep same question type, section, and difficulty.\n- Each version must be DIFFERENT from all others.\n\nReturn a JSON object with one key per version label. Each value is a JSON array of mutated questions in the SAME order:\n{\n  "A": [{type, section, difficulty, question, choices, answer, explanation}, ...],\n  "B": [{type, section, difficulty, question, choices, answer, explanation}, ...],\n  ...\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
}

function buildReplacePrompt(q) {
  return `TESTBANK_REPLACE_REQUEST\nGenerate 1 replacement question.\nSection: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty}\nOriginal: ${q.type==="Branched" ? q.stem : q.question}\nRequirements: same section, same type, same difficulty, DIFFERENT question.\nUse plain-text math notation.\n${q.type==="Multiple Choice"?"Include 4 choices and correct answer.":""}\n${q.type==="Formula"?"Include variables array and answerFormula.":""}\n${q.type==="Branched"?"Include stem and parts array.":""}\nReply with ONLY a JSON array containing exactly 1 item, no markdown.`;
}

// ─── Paste Panel ──────────────────────────────────────────────────────────────
function PastePanel({ label, S, text2, pasteInput, setPasteInput, pasteError, handlePaste, onCancel }) {
  return (
    <div style={S.pasteBox}>
      <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"bold", marginBottom:"0.5rem"}}>
        ⏳ Waiting for AI response
      </div>
      <div style={{fontSize:"0.8rem", color:text2, marginBottom:"0.75rem"}}>
        {label || "Generate questions using the prompt above, then paste the JSON array here."}
      </div>
      <textarea
        style={S.textarea}
        placeholder="Paste the JSON response here..."
        value={pasteInput}
        onChange={e => setPasteInput(e.target.value)}
      />
      {pasteError && <div style={{color:"#f87171", fontSize:"0.78rem", marginTop:"0.4rem"}}>{pasteError}</div>}
      <div style={{display:"flex", gap:"0.75rem", marginTop:"0.75rem"}}>
        <button style={S.btn("#10b981", !pasteInput.trim())} disabled={!pasteInput.trim()} onClick={handlePaste}>
          ✓ Submit Response
        </button>
        <button style={S.oBtn(text2)} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Saved Exams Screen ───────────────────────────────────────────────────────
function SavedExamsScreen({ S, text2, text3, border }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLog, setExportLog] = useState([]);

  useEffect(() => {
    Promise.all([loadExams(), loadExportHistory()]).then(([e, h]) => {
      setExams(e); setExportLog(h); setLoading(false);
    });
  }, []);

  async function loadExportHistory() {
    try {
      const { data, error } = await supabase
        .from("export_history")
        .select("*")
        .order("exported_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    } catch { return []; }
  }

  if (loading) return <div style={{color:text2, padding:"2rem"}}>Loading saved exams…</div>;

  return (
    <div>
      <h1 style={S.h1}>Saved Exams</h1>
      <p style={S.sub}>{exams.length} exam{exams.length !== 1 ? "s" : ""} saved in database.</p>

      {exams.length === 0 && (
        <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
          No saved exams yet. Build an exam in the Versions tab and save it.
        </div>
      )}

      {exams.map(exam => (
        <div key={exam.id} style={S.card}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"0.5rem"}}>
            <div>
              <div style={{fontSize:"1rem", fontWeight:"bold", color:"#e8e8e0", marginBottom:"0.25rem"}}>{exam.name}</div>
              <div style={{fontSize:"0.72rem", color:text3}}>
                {new Date(exam.created_at).toLocaleDateString()} · {exam.versions?.length || 0} version(s)
              </div>
            </div>
            <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
              {(exam.versions || []).map(v => (
                <button
                  key={v.label}
                  style={S.oBtn("#8b5cf6")}
                  onClick={async () => {
                    dlFile(buildQTI(v.questions, exam.name, v.label), `${exam.name}_V${v.label}.xml`, "text/xml");
                    await logExport(exam.name, "QTI", v.label);
                  }}
                >
                  ⬇ V{v.label} QTI
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      {exportLog.length > 0 && (
        <>
          <h2 style={{fontSize:"1.1rem", fontWeight:"normal", margin:"2rem 0 0.75rem", color:"#e8e8e0"}}>Export History</h2>
          <div style={S.card}>
            {exportLog.map((log, i) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"0.4rem 0", borderBottom: i < exportLog.length-1 ? `1px solid ${border}` : "none", fontSize:"0.78rem"}}>
                <span style={{color:"#e8e8e0"}}>{log.exam_name} — V{log.version_label}</span>
                <span style={{color:text3}}>{log.format} · {new Date(log.exported_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TestBankApp() {
  const [screen, setScreen] = useState("home");
  const [bank, setBank] = useState([]);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [course, setCourse] = useState(null);
  const [selectedSections, setSelectedSections] = useState([]);
  const [sectionCounts, setSectionCounts] = useState({});
  const [qType, setQType] = useState("Multiple Choice");
  const [diff, setDiff] = useState("Mixed");
  const [pendingType, setPendingType] = useState(null);
  const [pendingMeta, setPendingMeta] = useState(null);
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [lastGenerated, setLastGenerated] = useState([]);
  const [selectedForExam, setSelectedForExam] = useState([]);
  const [mutationType, setMutationType] = useState({});
  const [versionCount, setVersionCount] = useState(2);
  const [versions, setVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [filterCourse, setFilterCourse] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterDiff, setFilterDiff] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [saveExamName, setSaveExamName] = useState("");
  const [savingExam, setSavingExam] = useState(false);
  const [examSaved, setExamSaved] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [versionsViewMode, setVersionsViewMode] = useState("single"); // "single" | "compare"
  const [compareSection, setCompareSection] = useState("All");
  const [selectedQIndices, setSelectedQIndices] = useState([]);
  const [qtiUseGroups, setQtiUseGroups] = useState(false);
  const [qtiPointsPerQ, setQtiPointsPerQ] = useState(1);
  // ── Classroom sections ──
  const [numClassSections, setNumClassSections] = useState(1);
  const [currentClassSection, setCurrentClassSection] = useState(1);
  const [classSectionVersions, setClassSectionVersions] = useState({}); // {1: [...versions], 2: [...versions]}
  const [activeClassSection, setActiveClassSection] = useState(1);

  const accent = course ? COURSES[course].color : "#10b981";

  useEffect(() => {
    loadBank().then(q => { setBank(q); setBankLoaded(true); });
  }, []);

  const persistBank = useCallback(async (newBank) => {
    setBank(newBank);
    // individual upserts handled by saveQuestion / deleteQuestion
  }, []);

  async function handlePaste() {
    setPasteError("");
    try {
      const raw = pasteInput.trim();

      // For version_all, parse as object {A:[...], B:[...]}
      if (pendingType === "version_all") {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (!objMatch) throw new Error("No JSON object found. Make sure you copied the full response.");
        const parsed = JSON.parse(objMatch[0]);
        const { selected, labels, classSection } = pendingMeta;
        const allVersions = labels.map(label => {
          const qs = parsed[label] || [];
          const versioned = qs.map((q,i) => ({
            ...q, id: uid(), originalId: selected[i]?.id,
            course: selected[i]?.course || course,
            versionLabel: label, classSection, createdAt: Date.now()
          }));
          return { label, questions: versioned, classSection };
        });
        // Store under the class section
        setClassSectionVersions(prev => ({ ...prev, [classSection]: allVersions }));
        setVersions(allVersions); setActiveVersion(0);
        setActiveClassSection(classSection);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
        setExamSaved(false); setSaveExamName("");
        setScreen("versions");
        return;
      }

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array found. Make sure you copied the full response.");
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");

      if (pendingType === "generate") {
        const tagged = parsed.map(q => ({ ...q, id: uid(), course: pendingMeta.course, createdAt: Date.now() }));
        setLastGenerated(tagged);
        for (const q of tagged) await saveQuestion(q);
        setBank(prev => [...tagged, ...prev]);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
        setScreen("review");
      } else if (pendingType === "version") {
        const { selected, label, allVersions, remaining, mutationType: mt } = pendingMeta;
        const versioned = parsed.map((q,i) => ({ ...q, id: uid(), originalId: selected[i]?.id, course: selected[i]?.course || course, versionLabel: label, createdAt: Date.now() }));
        const updated = [...allVersions, { label, questions: versioned }];
        if (remaining.length > 0) {
          const nextLabel = remaining[0]; const nextRemaining = remaining.slice(1);
          const prompt = buildVersionPrompt(selected, mt, nextLabel);
          setGeneratedPrompt(prompt);
          setPendingMeta({ selected, label: nextLabel, allVersions: updated, remaining: nextRemaining, mutationType: mt });
          setPasteInput("");
        } else {
          setVersions(updated); setActiveVersion(0);
          setPendingType(null); setPasteInput(""); setPendingMeta(null);
          setExamSaved(false); setSaveExamName("");
          setScreen("versions");
        }
      } else if (pendingType === "replace") {
        const { vIdx, qIdx } = pendingMeta;
        const newQ = { ...parsed[0], id: uid(), course: versions[vIdx].questions[qIdx]?.course || course, versionLabel: versions[vIdx].label };
        setVersions(versions.map((v,vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q,qi) => qi !== qIdx ? q : newQ) }));
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
      }
    } catch(e) { setPasteError("Error: " + e.message); }
  }

  function triggerGenerate() {
    const prompt = buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff);
    setGeneratedPrompt(prompt);
    setPendingType("generate"); setPendingMeta({ course }); setPasteInput(""); setPasteError("");
  }

  function triggerVersions(classSection) {
    const selected = bank.filter(q => selectedForExam.includes(q.id));
    const labels = VERSIONS.slice(0, versionCount);
    // Section 1 = numbers mutation; Section 2+ = function mutation
    const effectiveMutationType = classSection > 1
      ? Object.fromEntries(selected.map(q => [q.id, "function"]))
      : mutationType;
    const prompt = buildAllVersionsPrompt(selected, effectiveMutationType, labels, classSection, numClassSections);
    setGeneratedPrompt(prompt);
    setPendingType("version_all");
    setPendingMeta({ selected, labels, mutationType: effectiveMutationType, classSection });
    setPasteInput(""); setPasteError("");
  }

  function triggerReplace(vIdx, qIdx) {
    const prompt = buildReplacePrompt(versions[vIdx].questions[qIdx]);
    setGeneratedPrompt(prompt);
    setPendingType("replace"); setPendingMeta({ vIdx, qIdx }); setPasteInput(""); setPasteError("");
  }

  function toggleSection(sec) {
    setSelectedSections(p => p.includes(sec) ? p.filter(s => s !== sec) : [...p, sec]);
    setSectionCounts(p => ({ ...p, [sec]: p[sec] || 3 }));
  }

  function toggleChapter(chap) {
    const all = chap.sections.every(s => selectedSections.includes(s));
    if (all) { setSelectedSections(p => p.filter(s => !chap.sections.includes(s))); }
    else {
      setSelectedSections(p => { const n = [...p]; chap.sections.forEach(s => { if (!n.includes(s)) n.push(s); }); return n; });
      setSectionCounts(p => { const n = { ...p }; chap.sections.forEach(s => { if (!n[s]) n[s] = 3; }); return n; });
    }
  }

  const chapters = course ? COURSES[course].chapters : [];
  const totalQ = selectedSections.reduce((a,s) => a + (sectionCounts[s] || 3), 0);

  // Get available sections — only show when a course is selected, pulled from actual bank questions
  const availableSections = filterCourse === "All"
    ? []
    : [...new Set(bank.filter(q => q.course === filterCourse).map(q => q.section).filter(Boolean))].sort();

  const filteredBank = bank.filter(q =>
    (filterCourse === "All" || q.course === filterCourse) &&
    (filterType === "All" || q.type === filterType) &&
    (filterDiff === "All" || q.difficulty === filterDiff) &&
    (filterSection === "All" || q.section === filterSection)
  );
  const courseColors = { "Calculus 1":"#10b981","Calculus 2":"#8b5cf6","Calculus 3":"#f59e0b","Quantitative Methods I":"#06b6d4","Quantitative Methods II":"#f43f5e","Discrete Mathematics":"#a855f7" };

  const bg0="#08080f", bg1="#0e0e1c", bg2="#13132a", border="#1e1e3a";
  const text1="#e8e8e0", text2="#7070a0", text3="#404068";

  const S = {
    app:{ minHeight:"100vh", background:bg0, fontFamily:"'Georgia',serif", color:text1 },
    nav:{ display:"flex", alignItems:"center", gap:"0.25rem", padding:"1rem 1.5rem", borderBottom:"1px solid "+border, flexWrap:"wrap" },
    navLogo:{ fontSize:"1.2rem", fontWeight:"bold", color:accent, marginRight:"1rem", letterSpacing:"-0.5px" },
    navBtn:(a)=>({ background:a?bg2:"transparent", border:"1px solid "+(a?border:"transparent"), color:a?text1:text2, borderRadius:"6px", padding:"0.4rem 0.85rem", fontSize:"0.78rem", cursor:"pointer", fontFamily:"'Georgia',serif" }),
    main:{ maxWidth:"940px", margin:"0 auto", padding:"2rem 1.5rem" },
    h1:{ fontSize:"1.7rem", fontWeight:"normal", marginBottom:"0.3rem" },
    sub:{ color:text2, fontSize:"0.84rem", marginBottom:"2rem" },
    card:{ background:bg1, border:"1px solid "+border, borderRadius:"10px", padding:"1.5rem", marginBottom:"1rem" },
    sGrid:{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"0.4rem" },
    sBtn:(sel)=>({ background:sel?bg2:bg1, border:"1.5px solid "+(sel?accent:border), borderRadius:"7px", padding:"0.6rem 0.8rem", cursor:"pointer", color:sel?accent:text2, fontSize:"0.79rem", textAlign:"left", fontFamily:"'Georgia',serif", display:"flex", alignItems:"center", gap:"0.45rem" }),
    chk:(sel)=>({ width:"13px", height:"13px", borderRadius:"3px", border:"1.5px solid "+(sel?accent:text3), background:sel?accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", color:"#000", fontWeight:"bold" }),
    row:{ display:"flex", gap:"1rem", marginBottom:"1.25rem", flexWrap:"wrap" },
    field:{ flex:1, minWidth:"120px" },
    lbl:{ display:"block", fontSize:"0.63rem", textTransform:"uppercase", letterSpacing:"0.12em", color:text3, marginBottom:"0.4rem" },
    sel:{ width:"100%", background:bg1, border:"1.5px solid "+border, borderRadius:"7px", padding:"0.6rem 0.8rem", color:text1, fontSize:"0.84rem", fontFamily:"'Georgia',serif" },
    btn:(bg,dis)=>({ background:dis?"#111128":bg, color:dis?text3:"#000", border:"none", borderRadius:"8px", padding:"0.75rem 1.5rem", fontSize:"0.84rem", fontWeight:"bold", cursor:dis?"not-allowed":"pointer", fontFamily:"'Georgia',serif", display:"inline-flex", alignItems:"center", gap:"0.5rem" }),
    oBtn:(c)=>({ background:"transparent", color:c, border:"1.5px solid "+c, borderRadius:"8px", padding:"0.6rem 1.2rem", fontSize:"0.78rem", cursor:"pointer", fontFamily:"'Georgia',serif" }),
    smBtn:{ background:bg2, border:"1px solid "+border, color:text2, borderRadius:"5px", padding:"0.25rem 0.6rem", fontSize:"0.7rem", cursor:"pointer", fontFamily:"'Georgia',serif" },
    tag:(c)=>({ display:"inline-block", background:(c||accent)+"18", border:"1px solid "+(c||accent)+"44", color:(c||accent), borderRadius:"4px", padding:"0.15rem 0.5rem", fontSize:"0.65rem", marginRight:"0.3rem" }),
    divider:{ border:"none", borderTop:"1px solid "+border, margin:"1.75rem 0" },
    qCard:{ background:bg1, border:"1px solid "+border, borderRadius:"8px", padding:"1.2rem", marginBottom:"0.7rem" },
    qMeta:{ fontSize:"0.62rem", color:text3, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"0.35rem", display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap" },
    qText:{ fontSize:"0.9rem", color:"#d0d0cc", lineHeight:1.65, marginBottom:"0.7rem" },
    cList:{ listStyle:"none", padding:0, margin:0, marginBottom:"0.5rem" },
    cItem:(correct)=>({ padding:"0.3rem 0.6rem", marginBottom:"0.2rem", borderRadius:"5px", background:correct?"#10b98118":"transparent", border:"1px solid "+(correct?"#10b98144":border), color:correct?"#10b981":text2, fontSize:"0.84rem" }),
    ans:{ fontSize:"0.82rem", color:"#10b981", background:"#10b98112", border:"1px solid #10b98130", borderRadius:"6px", padding:"0.4rem 0.75rem", marginBottom:"0.4rem" },
    expl:{ fontSize:"0.78rem", color:text2, fontStyle:"italic", marginTop:"0.2rem" },
    vTab:(active, c)=>({ background:active?c+"22":"transparent", border:"1.5px solid "+(active?c:border), color:active?c:text2, borderRadius:"7px", padding:"0.45rem 1rem", fontSize:"0.78rem", cursor:"pointer", fontFamily:"'Georgia',serif" }),
    pasteBox:{ background:bg2, border:"1.5px solid "+accent+"44", borderRadius:"10px", padding:"1.25rem", marginTop:"1.5rem" },
    textarea:{ width:"100%", minHeight:"120px", background:bg1, border:"1.5px solid "+border, borderRadius:"7px", padding:"0.75rem", color:text1, fontSize:"0.82rem", fontFamily:"monospace", resize:"vertical" },
    promptBox:{ background:"#0a0a18", border:"1px solid "+border, borderRadius:"8px", padding:"1rem", marginBottom:"1rem", fontSize:"0.75rem", color:text2, fontFamily:"monospace", whiteSpace:"pre-wrap", wordBreak:"break-word", maxHeight:"200px", overflowY:"auto" },
    input:{ background:bg1, border:"1.5px solid "+border, borderRadius:"7px", padding:"0.6rem 0.8rem", color:text1, fontSize:"0.84rem", fontFamily:"'Georgia',serif", width:"100%" },
  };

  const navItems = [
    { id:"home", label:"Home" },
    { id:"generate", label:"Generate" },
    { id:"review", label:"Review" + (lastGenerated.length ? ` (${lastGenerated.length})` : "") },
    { id:"bank", label:"Bank" + (bank.length ? ` (${bank.length})` : "") },
    { id:"versions", label:"Versions" },
    { id:"saved", label:"Saved Exams" },
  ];

  return (
    <div style={S.app}>
      {/* NAV */}
      <nav style={S.nav}>
        <span style={S.navLogo}>TestBank Pro</span>
        {navItems.map(n => (
          <button key={n.id} style={S.navBtn(screen === n.id)} onClick={() => setScreen(n.id)}>{n.label}</button>
        ))}
      </nav>

      <main style={S.main}>

        {/* HOME */}
        {screen === "home" && (
          <div>
            <h1 style={S.h1}>TestBank Pro</h1>
            <p style={S.sub}>AI-powered exam question generator · Backed by Supabase · Deployed on Vercel</p>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"1rem", marginTop:"1rem"}}>
              {Object.entries(COURSES).map(([name, { color }]) => (
                <div key={name} style={{...S.card, borderColor:color+"44", cursor:"pointer"}}
                  onClick={() => { setCourse(name); setScreen("generate"); }}>
                  <div style={{color, fontSize:"0.7rem", fontWeight:"bold", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.4rem"}}>Course</div>
                  <div style={{fontSize:"1rem"}}>{name}</div>
                  <div style={{fontSize:"0.72rem", color:text3, marginTop:"0.5rem"}}>{COURSES[name].chapters.length} chapters</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GENERATE */}
        {screen === "generate" && (
          <div>
            <h1 style={S.h1}>Generate Questions</h1>
            <p style={S.sub}>Configure your question set and copy the prompt to Claude.</p>

            {/* Course picker */}
            <div style={S.card}>
              <div style={S.lbl}>Course</div>
              <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
                {Object.entries(COURSES).map(([name, { color }]) => (
                  <button key={name} style={{...S.oBtn(course === name ? color : text3), background: course === name ? color+"22" : "transparent"}}
                    onClick={() => { setCourse(name); setSelectedSections([]); setSectionCounts({}); }}>
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Section picker */}
            {course && (
              <div style={S.card}>
                <div style={S.lbl}>Sections ({selectedSections.length} selected · {totalQ} questions)</div>
                {chapters.map(chap => {
                  const allSel = chap.sections.every(s => selectedSections.includes(s));
                  return (
                    <div key={chap.ch} style={{marginBottom:"1rem"}}>
                      <button style={{...S.sBtn(allSel), marginBottom:"0.4rem", fontWeight:"bold"}} onClick={() => toggleChapter(chap)}>
                        <span style={S.chk(allSel)}>{allSel?"✓":""}</span>
                        Ch {chap.ch}: {chap.title}
                      </button>
                      <div style={{...S.sGrid, paddingLeft:"1rem"}}>
                        {chap.sections.map(sec => {
                          const sel = selectedSections.includes(sec);
                          return (
                            <div key={sec} style={{display:"flex", alignItems:"center", gap:"0.4rem"}}>
                              <button style={S.sBtn(sel)} onClick={() => toggleSection(sec)}>
                                <span style={S.chk(sel)}>{sel?"✓":""}</span>
                                {sec}
                              </button>
                              {sel && (
                                <div style={{display:"flex", alignItems:"center", gap:"0.4rem", flexWrap:"wrap"}}>
                                  <input type="number" min={1} max={20} value={sectionCounts[sec]||3}
                                    style={{width:"48px", ...S.input, padding:"0.3rem 0.4rem", fontSize:"0.78rem"}}
                                    onChange={e => setSectionCounts(p => ({...p,[sec]:Number(e.target.value)||1}))} />
                                  <span style={{fontSize:"0.65rem", color:text3}}>
                                    {difficultyPattern(sectionCounts[sec]||3).map((d,i) => (
                                      <span key={i} style={{marginRight:"2px", color: d==="Easy"?"#10b981":d==="Medium"?"#f59e0b":"#f43f5e"}}>{d[0]}</span>
                                    ))}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Type & Difficulty */}
            <div style={S.row}>
              <div style={S.field}>
                <label style={S.lbl}>Question Type</label>
                <select style={S.sel} value={qType} onChange={e => setQType(e.target.value)}>
                  {QTYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={S.field}>
                <label style={S.lbl}>Difficulty</label>
                <select style={S.sel} value={diff} onChange={e => setDiff(e.target.value)}>
                  {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <button
              style={S.btn(accent, !course || selectedSections.length === 0)}
              disabled={!course || selectedSections.length === 0}
              onClick={triggerGenerate}
            >
              ✦ Generate Prompt
            </button>

            {pendingType === "generate" && generatedPrompt && (
              <>
                <hr style={S.divider} />
                <div style={{fontSize:"0.78rem", color:accent, fontWeight:"bold", marginBottom:"0.5rem"}}>📋 Copy this prompt and send it to Claude (or any AI):</div>
                <div style={S.promptBox}>{generatedPrompt}</div>
                <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                  Copy Prompt
                </button>
                <PastePanel
                  label="Paste the JSON array from Claude's response below."
                  S={S} text2={text2}
                  pasteInput={pasteInput} setPasteInput={setPasteInput}
                  pasteError={pasteError} handlePaste={handlePaste}
                  onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                />
              </>
            )}
          </div>
        )}

        {/* REVIEW */}
        {screen === "review" && (
          <div>
            <h1 style={S.h1}>Review Generated Questions</h1>
            <p style={S.sub}>{lastGenerated.length} questions generated and saved to your bank.</p>
            {lastGenerated.length === 0 && (
              <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>No questions generated yet. Go to Generate.</div>
            )}
            {lastGenerated.map((q, qi) => (
              <div key={q.id || qi} style={S.qCard}>
                <div style={S.qMeta}>
                  <span>Q{qi+1}</span>
                  <span style={S.tag(courseColors[q.course])}>{q.course}</span>
                  <span style={S.tag()}>{q.type}</span>
                  <span style={S.tag()}>{q.section}</span>
                  <span style={S.tag()}>{q.difficulty}</span>
                </div>
                {q.type === "Branched" ? (
                  <>
                    <div style={{...S.qText, color:accent+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                    {(q.parts||[]).map((p,pi) => (
                      <div key={pi} style={{marginBottom:"0.6rem", paddingLeft:"0.75rem", borderLeft:"2px solid "+border}}>
                        <div style={{fontSize:"0.7rem", color:text3, marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                        <div style={S.qText}><MathText>{p.question}</MathText></div>
                        {p.answer && <div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                        {p.explanation && <div style={S.expl}>💡 <MathText>{p.explanation}</MathText></div>}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                    {q.choices && <ul style={S.cList}>{q.choices.map((c,ci) => <li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                    {q.answer && <div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
                    {q.explanation && <div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* BANK */}
        {screen === "bank" && (
          <div>
            <h1 style={S.h1}>Question Bank</h1>
            <p style={S.sub}>{bank.length} questions saved in Supabase.</p>

            <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
              <select style={{...S.sel, width:"155px"}} value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterSection("All"); }}>
                <option>All</option>{Object.keys(COURSES).map(c => <option key={c}>{c}</option>)}
              </select>
              {filterCourse !== "All" && (
                <select style={{...S.sel, width:"220px"}} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                  <option value="All">All Sections</option>
                  {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select style={{...S.sel, width:"145px"}} value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option>All</option>{QTYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select style={{...S.sel, width:"130px"}} value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
                <option>All</option>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>
              <span style={{fontSize:"0.78rem", color:text2, alignSelf:"center"}}>{filteredBank.length} matching</span>
            </div>

            {!bankLoaded && <div style={{color:text2}}>Loading from database…</div>}
            {bankLoaded && filteredBank.length === 0 && (
              <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
                {bank.length === 0 ? "No questions yet. Go to Generate." : "No questions match filters."}
              </div>
            )}

            {filteredBank.map(q => {
              const inExam = selectedForExam.includes(q.id);
              return (
              <div key={q.id} style={{...S.qCard, borderColor: inExam ? accent+"66" : undefined}}>
                <div style={S.qMeta}>
                  <span style={S.tag(courseColors[q.course])}>{q.course}</span>
                  <span style={S.tag()}>{q.type}</span>
                  <span style={S.tag()}>{q.section}</span>
                  <span style={S.tag()}>{q.difficulty}</span>
                  <button style={{...S.smBtn, marginLeft:"auto", color:"#f87171", border:"1px solid #f8717144"}}
                    onClick={async () => { await deleteQuestion(q.id); setBank(prev => prev.filter(bq => bq.id !== q.id)); }}>
                    ✕
                  </button>
                  <button style={{...S.smBtn, color:inExam?accent:text2, border:"1px solid "+(inExam?accent+"44":border)}}
                    onClick={() => setSelectedForExam(p => p.includes(q.id) ? p.filter(id => id !== q.id) : [...p, q.id])}>
                    {inExam ? "✓ In exam" : "+ Exam"}
                  </button>
                </div>

                {q.type === "Branched" ? (
                  <>
                    <div style={{...S.qText, color:accent+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                    {(q.parts||[]).map((p,pi) => (
                      <div key={pi} style={{marginBottom:"0.5rem", paddingLeft:"0.75rem", borderLeft:"2px solid "+border}}>
                        <div style={{fontSize:"0.7rem", color:text3, marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                        <div style={{...S.qText, marginBottom:"0.2rem"}}><MathText>{p.question}</MathText></div>
                        {p.answer && <div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                    {q.choices && <ul style={S.cList}>{q.choices.map((c,ci) => <li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                    {q.answer && <div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
                    {q.explanation && <div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
                  </>
                )}

                {/* Inline mutation selector — only shown when question is selected for exam */}
                {inExam && (
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginTop:"0.6rem", paddingTop:"0.6rem", borderTop:"1px solid "+accent+"33"}}>
                    <span style={{fontSize:"0.68rem", color:accent, fontWeight:"bold", letterSpacing:"0.08em", textTransform:"uppercase"}}>Mutation:</span>
                    <button
                      style={{...S.smBtn, background:(mutationType[q.id]||"numbers")==="numbers"?accent+"22":"transparent", color:(mutationType[q.id]||"numbers")==="numbers"?accent:text2, border:"1px solid "+((mutationType[q.id]||"numbers")==="numbers"?accent+"66":border)}}
                      onClick={() => setMutationType(p => ({...p,[q.id]:"numbers"}))}>
                      numbers
                    </button>
                    <button
                      style={{...S.smBtn, background:mutationType[q.id]==="function"?"#8b5cf622":"transparent", color:mutationType[q.id]==="function"?"#8b5cf6":text2, border:"1px solid "+(mutationType[q.id]==="function"?"#8b5cf666":border)}}
                      onClick={() => setMutationType(p => ({...p,[q.id]:"function"}))}>
                      function
                    </button>
                  </div>
                )}
              </div>
              );
            })}

            {selectedForExam.length > 0 && (
              <div style={{...S.card, borderColor:accent+"44", marginTop:"1.5rem"}}>
                <div style={{display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap", marginBottom:"0.75rem"}}>
                  <span style={{fontSize:"0.78rem", color:accent, fontWeight:"bold"}}>
                    {selectedForExam.length} question{selectedForExam.length!==1?"s":""} selected
                  </span>
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                    <span style={{fontSize:"0.72rem", color:text2}}>Versions per class:</span>
                    <select style={{...S.sel, width:"130px", padding:"0.4rem 0.6rem"}} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} version{n>1?"s":""}</option>)}
                    </select>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                    <span style={{fontSize:"0.72rem", color:text2}}>Classroom sections:</span>
                    <input
                      type="number" min={1} max={10} value={numClassSections}
                      onChange={e => setNumClassSections(Math.max(1, parseInt(e.target.value)||1))}
                      style={{width:"52px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}}
                    />
                  </div>
                </div>

                {/* Per-section build buttons */}
                <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.5rem"}}>
                  {Array.from({length:numClassSections},(_,i)=>i+1).map(sec => {
                    const hasVersions = classSectionVersions[sec]?.length > 0;
                    return (
                      <button key={sec}
                        style={{...S.btn(hasVersions ? "#10b981" : accent, false), fontSize:"0.75rem"}}
                        onClick={() => triggerVersions(sec)}>
                        {hasVersions ? "✓" : "✦"} {numClassSections > 1 ? `Section ${sec}` : "Build Versions"}
                        {numClassSections > 1 && (sec === 1 ? " (numbers)" : " (function)")}
                      </button>
                    );
                  })}
                  {Object.keys(classSectionVersions).length > 1 && (
                    <button style={{...S.btn("#8b5cf6", false), fontSize:"0.75rem"}}
                      onClick={() => setScreen("versions")}>
                      📋 View All Sections
                    </button>
                  )}
                </div>
                <div style={{fontSize:"0.68rem", color:text3}}>
                  {numClassSections > 1
                    ? "Section 1: numbers mutation (same time). Section 2+: function mutation (different time)."
                    : "Tip: set numbers/function mutation on each question card above ↑"}
                </div>
              </div>
            )}

            {pendingType === "version_all" && generatedPrompt && (
              <>
                <hr style={S.divider} />
                <div style={{fontSize:"0.78rem", color:accent, fontWeight:"bold", marginBottom:"0.5rem"}}>
                  📋 Copy this prompt — {numClassSections > 1 ? `Classroom Section ${pendingMeta?.classSection} — ` : ""}generates ALL {pendingMeta?.labels?.join(", ")} versions at once:
                </div>
                <div style={S.promptBox}>{generatedPrompt}</div>
                <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>
                <PastePanel
                  label={`Paste the JSON object with all versions ({"A":[...], "B":[...], ...}) here.`}
                  S={S} text2={text2}
                  pasteInput={pasteInput} setPasteInput={setPasteInput}
                  pasteError={pasteError} handlePaste={handlePaste}
                  onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                />
              </>
            )}

            {pendingType === "version" && generatedPrompt && (
              <>
                <hr style={S.divider} />
                <div style={{fontSize:"0.78rem", color:accent, fontWeight:"bold", marginBottom:"0.5rem"}}>
                  📋 Copy this prompt for Version {pendingMeta?.label}:
                </div>
                <div style={S.promptBox}>{generatedPrompt}</div>
                <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>
                <PastePanel
                  label={`Paste Claude's response for Version ${pendingMeta?.label}.`}
                  S={S} text2={text2}
                  pasteInput={pasteInput} setPasteInput={setPasteInput}
                  pasteError={pasteError} handlePaste={handlePaste}
                  onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                />
              </>
            )}
          </div>
        )}

        {/* VERSIONS */}
        {screen === "versions" && (
          <div>
            <h1 style={S.h1}>Exam Versions</h1>
            <p style={S.sub}>{versions.length} version{versions.length !== 1 ? "s" : ""} created{Object.keys(classSectionVersions).length > 1 ? ` · ${Object.keys(classSectionVersions).length} classroom sections` : ""}.</p>

            {/* Classroom section tabs */}
            {Object.keys(classSectionVersions).length > 1 && (
              <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center"}}>
                <span style={{fontSize:"0.72rem", color:text2}}>Classroom Section:</span>
                {Object.keys(classSectionVersions).sort().map(sec => (
                  <button key={sec}
                    style={S.vTab(activeClassSection===Number(sec), Number(sec)===1?"#10b981":"#8b5cf6")}
                    onClick={() => { setActiveClassSection(Number(sec)); setVersions(classSectionVersions[sec]); setActiveVersion(0); }}>
                    Section {sec} {Number(sec)===1?"(numbers)":"(function)"}
                  </button>
                ))}
              </div>
            )}

            {versions.length === 0 && (
              <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
                No versions yet. Select questions in the Bank tab and build versions.
              </div>
            )}

            {versions.length > 0 && (
              <>
                {/* Save to DB */}
                {!examSaved && (
                  <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1.5rem"}}>
                    <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"bold", marginBottom:"0.5rem"}}>💾 Save this exam to database</div>
                    <div style={{display:"flex", gap:"0.75rem", alignItems:"center", flexWrap:"wrap"}}>
                      <input
                        style={{...S.input, maxWidth:"300px"}}
                        placeholder="Exam name (e.g. Calculus 1 Midterm)"
                        value={saveExamName}
                        onChange={e => setSaveExamName(e.target.value)}
                      />
                      <button
                        style={S.btn("#10b981", !saveExamName.trim() || savingExam)}
                        disabled={!saveExamName.trim() || savingExam}
                        onClick={async () => {
                          setSavingExam(true);
                          const result = await saveExam(saveExamName.trim(), versions);
                          if (result) setExamSaved(true);
                          setSavingExam(false);
                        }}
                      >
                        {savingExam ? "Saving…" : "Save Exam"}
                      </button>
                    </div>
                  </div>
                )}
                {examSaved && (
                  <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1.5rem", color:"#10b981"}}>
                    ✅ Exam saved! View it in the Saved Exams tab.
                  </div>
                )}

                {/* View mode toggle */}
                <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", alignItems:"center", flexWrap:"wrap"}}>
                  <span style={{fontSize:"0.72rem", color:text2, marginRight:"0.25rem"}}>View:</span>
                  <button style={S.vTab(versionsViewMode==="single","#f43f5e")} onClick={() => setVersionsViewMode("single")}>
                    📄 Single Version
                  </button>
                  <button style={S.vTab(versionsViewMode==="compare","#8b5cf6")} onClick={() => setVersionsViewMode("compare")}>
                    📋 Canvas Versions
                  </button>
                </div>

                {/* ── SINGLE VERSION MODE ── */}
                {versionsViewMode === "single" && (() => {
                  const v = versions[activeVersion];
                  return (
                    <>
                      {/* Version tabs */}
                      <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
                        {versions.map((ver,i) => (
                          <button key={ver.label} style={S.vTab(activeVersion===i,"#f43f5e")} onClick={() => setActiveVersion(i)}>
                            Version {ver.label} <span style={{fontSize:"0.68rem", opacity:0.7, marginLeft:"0.3rem"}}>({ver.questions.length}q)</span>
                          </button>
                        ))}
                      </div>


                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
                        <button style={S.btn("#10b981",false)} onClick={async () => {
                          const cs = v.questions[0]?.classSection || null;
                          const blob = await buildDocx(v.questions,v.questions[0]?.course||"Calculus",v.label,cs);
                          const secStr = cs ? `_S${cs}` : "";
                          dlBlob(blob,`Version_${v.label}${secStr}_Exam.docx`);
                          if (examSaved && saveExamName) await logExport(saveExamName, "Word", v.label);
                        }}>⬇ Word (.docx)</button>
                        <button style={S.oBtn("#f59e0b")} onClick={async () => {
                          for(const ver of versions){
                            const cs = ver.questions[0]?.classSection || null;
                            const blob=await buildDocx(ver.questions,ver.questions[0]?.course||"Calculus",ver.label,cs);
                            const secStr = cs ? `_S${cs}` : "";
                            dlBlob(blob,`Version_${ver.label}${secStr}_Exam.docx`);
                          }
                        }}>⬇ All Word</button>
                        {Object.keys(classSectionVersions).length > 1 && (
                          <button style={S.oBtn("#8b5cf6")} onClick={async () => {
                            for(const [sec, secVers] of Object.entries(classSectionVersions)){
                              for(const ver of secVers){
                                const blob=await buildDocx(ver.questions,ver.questions[0]?.course||"Calculus",ver.label,Number(sec));
                                dlBlob(blob,`S${sec}_Version_${ver.label}_Exam.docx`);
                              }
                            }
                          }}>⬇ All Sections Word</button>
                        )}
                      </div>

                      {v.questions.map((q,qi) => (
                        <div key={q.id||qi} style={S.qCard}>
                          <div style={S.qMeta}>
                            <span style={{fontWeight:"bold", color:text1}}>Q{qi+1}</span>
                            <span style={S.tag("#f43f5e")}>{q.type}</span>
                            <span style={S.tag()}>{q.section}</span>
                            <span style={S.tag()}>{q.difficulty}</span>
                            <button style={{...S.smBtn,marginLeft:"auto",color:"#f59e0b",border:"1px solid #f59e0b44"}} onClick={() => triggerReplace(activeVersion,qi)}>↻ Replace</button>
                          </div>
                          {q.type==="Branched" ? (
                            <>
                              <div style={{...S.qText,color:"#f43f5e99"}}>Given: <MathText>{q.stem}</MathText></div>
                              {(q.parts||[]).map((p,pi) => (
                                <div key={pi} style={{marginBottom:"0.6rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                                  <div style={{fontSize:"0.7rem",color:text3,marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                                  <div style={S.qText}><MathText>{p.question}</MathText></div>
                                  {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                                  {p.explanation&&<div style={S.expl}>💡 <MathText>{p.explanation}</MathText></div>}
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              <div style={S.qText}><MathText>{q.question}</MathText></div>
                              {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                              {q.answer&&<div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
                              {q.explanation&&<div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
                            </>
                          )}
                          {pendingType === "replace" && pendingMeta?.vIdx === activeVersion && pendingMeta?.qIdx === qi && generatedPrompt && (
                            <>
                              <div style={{fontSize:"0.75rem", color:"#f59e0b", fontWeight:"bold", margin:"0.75rem 0 0.4rem"}}>📋 Copy this replacement prompt:</div>
                              <div style={S.promptBox}>{generatedPrompt}</div>
                              <button style={S.oBtn("#f59e0b")} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>
                              <PastePanel
                                label="Paste the replacement question JSON here."
                                S={S} text2={text2}
                                pasteInput={pasteInput} setPasteInput={setPasteInput}
                                pasteError={pasteError} handlePaste={handlePaste}
                                onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()}

                {/* ── COMPARE ALL VERSIONS MODE ── */}
                {versionsViewMode === "compare" && (() => {
                  const numQ = versions[0]?.questions?.length || 0;
                  const allSections = [...new Set(versions.flatMap(v => v.questions.map(q => q.section)))];
                  const [filterSec, setFilterSec] = [compareSection, setCompareSection];

                  const filteredIndices = Array.from({length:numQ},(_,i)=>i).filter(i => {
                    if (filterSec === "All") return true;
                    return versions.some(v => v.questions[i]?.section === filterSec);
                  });

                  return (
                    <>
                      {/* Section filter */}
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", alignItems:"center", flexWrap:"wrap"}}>
                        <span style={{fontSize:"0.72rem", color:text2}}>Filter section:</span>
                        <select style={{...S.sel, width:"220px"}} value={filterSec} onChange={e => setFilterSec(e.target.value)}>
                          <option value="All">All Sections</option>
                          {allSections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span style={{fontSize:"0.72rem", color:text2}}>{filteredIndices.length} question{filteredIndices.length!==1?"s":""}</span>
                      </div>

                      {/* Canvas Export Settings */}
                      <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                        <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas Export Settings</div>
                        <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center"}}>
                          <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                            <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                              style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                            Group by section per version
                          </label>
                          <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                            Points per question:
                            <input type="number" min={1} max={100} value={qtiPointsPerQ}
                              onChange={e => setQtiPointsPerQ(Number(e.target.value)||1)}
                              style={{width:"52px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                          </label>
                        </div>
                      </div>

                      {/* Export buttons for compare view — single grouped file */}
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center"}}>
                        <span style={{fontSize:"0.72rem", color:accent, fontWeight:"bold"}}>Canvas export — one file, all versions:</span>
                        <button style={S.btn("#8b5cf6", false)} onClick={() => {
                          const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, qtiPointsPerQ);
                          dlFile(xml, "AllVersions_Canvas_QTI.xml", "text/xml");
                        }}>⬇ Export to Canvas (QTI)</button>
                        <button style={S.btn("#10b981", false)} onClick={async () => {
                          const blob = await buildDocxCompare(versions, versions[0]?.questions[0]?.course || "Exam");
                          dlBlob(blob, "AllVersions_Grouped.docx");
                        }}>⬇ Export to Word (all versions)</button>
                      </div>

                      {/* Questions grouped by number, all versions stacked */}
                      {filteredIndices.map(qi => (
                        <div key={qi} style={{marginBottom:"1.5rem"}}>
                          {/* Question group header */}
                          <div style={{fontSize:"0.72rem", color:"#f43f5e", fontWeight:"bold", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.5rem", padding:"0.3rem 0.6rem", background:"#f43f5e18", borderRadius:"5px", display:"inline-block"}}>
                            Question {qi+1} — {versions[0]?.questions[qi]?.section} — {versions[0]?.questions[qi]?.difficulty}
                          </div>

                          {versions.map((v, vi) => {
                            const q = v.questions[qi];
                            if (!q) return null;
                            const vColors = ["#f43f5e","#8b5cf6","#f59e0b","#06b6d4","#10b981"];
                            const vc = vColors[vi % vColors.length];
                            return (
                              <div key={v.label} style={{...S.qCard, borderLeft:`3px solid ${vc}`, marginBottom:"0.4rem"}}>
                                <div style={S.qMeta}>
                                  <span style={{background:vc+"22", color:vc, border:`1px solid ${vc}44`, borderRadius:"4px", padding:"0.15rem 0.5rem", fontSize:"0.7rem", fontWeight:"bold"}}>Version {v.label}</span>
                                  <span style={S.tag()}>{q.type}</span>
                                </div>
                                {q.type==="Branched" ? (
                                  <>
                                    <div style={{...S.qText,color:vc+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                                    {(q.parts||[]).map((p,pi) => (
                                      <div key={pi} style={{marginBottom:"0.4rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                                        <div style={{fontSize:"0.7rem",color:text3}}>({String.fromCharCode(97+pi)})</div>
                                        <div style={S.qText}><MathText>{p.question}</MathText></div>
                                        {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                                    {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                                    {q.answer&&<div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* SAVED EXAMS */}
        {screen === "saved" && (
          <SavedExamsScreen S={S} text2={text2} text3={text3} border={border} />
        )}

      </main>
    </div>
  );
}
