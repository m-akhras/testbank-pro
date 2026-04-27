"use client";
import { createContext, useContext, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useBank } from "../hooks/useBank";
import { useGenerate } from "../hooks/useGenerate";
import { useExamBuilder } from "../hooks/useExamBuilder";
import { useExport } from "../hooks/useExport";
import { useCourses } from "../hooks/useCourses";
import { useValidation } from "../hooks/useValidation";
import { COURSES, getCourse } from "../lib/courses/index.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build", export: "/app/export",
  exams: "/app/exams", saved: "/app/exams", courses: "/app/courses", admin: "/app/admin",
};

const ADMIN_EMAIL = "mohammadalakhrass@yahoo.com";

export const AppContext = createContext(null);

// showToast lives outside the hooks so it can be shared freely.
function useToast() {
  const [toast, setToast] = useState(null);
  function showToast(message, type = "success") {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 2500);
  }
  return { toast, showToast };
}

function useAuth() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null));
  }, []);
  const isAdmin = user?.email === ADMIN_EMAIL;
  return { user, isAdmin };
}

export function AppProvider({ children }) {
  const auth = useAuth();
  const { toast, showToast } = useToast();
  const router = useRouter();

  // useGenerate ↔ useExamBuilder setters are mutually required. We bridge with refs:
  // each hook receives setters that delegate through the latest ref snapshot.
  const generateRef  = useRef({});
  const examBuilderRef = useRef({});

  // Courses must exist so we can resolve courseObject for prompt building.
  const coursesHook = useCourses();

  // Bank has no cross-hook deps.
  const bankHook = useBank();

  // Real router-backed setScreen so hooks like useGenerate.handlePaste can route
  // on success (e.g. setScreen("review") after a completed generate).
  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  const examBuilderHook = useExamBuilder({
    bank: bankHook.bank,
    get course() { return generateRef.current.course ?? null; },
    showToast,
    setScreen,
    setGeneratedPrompt: (...a) => generateRef.current.setGeneratedPrompt?.(...a),
    setPendingType:     (...a) => generateRef.current.setPendingType?.(...a),
    setPendingMeta:     (...a) => generateRef.current.setPendingMeta?.(...a),
    setPasteInput:      (...a) => generateRef.current.setPasteInput?.(...a),
    setPasteError:      (...a) => generateRef.current.setPasteError?.(...a),
    courseObject: generateRef.current.course
      ? (coursesHook.courses.find(c => c.name === generateRef.current.course) || null)
      : null,
  });
  examBuilderRef.current = examBuilderHook;

  const generateHook = useGenerate({
    bank: bankHook.bank,
    setBank: bankHook.setBank,
    versions: examBuilderHook.versions,
    masterLocked: examBuilderHook.masterLocked,
    setVersions:             examBuilderHook.setVersions,
    setClassSectionVersions: examBuilderHook.setClassSectionVersions,
    setActiveVersion:        examBuilderHook.setActiveVersion,
    setActiveClassSection:   examBuilderHook.setActiveClassSection,
    setExamSaved:            examBuilderHook.setExamSaved,
    setSaveExamName:         examBuilderHook.setSaveExamName,
    setMasterLocked:         examBuilderHook.setMasterLocked,
    setSelectedForExam:      examBuilderHook.setSelectedForExam,
    appendToMaster:          examBuilderHook.appendToMaster,
    setAppendToMaster:       examBuilderHook.setAppendToMaster,
    showToast,
    setScreen,
    courseObject: null, // set post-render
  });
  generateRef.current = generateHook;

  const exportHook = useExport({
    versions: examBuilderHook.versions,
    activeVersion: examBuilderHook.activeVersion,
  });

  // Merge built-ins + custom courses for screens that need { name: { color, chapters } }.
  const allCourses = {};
  Object.entries(COURSES).forEach(([name, mod]) => {
    allCourses[name] = { color: mod.color, chapters: mod.chapters };
  });
  coursesHook.courses.forEach(c => {
    if (!c.is_builtin && !allCourses[c.name]) {
      allCourses[c.name] = { color: c.color || "#6366f1", chapters: c.chapters || [], id: c.id };
    }
  });
  const courseColors = Object.fromEntries(Object.entries(allCourses).map(([k, v]) => [k, v.color]));

  // The "active course" — what's selected in generate flow. Chapters derived from it.
  const course = generateHook.course;
  const courseObject = course ? (coursesHook.courses.find(c => c.name === course) || null) : null;
  const chapters = course ? (getCourse(course)?.chapters ?? allCourses[course]?.chapters ?? []) : [];

  const validationHook = useValidation({
    versions: examBuilderHook.versions,
    courseObject,
    // Persist each verdict back to the bank row keyed by question id.
    onResult: bankHook.saveValidationResult,
  });

  const value = {
    auth,
    toast, showToast,
    bank: bankHook,
    generate: generateHook,
    examBuilder: examBuilderHook,
    exportHook,
    courses: coursesHook,
    validation: validationHook,
    // Derived convenience
    allCourses,
    courseColors,
    course,
    courseObject,
    chapters,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside <AppProvider>");
  return ctx;
}
