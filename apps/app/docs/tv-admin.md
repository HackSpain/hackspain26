# Venue TV administration

`/admin/tv` builds on the existing canvas and saved layouts. Saved screens are in a left sidebar; editing and publishing are separate actions. Saving changes to the currently live layout updates the venue screens.

- Restore defaults loads the aggregate Insights composition without team leaderboards. It saves a recovery copy of the working canvas and preserves the published layout.
- Text sizes accept 8–240 reference pixels on a 1920px canvas, scaling with the display. Existing semantic presets retain their rendering until edited. Geometry accepts decimal percentages.
- Insights widgets still use demo data. Do not present them as live telemetry or add private participant data to this public screen.
- `/tv` consumes the existing public layout through Convex subscriptions and a `/api/tv` HTTP fallback every 20 seconds. It retains the last snapshot in memory through connection failures.
- Remote reload increments a version consumed once per tab, persisted before reloading. The recovery controller is outside widget rendering errors. There is no per-screen delivery acknowledgement or classroom inventory.
- Venue computers must stay awake with their browser open; JavaScript cannot recover suspended or closed browsers.

This feature does not introduce registration, access codes, reception routes, check-in, or participant access gates.
