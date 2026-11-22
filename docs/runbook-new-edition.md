# New edition

Keep this short. The previous edition's rows stay; only `current` and the calendar move.

1. Insert the new `editions` row (`slug`, `label`, empty calendar, `current: false`). Seed roles are global — do not clone them.
2. Fill `/admin/event` on the new slug (admin edition switcher, localStorage `hackspain.admin.edition`): applications, weekend lock, check-in, submit, overrides.
3. When the previous edition is closed, an admin action makes the new row `current`. Participants and the CLI then see only that edition.  People from last year need a new participation (with a role) to get in.
4. Accept from Personas. Past-edition **Añadir** / create perk stay disabled.

Do not clone the previous edition. Do not write to production Convex from a laptop. Do not touch the Neon project.
