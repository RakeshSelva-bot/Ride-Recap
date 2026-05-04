import { parseTimeline } from "../lib/timeline";

const newFormatWithDegrees = JSON.stringify([
  {
    startTime: "2026-04-15T03:45:00.000Z",
    endTime: "2026-04-15T04:10:00.000Z",
    activity: { topCandidate: { type: "TYPE_IN_PASSENGER_VEHICLE" }, distanceMeters: "5200" },
    timelinePath: [
      { point: "12.9716°, 77.5946°", time: "2026-04-15T03:45:00.000Z" },
      { point: "12.9650°, 77.5850°", time: "2026-04-15T03:50:00.000Z" },
      { point: "12.9550°, 77.5800°", time: "2026-04-15T03:55:00.000Z" },
      { point: "12.9479°, 77.5749°", time: "2026-04-15T04:10:00.000Z" },
    ],
  },
]);

const newFormatGeoStyle = JSON.stringify([
  {
    startTime: "2026-04-15T03:45:00.000Z",
    endTime: "2026-04-15T04:10:00.000Z",
    activity: { topCandidate: { type: "walking" } },
    timelinePath: [
      { point: "geo:12.9716,77.5946" },
      { point: "geo:12.9479,77.5749" },
    ],
  },
]);

const oldFormat = JSON.stringify({
  timelineObjects: [
    {
      activitySegment: {
        duration: { startTimestamp: "2026-04-15T03:45:00Z", endTimestamp: "2026-04-15T04:10:00Z" },
        activityType: "IN_PASSENGER_VEHICLE",
        distance: 5200,
        waypointPath: {
          waypoints: [
            { latE7: 129716000, lngE7: 775946000 },
            { latE7: 129479000, lngE7: 775749000 },
          ],
        },
      },
    },
  ],
});

const cases = [
  ["New format with degree symbols", newFormatWithDegrees],
  ["New format with geo: prefix", newFormatGeoStyle],
  ["Old format with E7 waypoints", oldFormat],
] as const;

for (const [label, json] of cases) {
  const r = parseTimeline(json);
  const p = r.paths[0];
  if (!p) {
    console.log(`FAIL  ${label}: no paths extracted`);
    continue;
  }
  console.log(`OK    ${label}: ${p.points.length} points`);
  for (const pt of p.points) console.log(`        (${pt.lat}, ${pt.lng})`);
}
