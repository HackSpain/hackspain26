import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LINKEDIN_PROFILE_FRESH_MS,
  linkedinProfileIsStale,
  missingLinkedinProfile,
  normalizeLinkedinSlug,
  profileFromNyne,
} from "./linkedinProfile";

test("linkedin slugs come from /in/ urls, not company pages", () => {
  assert.equal(
    normalizeLinkedinSlug("https://www.linkedin.com/in/SatyaNadella/"),
    "satyanadella",
  );
  assert.equal(
    normalizeLinkedinSlug("es.linkedin.com/in/satyanadella/en"),
    "satyanadella",
  );
  assert.equal(normalizeLinkedinSlug("satyanadella"), "satyanadella");
  assert.equal(
    normalizeLinkedinSlug("https://www.linkedin.com/company/microsoft"),
    null,
  );
});

test("a Nyne person result becomes the directory LinkedIn card", () => {
  const profile = profileFromNyne(
    {
      displayname: "Jane Doe",
      headline: "VP of Product at Acme",
      location: "San Francisco, CA",
      organizations: [
        { is_current: true, name: "Acme", title: "VP of Product" },
        { is_current: false, name: "StartupXYZ", title: "Product Manager" },
      ],
      social_profiles: {
        linkedin: { followers: 2847, url: "https://linkedin.com/in/janedoe" },
      },
      total_experience_years: 12,
    },
    "janedoe",
    10,
  );
  assert.equal(profile.missing, false);
  assert.equal(profile.name, "Jane Doe");
  assert.equal(profile.company, "Acme");
  assert.equal(profile.followers, 2847);
  assert.equal(profile.years, 12);
  assert.equal(profile.experience[1]?.name, "StartupXYZ");
});

test("an empty Nyne result is stored as missing", () => {
  assert.equal(profileFromNyne({}, "someone", 1).missing, true);
  assert.equal(linkedinProfileIsStale(null, 1), true);
  assert.equal(
    linkedinProfileIsStale({ fetchedAt: 1 }, 1 + LINKEDIN_PROFILE_FRESH_MS),
    true,
  );
  assert.equal(missingLinkedinProfile("x", 1).slug, "x");
});
