// lib/templates/registry.js
//
// Central registry of available question-generation templates.
// Imported by:
//   - components/screens/GenerateScreen.jsx — to show the template form
//     when an instructor picks a section that has a template available.
//   - app/app/admin/template-generator/page.js — to know which sections
//     DO NOT yet have a template, so the dropdown can filter accordingly.
//
// When a new template is created (either hand-written or AI-generated and
// committed as a .js file), add an entry here. The sectionPrefix must be
// the section identifier as it appears in the course's chapters[].sections
// array, including the trailing space — e.g. "1.1 " matches the section
// string "1.1 Four Ways to Represent a Function".

import { calc1_1_1_template } from "./calc1_1_1.js";
import { calc1_1_3_template } from "./calc1_1_3.js";
import { calc1_1_4_template } from "./calc1_1_4.js";
import { calc1_1_5_template } from "./calc1_1_5.js";
import { calc1_2_2_template } from "./calc1_2_2.js";
import { calc1_2_5_template } from "./calc1_2_5.js";

export const TEMPLATE_REGISTRY = [
  { course: "Calculus 1", sectionPrefix: "1.1 ", template: calc1_1_1_template },
  { course: "Calculus 1", sectionPrefix: "1.3 ", template: calc1_1_3_template },
  { course: "Calculus 1", sectionPrefix: "1.4 ", template: calc1_1_4_template },
  { course: "Calculus 1", sectionPrefix: "1.5 ", template: calc1_1_5_template },
  { course: "Calculus 1", sectionPrefix: "2.2 ", template: calc1_2_2_template },
  { course: "Calculus 1", sectionPrefix: "2.5 ", template: calc1_2_5_template },
];

/**
 * Find the template matching a given course + selected-section string.
 * Returns the template object, or null if no match.
 *
 * @param {string} course - The course name (e.g. "Calculus 1").
 * @param {string} section - The full section string as stored in the bank
 *                           (e.g. "1.1 Four Ways to Represent a Function").
 * @returns {object|null}
 */
export function findTemplate(course, section) {
  if (!course || !section) return null;
  for (const entry of TEMPLATE_REGISTRY) {
    if (entry.course === course && section.startsWith(entry.sectionPrefix)) {
      return entry.template;
    }
  }
  return null;
}

/**
 * Check whether a given course + section already has a registered template.
 * Used by the admin Template Builder to show only sections that DON'T have
 * a template yet (you don't want to overwrite §1.1 by accident).
 *
 * @param {string} course
 * @param {string} section
 * @returns {boolean}
 */
export function hasTemplate(course, section) {
  return findTemplate(course, section) !== null;
}
