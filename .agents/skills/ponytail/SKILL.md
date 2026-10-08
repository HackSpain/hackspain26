---
name: ponytail
description: >
  Choose the simplest correct implementation for coding, debugging,
  refactoring, architecture, reviews and dependency decisions. Reuse existing
  contracts and platform features before adding code or abstractions. Supports
  lite, full (default) and ultra. Also use when asked for Ponytail, YAGNI or a
  minimal solution; not for unrelated prose or general knowledge.
license: MIT
metadata:
  upstream: https://github.com/DietrichGebert/ponytail
  revision: c6ce46179874ea7368da0eb9e67c1ad5c10f08bc
  adaptation: HackSpain ownership, verification and review constraints
  argument-hint: '[lite|full|ultra]'
---

# Ponytail

Lazy means efficient, not careless. The best code is often code never written.
Optimize for fewer concepts and owners, not the fewest characters.

## Understand before simplifying

Read the request, relevant instructions, the existing owner and affected
callers. Trace the flow through its contract, state and persistence before
choosing a solution. For a bug, establish why the behavior is wrong and fix
it where it originates; a guard at each caller leaves the cause alive.

## The ladder

Stop at the first option that meets the actual requirements:

1. **Does it need to exist?** Skip speculative work, not requested behavior.
2. **Already in this codebase?** Reuse the owner, helper, schema or pattern.
3. **Stdlib or platform?** Prefer a built-in feature when its behavior fits.
4. **Already-installed dependency?** Use its supported API before wrapping it.
5. **Only then:** write the minimum clear code that works.

This is a decision, not an exhaustive research project. Choose the option
that preserves the contract, edge cases and accessibility. A shorter diff
in the wrong layer is a second bug; a dense one-liner is not a goal.

## Implementation

- Add an abstraction, wrapper, configuration knob or dependency only for a
  concrete gap in the current task. One caller alone neither proves nor
  disproves that a boundary is useful; name the responsibility it owns.
- Derive types from the schema, generated API, SDK or existing export that
  owns them. Do not copy shapes, widen them and cast back, or repeat runtime
  validation throughout an already typed internal flow.
- Avoid mirrored state and fallback values that conceal missing required
  data. Preserve unexpected errors instead of converting them to success.
- Delete code made obsolete by this task. Do not turn a focused change into
  a repository cleanup, a formatting sweep or a rewrite of unrelated tests.
- Explain a deliberate limitation in a comment only when future maintainers
  need its reason or ceiling; do not narrate the code or mandate a marker.
- Challenge complexity with a concrete simpler alternative. Once the user
  has chosen the required behavior, implement it without re-arguing scope.

## Verification and review

Use the repository's configured checks and test tools. Add tests only for
behavior introduced or fixed by the task, at the relevant contract; existing
coverage may already suffice. Do not invent a demo, production assertion or
new test framework as a universal minimum.

Before finalizing or reviewing code, read [Ponytail Review](../ponytail-review/SKILL.md)
and inspect the complete task diff and affected callers. Also review
correctness, security and accessibility. A complexity pass cannot establish
that a change is safe or that its checks passed.

## Intensity

- **lite:** implement the request and mention a simpler alternative when useful.
- **full:** enforce the ladder and smallest correct design. Default.
- **ultra:** challenge speculative scope and favor deletion more strongly.

Use the user's chosen level for the coding task until they change it or say
“stop ponytail” or “normal mode”. Do not apply the mode to unrelated requests.

## Boundaries and delivery

Never simplify away validation at trust boundaries, data-loss protection,
security, accessibility, required compatibility or explicitly requested
behavior. Repository instructions and the user's scope govern verification
and permissions; this skill grants no external-action authority.

Report what changed, the relevant tradeoff, executed verification and any
remaining limitation. Keep it concise unless the user asks for detail.
