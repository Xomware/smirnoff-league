const STATE: Record<string, string> = {
  STATUS_SCHEDULED: "pre",
  STATUS_IN_PROGRESS: "in",
  STATUS_HALFTIME: "in",
  STATUS_END_PERIOD: "in",
  STATUS_FINAL: "post",
};

interface EventOptions {
  home: string;
  away: string;
  status?: string;
  period?: number;
  clock?: string;
  date?: string;
}

// An event in ESPN's scoreboard shape, as captured 2026-09-22.
export function espnEvent({ home, away, status = "STATUS_SCHEDULED", period = 0, clock = "0:00", date = "2026-09-27T17:00Z" }: EventOptions) {
  return {
    id: `${away}@${home}`,
    date,
    status: {
      period,
      displayClock: clock,
      type: { name: status, state: STATE[status], completed: status === "STATUS_FINAL" },
    },
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { abbreviation: home } },
          { homeAway: "away", team: { abbreviation: away } },
        ],
      },
    ],
  };
}

export const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;
