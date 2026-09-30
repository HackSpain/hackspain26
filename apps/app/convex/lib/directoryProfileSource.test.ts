import { strict as assert } from "node:assert";
import { test } from "bun:test";
import { matchesParticipantProfile } from "./directoryProfileSource";

const urls = [
  { kind: "github" as const, url: "https://github.com/SignupName" },
  {
    kind: "linkedin" as const,
    url: "https://www.linkedin.com/in/LinkedIn-Name/",
  },
];

test("directory enrichment accepts only identifiers on the selected participant", () => {
  assert.equal(
    matchesParticipantProfile("github", "username", "UserName", urls),
    true
  );
  assert.equal(
    matchesParticipantProfile("github", "signupname", undefined, urls),
    true
  );
  assert.equal(
    matchesParticipantProfile("linkedin", "linkedin-name", undefined, urls),
    true
  );

  assert.equal(
    matchesParticipantProfile("github", "someone-else", "UserName", urls),
    false
  );
  assert.equal(
    matchesParticipantProfile("github", "signupname", "UserName", urls),
    false
  );
  assert.equal(
    matchesParticipantProfile("linkedin", "someone-else", undefined, urls),
    false
  );
  assert.equal(
    matchesParticipantProfile("linkedin", "linkedin-name", undefined, []),
    false
  );
});
