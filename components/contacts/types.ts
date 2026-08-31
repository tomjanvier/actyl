export type CustomFieldLite = {
  id: string;
  label: string;
  name: string;
  type: string;
  options: string | null;
};

export type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  institution: string | null;
  party: string | null;
  region: string | null;
  level: string;
  stance: string;
  influenceScore: number;
  bio: string | null;
  photoUrl: string | null;
  themes: string | null;
  twitter: string | null;
  linkedin: string | null;
  website: string | null;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
  // Statut EmailOctopus présent lorsque le module newsletter est actif.
  newsletterStatus?: string | null;
  newsletterSyncedAt?: string | null;
  customValues: Record<string, string>;
  emailsReceived: number;
};

export type MyNote = {
  id: string;
  contactId: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

export type OrgNote = {
  id: string;
  contactId: string;
  authorName: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

export type CandidateProfile = {
  teamId: string;
  candidateName: string;
  programUrl: string | null;
  positions: Array<{
    id: string;
    topic: string;
    summary: string;
    stance: string;
    groupName: string;
    canDelete: boolean;
  }>;
};
