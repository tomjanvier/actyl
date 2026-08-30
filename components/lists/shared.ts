import { fullName } from "@/lib/utils";

export { fullName };

export type ContactLite = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  institution: string | null;
  party: string | null;
  level: string;
  stance: string;
  email: string | null;
  photoUrl: string | null;
  avatarColor: string;
};

export type ListAttribute = { id: string; label: string };

export type ListWithItems = {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
  sourcePack?: string | null;
  items: Array<{ itemId: string; contact: ContactLite }>;
  totalItems: number;
  memberContactIds: string[];
  /** Attributs propres à cette liste. */
  attributes?: ListAttribute[];
  /** Associe la clé « contactId:fieldId » à sa valeur. */
  values?: Record<string, string>;
};
