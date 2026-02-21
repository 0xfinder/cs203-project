import { } from "react";
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
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            <Link to="/login#signup" className="al-cta">
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
