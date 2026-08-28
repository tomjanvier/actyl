"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(!document.documentElement.classList.contains("dark") === false);
    // Se synchronise avec le script qui évite le clignotement initial.
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("actyl_theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} title={dark ? "Thème clair" : "Thème sombre"}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
