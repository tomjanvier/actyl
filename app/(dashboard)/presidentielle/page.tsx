import { redirect } from "next/navigation";

/**
 * Compatibilité avec les anciens favoris : le référentiel présidentiel se
 * gère désormais comme toutes les autres listes partagées.
 */
export default function PresidentiellePage() {
  redirect("/lists#list-presidentielle-2027");
}
