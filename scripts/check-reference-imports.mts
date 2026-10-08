import assert from "node:assert/strict";
import {
  legacyContactMatcher,
  matchesEmailIdentity,
} from "../lib/import-contact-match";
import { parseCommissions } from "../lib/commission-values";
import { withDbTransaction } from "../lib/db-transaction";
import { accountRequestContributions } from "../lib/account-request-contributions";
import { db } from "../lib/db";
assert.deepEqual(parseCommissions("Finances"), ["Finances"]);
assert.deepEqual(parseCommissions('["Finances","Lois"]'), ["Finances", "Lois"]);
assert.deepEqual(parseCommissions("[]"), []);
const contact = {
  id: "legacy",
  firstName: "Élodie",
  lastName: "Martin",
  institution: null,
  title: "Député·e",
  party: "Groupe A",
  sourceSystem: null,
  sourceId: null,
};
const imported = {
  ...contact,
  institution: "Assemblée nationale",
  sourceSystem: "assemblee-nationale",
  sourceId: "PA123",
};
assert.equal(legacyContactMatcher([contact])(imported), "legacy");
assert.equal(
  legacyContactMatcher([contact])({ ...imported, party: "Groupe B" }),
  undefined,
);
assert.equal(
  legacyContactMatcher([contact, { ...contact, id: "ambiguous" }])(imported),
  undefined,
);
assert.equal(
  legacyContactMatcher([
    { ...contact, sourceSystem: "assemblee-nationale", sourceId: "PA999" },
  ])(imported),
  undefined,
);
assert.equal(
  matchesEmailIdentity(
    { ...contact, email: "person@example.org" },
    { ...contact, email: "PERSON@example.org" },
  ),
  true,
);
assert.equal(
  matchesEmailIdentity(
    { ...contact, email: "person@example.org" },
    { ...contact, firstName: "Other", email: "person@example.org" },
  ),
  false,
);
if (process.env.DATABASE_URL && process.argv.includes("--database")) {
  assert.equal((await accountRequestContributions(["__actyl_nonexistent_request__"])).size, 0);
  const marker = `__actyl_transaction_check_${Date.now()}__`;
  await assert.rejects(
    withDbTransaction(async (tx) => {
      await tx.appSetting.create({ data: { key: marker, value: "rollback" } });
      throw new Error("EXPECTED_ROLLBACK");
    }),
    /EXPECTED_ROLLBACK/,
  );
  assert.equal(
    await db.appSetting.findUnique({ where: { key: marker } }),
    null,
  );
}
await db.$disconnect();
console.log(
  "Reference imports: legacy identity conflicts, commission values and optional transaction rollback passed.",
);
