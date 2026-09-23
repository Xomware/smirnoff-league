import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { clearLeagueCache } from "@/lib/league/cache";

// CI runners render the full desktop slower than a laptop; the 1s default
// failed "Season owed" at 1.18s on PR #96 while passing locally.
configure({ asyncUtilTimeout: 5000 });

// Testing Library only auto-cleans when the runner exposes a global afterEach;
// vitest does not unless `globals: true`.
afterEach(cleanup);
// The cache lives for the session, and each test stubs its own Sleeper.
afterEach(clearLeagueCache);

// jsdom implements neither. Defaults are "no preference" and an observer that
// never fires; tests that care stub their own.
vi.stubGlobal(
  "matchMedia",
  (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList,
);

// Node 25 defines its own global localStorage, which is an empty stub unless
// node runs with --localstorage-file, and it shadows jsdom's working one.
vi.stubGlobal("localStorage", (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window.localStorage);

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
