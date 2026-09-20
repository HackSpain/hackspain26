import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FINAL_EMAIL_SUBJECT,
  finalEmailHtml,
  finalEmailText,
  firstNameFrom,
} from "./finalEmail";

const content = {
  cancelUrl: "https://app.hackspain.com/final/cancelar?token=abc",
  firstName: "Ada",
  logoUrl: "https://hackspain.com/hs-email-logo.png",
};

test("final email is a congratulations with a confirm-only cancel link", () => {
  const html = finalEmailHtml(content);
  const text = finalEmailText(content);

  assert.equal(FINAL_EMAIL_SUBJECT, "Estás en la final de HackSpain 2026 · 16:30");
  assert.match(html, /Has pasado a la final de HackSpain 2026/);
  assert.match(html, /16:30/);
  assert.match(text, /A LAS 16:30/);
  assert.match(html, /Enhorabuena, Ada/);
  assert.match(html, /El clic no cancela nada/);
  assert.match(html, /href="https:\/\/app\.hackspain\.com\/final\/cancelar\?token=abc"/);
  assert.doesNotMatch(html, /18 a 20/);
  assert.match(html, /OneCowork Recoletos/);
  assert.match(html, /C\. de Prim, 12, Centro, 28004 Madrid/);
  assert.match(text, /El enlace abre una página de confirmación/);
  assert.match(text, /C\. de Prim, 12, Centro, 28004 Madrid/);
  assert.ok(text.includes(content.cancelUrl));
});

test("final email escapes participant-controlled HTML", () => {
  const html = finalEmailHtml({
    ...content,
    firstName: '<img src=x onerror="alert(1)">',
  });

  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test("firstNameFrom keeps the first token", () => {
  assert.equal(firstNameFrom("Ada Lovelace"), "Ada");
  assert.equal(firstNameFrom("  "), "hacker");
});
