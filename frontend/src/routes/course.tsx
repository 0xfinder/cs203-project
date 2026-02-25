import { createFileRoute } from '@tanstack/react-router'
import React, { useEffect, useState } from "react";


export const Route = createFileRoute('/course')({
  component: () => {
      const [dark, setDark] = useState<boolean>(() => {
        try {
          const saved = localStorage.getItem("theme");
          if (saved) return saved === "dark";
          return (
            window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          );
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
                      <h1 className="al-title"><span className="al-title-alpha">Courses</span></h1>
                    </div>
                  </div>
      
                  <p className="mt-2 text-sm text-white/60">Courses that are enrolled will be shown below</p>
                </div>
              </div>
            );
}})

