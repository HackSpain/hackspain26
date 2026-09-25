# HackSpain 2026 community snapshot

Frozen event data, captured on 24 September 2026. Do not refresh or modify these
historical values automatically. New data or a later edition must use a separate
snapshot. The original `insights-2026.json` and `insights-2026-charts.json` are unchanged.

## Source and population

Read-only production Convex inspection of `users`, `teamMembers`, `teams`,
`submissions` and `tracks`. No backend functions, tables or permissions were changed.
The cohort is the 254 distinct users with `teamMembers.status === "member"`, across
60 teams. This is team membership, not a headcount inferred from registration or
check-in: not all attendees have a recorded check-in. All 254 directory cards were
last updated before the event ended. These are event profiles, captured after the event.

Only aggregates and public team names are included in the published JSON. No user
IDs, individual profiles, emails, phone numbers, authentication data or free-text
bios are published. The recap displays the origin map and profile distributions.
Network, track and submission-time aggregates remain in the frozen snapshot,
but their charts were removed from the page.

## Calculations

- Cities use `directory.city`, not birthplace or nationality. Cities are grouped
  by autonomous community. Cabanillas is ambiguous (multiple municipalities) and
  remains unassigned; Andorra, Berna and Paris are outside Spain. The 250 mapped
  people, three outside Spain and one unassigned person sum to 254. Sixteen of
  the seventeen autonomous communities are represented; Ceuta and Melilla are
  included with zero. City spelling is retained from the profiles.
- Roles and universities count declared profile values. A university value is a
  profile affiliation, not verified enrollment. There are 22 missing university
  values. Skills and interests are deduplicated within each person.
- Network aggregates compare unions of team members’ skills, interests and
  universities. These describe potential affinities, not observed conversations,
  friendships or collaborations. The network chart is no longer displayed.
- Submitted projects use `status === "submitted"`: 58 projects. Two have two
  challenge IDs, so track counts sum to 60. The submission histogram counts each
  project's `submittedAt` once, in ten-minute half-open intervals in Europe/Madrid.
  The 10:50–11:00 interval contains 37 projects (63.8% of 58).

## Map

`spain-regions.json` contains simplified polygon paths derived from the Spanish
Ministry of Transportes autonomous-community layer:
https://mapas.fomento.gob.es/arcgis/rest/services/SIU/ENTIDADES_TERRITORIALES_EGRN/MapServer/1

Retrieved through the layer's GeoJSON query, in EPSG:4326, with 0.025 degree
simplification. The static SVG uses an equirectangular projection corrected for
Spain's latitude and an inset for the Canary Islands. Unassigned territories
(layer code 20) are omitted. The page attributes the cartography to its source.

## Integrity checks

Memberships: 29×5 + 20×4 + 9×3 + 2×1 = 254 across 60 teams. Roles sum to 254.
Map counts plus the outside/unassigned groups sum to 254. The graph's member counts
sum to 254. The submission histogram sums to 58 and the track histogram to 60.
