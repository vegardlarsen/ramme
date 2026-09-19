// Entur JourneyPlanner v3: one GraphQL request covering every configured
// departure group (stop + line whitelist), realtime times and disruption
// notices included.
const SIT = 'situations { summary { value language } }';

export const buildQuery = (groups) => `{ ${groups.map((g, i) =>
  `g${i}: stopPlace(id: ${JSON.stringify(g.stop)}) {
     estimatedCalls(numberOfDepartures: 20, timeRange: 259200, whiteListed: {lines: ${JSON.stringify(g.lines)}}) {
       realtime aimedDepartureTime expectedDepartureTime cancellation
       destinationDisplay { frontText }
       ${SIT}
       serviceJourney { line { ${SIT} } }
     } }`).join(' ')} }`;

const noText = (summary) =>
  (summary.find((t) => t.language === 'no') ?? summary[0])?.value;

export function normalizeDepartures(data, groups, now = Date.now()) {
  return groups.map((g, i) => {
    let calls = data[`g${i}`]?.estimatedCalls ?? [];
    if (g.destination) calls = calls.filter((c) => c.destinationDisplay?.frontText === g.destination);
    if (g.withinHours) calls = calls.filter((c) =>
      new Date(c.expectedDepartureTime) - now <= g.withinHours * 3_600_000);
    calls = calls.slice(0, g.count ?? 3);
    const situations = [...new Set(calls
      .flatMap((c) => [...c.situations, ...c.serviceJourney.line.situations])
      .map((s) => noText(s.summary)).filter(Boolean))];
    return {
      label: g.label, alert: !!g.alert, situations,
      calls: calls.map((c) => ({
        aimed: c.aimedDepartureTime, expected: c.expectedDepartureTime,
        cancelled: c.cancellation, realtime: c.realtime,
      })),
    };
  });
}

export async function fetchDepartures(groups) {
  if (!groups?.length) return [];
  const res = await fetch('https://api.entur.io/journey-planner/v3/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ET-Client-Name': 'vegard-ramme' },
    body: JSON.stringify({ query: buildQuery(groups) }),
  });
  if (!res.ok) throw new Error(`entur -> ${res.status}`); // transient: let cached() serve stale
  const { data, errors } = await res.json();
  if (errors) throw new Error(`entur: ${errors[0].message}`);
  return normalizeDepartures(data, groups);
}
