---
name: ponytail-review
description: >
  Review a task diff for unnecessary complexity: duplicate contracts,
  speculative abstractions, redundant state, weak fallbacks and reinvented
  platform features. Use before finalizing code and during code reviews,
  or when asked for a Ponytail review. Complements correctness, security
  and accessibility review; does not apply fixes.
license: MIT
metadata:
  upstream: https://github.com/DietrichGebert/ponytail
  revision: c6ce46179874ea7368da0eb9e67c1ad5c10f08bc
  adaptation: HackSpain evidence, ownership and behavior constraints
---

# Ponytail Review

Read the request, applicable repository instructions, complete task diff,
existing owners and affected callers. Review without editing during the pass.
Do not infer the contract from the new implementation alone.

## What to look for

- **delete:** dead code or flexibility with no current consumer or requirement.
- **stdlib / native:** custom code or dependencies whose actual contract is
  already covered by an installed library or platform feature.
- **ownership:** copied types, schemas or helpers; pass-through layers;
  business rules in callers instead of their existing owner.
- **state:** values mirrored from query, server or route truth without an
  independent interaction or lifecycle.
- **contract:** widened values recovered with assertions, repeated internal
  parsing, or fallbacks that hide invalid required data or unexpected errors.

A wrapper with one caller may own a real boundary. Fewer lines alone are
not evidence of a better design. Preserve useful boundaries, requested
behavior, validation, compatibility, accessibility and error handling.

## Findings

For each actionable finding, give the file and line, concrete maintenance
cost or defect, existing owner or replacement, and what behavior must remain
verified. If the proposed replacement's semantics are uncertain, say so;
do not make it blocking on speculation or style preference.

If there are no findings, say so. Do not estimate lines saved or equate a
clean complexity pass with permission to ship. Report correctness, security
and accessibility defects in the normal review as well; never discard them
because this pass focuses on complexity.

Review findings do not authorize unrelated cleanup. Independent review is
independent only when performed by someone other than the implementer;
loading this skill in the author's context remains self-review.
