type Identity = {
  id: string;
  firstName: string;
  lastName: string;
  institution: string | null;
  title: string | null;
  party: string | null;
  sourceSystem: string | null;
  sourceId: string | null;
};
const normalize = (v: string | null | undefined) =>
  (v ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const nameKey = (p: { firstName: string; lastName: string }) =>
  `${normalize(p.firstName)}|${normalize(p.lastName)}`;

/** Legacy imports sometimes omitted the institution. Only a unique, compatible match is reused. */
export function legacyContactMatcher(existing: Identity[]) {
  const byName = new Map<string, Identity[]>();
  for (const c of existing)
    byName.set(nameKey(c), [...(byName.get(nameKey(c)) ?? []), c]);
  return (person: Omit<Identity, "id">) => {
    const candidates = (byName.get(nameKey(person)) ?? []).filter((c) => {
      if (
        c.institution &&
        person.institution &&
        normalize(c.institution) !== normalize(person.institution)
      )
        return false;
      if (
        c.sourceId &&
        person.sourceId &&
        (c.sourceId !== person.sourceId ||
          c.sourceSystem !== person.sourceSystem)
      )
        return false;
      return (
        ["party", "title"].every((k) => {
          const field = k as "party" | "title";
          return (
            !c[field] ||
            !person[field] ||
            normalize(c[field]) === normalize(person[field])
          );
        }) &&
        Boolean(
          c.title &&
            person.title &&
            normalize(c.title) === normalize(person.title),
        )
      );
    });
    return candidates.length === 1 ? candidates[0]!.id : undefined;
  };
}

export function matchesEmailIdentity(
  person: {
    firstName: string;
    lastName: string;
    email?: string | null;
    institution?: string | null;
    title?: string | null;
    sourceId?: string | null;
  },
  contact:
    | {
        firstName: string;
        lastName: string;
        email?: string | null;
        institution?: string | null;
        title?: string | null;
        sourceId?: string | null;
      }
    | undefined,
) {
  return Boolean(
    contact &&
      person.email &&
      normalize(contact.email) === normalize(person.email) &&
      nameKey(person) === nameKey(contact) &&
      (!person.institution ||
        !contact.institution ||
        normalize(person.institution) === normalize(contact.institution)) &&
      (!person.title ||
        !contact.title ||
        normalize(person.title) === normalize(contact.title)) &&
      (!person.sourceId ||
        !contact.sourceId ||
        person.sourceId === contact.sourceId),
  );
}
