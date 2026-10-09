import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const referral = {};
const signup = {};

// Use the project's TypeScript so the tests also run on Node 22.12.
for (const [name, exports] of [
  ["referral-code", referral],
  ["signup-validation", signup],
]) {
  const source = readFileSync(
    new URL(`src/lib/${name}.ts`, import.meta.url),
    "utf8"
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(outputText, {
    URL,
    exports,
    require: (specifier) =>
      specifier === "./referral-code" ? referral : require(specifier),
  });
}

const { parseSignupBody, parseSignupBodyClient } = signup;
const validBody = {
  achievements: " Built a project ",
  ambassadorMotivation: "",
  email: " SAMUEL@EXAMPLE.COM ",
  freeTime: " Code ",
  fullName: " Samuel ",
  githubUrl: "samuel",
  heardFromSources: ["x"],
  isUnderThirty: true,
};

const errorCases = [
  [{ githubUrl: "" }, "social_required", "social_required"],
  [
    { githubUrl: "javascript:alert(1)" },
    "invalid_social_url",
    "invalid_social_url",
  ],
  [{ email: "invalid" }, "invalid_email", "invalid_email"],
  [{ fullName: " " }, "fullName_required", "fullName"],
  [
    { occupationStatuses: ["student"] },
    "study_institution_required",
    "study_institution",
  ],
  [{ occupationStatuses: ["working"] }, "employer_required", "employer"],
  [
    { dietaryRestrictions: ["vegan"] },
    "dietary_consent_required",
    "dietary_consent",
  ],
  [{ isUnderThirty: false }, "under_thirty_required", "under_thirty"],
  [{ heardFromSources: [] }, "heard_from_required", "heard_from"],
  [
    { wantsAmbassador: true },
    "ambassador_motivation_required",
    "ambassador_motivation",
  ],
  [
    { heardFromSources: ["other"] },
    "heard_from_other_required",
    "heard_from_other",
  ],
  [{ invitationToken: "not-a-uuid" }, "invalid_invitation", "generic"],
  [{ achievements: undefined }, "invalid_request", "generic"],
  [{ heardFromSources: ["unknown"] }, "invalid_request", "generic"],
];

for (const [patch, error, code] of errorCases) {
  test(`signup maps ${JSON.stringify(patch)} to ${error} / ${code}`, () => {
    const body = { ...validBody, ...patch };
    const server = parseSignupBody(body);
    const client = parseSignupBodyClient(body);
    assert.equal(server.ok, false);
    assert.equal(server.error, error);
    assert.equal(server.status, 400);
    assert.equal(client.ok, false);
    assert.equal(client.code, code);
  });
}

test("signup preserves the first issue when several fields are invalid", () => {
  const body = { ...validBody, email: "invalid", fullName: "" };
  assert.equal(parseSignupBody(body).error, "invalid_email");
  assert.equal(parseSignupBodyClient(body).code, "invalid_email");

  const multipleRequirements = {
    ...validBody,
    githubUrl: "",
    isUnderThirty: false,
    wantsAmbassador: true,
  };
  assert.equal(parseSignupBody(multipleRequirements).error, "social_required");
  assert.equal(
    parseSignupBodyClient(multipleRequirements).code,
    "social_required"
  );
});

test("both signup adapters preserve normalization and optional defaults", () => {
  const body = {
    ...validBody,
    heardFromOther: " A meetup ",
    heardFromSources: ["x", "other", "x"],
    referralCode: " referral_123 ",
  };
  const server = parseSignupBody(body);
  const client = parseSignupBodyClient(body);
  assert.equal(server.ok, true);
  assert.equal(client.ok, true);
  // The schema creates arrays in the isolated VM; compare their serialized data.
  const data = JSON.parse(JSON.stringify(server.data));
  assert.deepEqual(JSON.parse(JSON.stringify(client.data)), data);
  assert.equal(data.fullName, "Samuel");
  assert.equal(data.email, "samuel@example.com");
  assert.equal(data.githubUrl, "https://github.com/samuel");
  assert.equal(data.achievements, "Built a project");
  assert.equal(data.freeTime, "Code");
  assert.equal(data.referralCode, "referral_123");
  assert.deepEqual(data.heardFrom, ["x", "other:A meetup"]);
  assert.equal(data.heardFromSources, undefined);
  assert.equal(data.heardFromOther, undefined);
  assert.equal(data.dietaryDataConsent, false);
  assert.equal(data.wantsAmbassador, false);
  assert.equal(data.invitationToken, "");
});
