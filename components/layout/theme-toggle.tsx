"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
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
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      title={dark ? "Passer au thème clair" : "Passer au thème sombre"}
      aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
