# Job dispatch, not flag relay, moves goods

Status: accepted (2026-09-26)

Milestone 1 built two hauling models side by side and played the three scenario maps (short haul, long haul, branching network) under each: **job dispatch**, where a dispatcher hands each idle Carrier one Haul from a source to a site or Stockpile and the Carrier walks there over any tiles, faster on Roads; and **flag relay** (Settlers 2 style), where Flags split Roads into Segments, each Segment is worked by one Carrier, and goods are handed on Flag to Flag. We picked job dispatch because laying out Flags was fiddly: placing and spacing Flags and keeping Segments staffed felt like busywork rather than the fun of designing a settlement that runs itself.

## Considered options

- **Flag relay.** Each Segment is a visible belt with its own throughput, so it looked the most belt-like and put bottlenecks on the road itself. Rejected for layout friction, the risk the spec already named ("frustrating if road layout is unforgiving").

## Consequences

- What we gave up: per-Segment throughput and bottlenecks that show where they are. Under job dispatch, throughput is set by Carrier count and walking distance, and a stall is less legible (spec, Logistics table). The spec's readability tools (idle-workshop icons, a Carrier-utilization meter, a road heat-map) now have to carry that on their own.
- Roads matter through walking speed only: dispatch measures nearness by walking cost, so a better Road draws Hauls onto it.
- The `LogisticsModel` interface and model registry are gone; hauling is `logistics/jobDispatch.ts`, called by the hauling system. Flag relay is in git history (commit `7eab3c1` and the playtest commits after it) if it's ever worth revisiting.
