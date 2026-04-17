"use client";
import { useState, useEffect } from "react";
import {
  loadCourses as _loadCourses,
  saveCourse as _saveCourse,
  deleteCourse as _deleteCourse,
} from "../lib/supabase/courses.js";

export function useCourses() {
  const [courses, setCourses] = useState([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    try {
      const data = await _loadCourses();
      setCourses(data);
      setCoursesLoaded(true);
      return data;
    } catch (e) {
      console.error("useCourses loadCourses error:", e);
      setCoursesLoaded(true);
      return [];
    }
  }

  async function saveCourse(course) {
    const saved = await _saveCourse(course);
    await loadCourses();
    return saved;
  }

  async function deleteCourse(id) {
    await _deleteCourse(id);
    setCourses(prev => prev.filter(c => c.id !== id));
  }

  return {
    courses, setCourses,
    coursesLoaded,
    loadCourses,
    saveCourse,
    deleteCourse,
  };
}
