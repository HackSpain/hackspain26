import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCESS_CODE_EMAIL_SUBJECT,
  accessCodeEmailHtml,
  accessCodeEmailSubject,
  accessCodeEmailText,
} from "./accessCodeEmail";

test("access code email renders the recipient and code in both formats", () => {
  const content = { code: "AB7K", name: "Ada Lovelace" };
  const html = accessCodeEmailHtml(content);
  const text = accessCodeEmailText(content);

  assert.equal(
    ACCESS_CODE_EMAIL_SUBJECT,
    "Tu código de acceso a HackSpain 2026"
  );
  assert.match(html, /Hola, Ada Lovelace/);
  assert.match(html, />AB7K</);
  assert.match(html, /https:\/\/hackspain\.app/);
  assert.doesNotMatch(html, /Caduca en 15 minutos/);
  assert.match(text, /Hola Ada Lovelace/);
  assert.match(text, /es: AB7K/);
});

test("access code email escapes participant-controlled HTML", () => {
  const html = accessCodeEmailHtml({
    code: "AB7K",
    name: '<img src=x onerror="alert(1)">',
  });

  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test("accessCodeEmailSubject uses the edition label when provided", () => {
  assert.equal(accessCodeEmailSubject(), ACCESS_CODE_EMAIL_SUBJECT);
  assert.equal(
    accessCodeEmailSubject("HackSpain 2027"),
    "Tu código de acceso a HackSpain 2027"
  );
});

test("access code email copy follows the edition when provided", () => {
  const html = accessCodeEmailHtml({
    code: "AB7K",
    datesLine: "Madrid · 12—14 marzo 2027",
    label: "HackSpain 2027",
    name: "Ada",
  });
  assert.match(html, /HackSpain 2027/);
  assert.match(html, /Madrid · 12—14 marzo 2027/);
  assert.doesNotMatch(html, /HackSpain 2026/);
});
