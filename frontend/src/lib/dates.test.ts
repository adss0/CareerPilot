import { describe, expect, it } from "vitest";

import { formatDate, parseServerDate } from "./dates";

describe("server dates", () => {
  it("reads a time without a zone as UTC", () => {
    expect(parseServerDate("2026-11-19T23:30:00").toISOString()).toBe("2026-11-19T23:30:00.000Z");
  });

  it("keeps a zone that's already there", () => {
    expect(parseServerDate("2026-11-19T23:30:00Z").toISOString()).toBe("2026-11-19T23:30:00.000Z");
    expect(parseServerDate("2026-11-19T23:30:00+01:00").toISOString()).toBe(
      "2026-11-19T22:30:00.000Z",
    );
    expect(parseServerDate("2026-11-19T23:30:00.123456").getUTCMilliseconds()).toBe(123);
  });

  it("shows the day in local time, the same as the rest of the app", () => {
    const value = "2026-11-19T23:30:00";
    expect(formatDate(value)).toBe(new Date(Date.UTC(2026, 10, 19, 23, 30)).toLocaleDateString());
  });
});
