"use client";
import ExamGeneratorScreen from "../../../components/screens/ExamGeneratorScreen.jsx";

// Route for the guided Exam Generator wizard. The screen reads all of its state
// and option data from useAppContext() (wired in app/app/layout.js via
// <AppProvider>), so this page is a thin mount point — mirroring the other
// /app/* routes while keeping the screen self-contained.
export default function ExamGeneratorPage() {
  return <ExamGeneratorScreen />;
}
