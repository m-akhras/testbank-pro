export function buildCourseContext(course) {
  if (!course) return "";
  const textbookContext = course.textbook_name
    ? `You are writing questions for "${course.textbook_name}"${course.textbook_author ? ` by ${course.textbook_author}` : ""}${course.textbook_edition ? `, ${course.textbook_edition}` : ""}. Match the exact question style, notation, and terminology of this textbook.`
    : "";
  const glossaryContext = course.glossary_text
    ? `\nCourse notation and terminology rules:\n${course.glossary_text.slice(0, 2000)}`
    : "";
  return textbookContext + glossaryContext;
}
