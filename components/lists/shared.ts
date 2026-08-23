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
  avatarColor: string;
};

export type ListAttribute = { id: string; label: string };

export type ListWithItems = {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
  items: Array<{ itemId: string; contact: ContactLite }>;
  /** Attributes dedicated to this list (list-scoped custom fields). */
  attributes?: ListAttribute[];
  /** "contactId:fieldId" → value. */
  values?: Record<string, string>;
};
