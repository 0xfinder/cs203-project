import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getValidAccessToken } from "@/lib/session";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const token = await getValidAccessToken();
    if (token) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => {
    const [dark, setDark] = useState<boolean>(() => {
      try {
        const saved = localStorage.getItem("theme");
        if (saved) return saved === "dark";
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      } catch {
        return true;
      }
    });

    useEffect(() => {
      try {
        if (dark) {
          document.documentElement.classList.add("dark");
          localStorage.setItem("theme", "dark");
        } else {
          document.documentElement.classList.remove("dark");
          localStorage.setItem("theme", "light");
        }
      } catch {}
    }, [dark]);

    return (
      <div className="al-hero">
        <div className="al-deco-pink" />
        <div className="al-deco-indigo" />

        <div className="al-card">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="al-title">
                <span className="al-title-alpha">alpha</span>
                <span className="al-title-plain">lingo</span>
              </h1>
              <p className="al-subtitle">
                Learn Gen Alpha slang through quick lessons and real examples.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                aria-label="Toggle theme"
                onClick={() => setDark((d) => !d)}
                className="al-toggle"
              >
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/12">
                  {dark ? "🌙" : "☀️"}
                </span>
                <span className="sr-only">Toggle theme</span>
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            <Link to="/login" className="al-cta">
              Sign up
            </Link>

            <Link to="/login" className="al-cta">
              Log in
            </Link>
          </div>

          <p className="mt-6 text-sm text-white/60">
            Perfect for parents, educators, and curious learners who want to keep up with Gen Alpha.
          </p>
        </div>
      </div>
    );
  },
});
