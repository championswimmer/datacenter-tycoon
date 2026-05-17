import { describe, it, expect } from "vitest";
import {
  tickToGameDate,
  toGameTimeView,
  formatGameDate,
  formatGameDateShort,
  monthsAndDaysBetween,
  formatRemaining,
  EPOCH_YEAR,
} from "./gameTime.js";

describe("tickToGameDate", () => {
  it("tick 0, no fraction → Jan 2025, day 1", () => {
    expect(tickToGameDate(0)).toEqual({ year: 2025, month: 0, day: 1 });
  });

  it("tick 0, fraction 0.5 → Jan 2025, day 16", () => {
    expect(tickToGameDate(0, 0.5)).toEqual({ year: 2025, month: 0, day: 16 });
  });

  it("authoritative subtick + animation fraction advances from the current day", () => {
    expect(tickToGameDate(0, 14, 0.5)).toEqual({ year: 2025, month: 0, day: 15 });
  });

  it("tick 12 → Jan 2026, day 1 (new year rollover)", () => {
    expect(tickToGameDate(12)).toEqual({ year: 2026, month: 0, day: 1 });
  });

  it("tick 13, fraction 0.5 → Feb 2026, day 16", () => {
    expect(tickToGameDate(13, 0.5)).toEqual({ year: 2026, month: 1, day: 16 });
  });

  it("tick 11 → Dec 2025", () => {
    expect(tickToGameDate(11)).toEqual({ year: 2025, month: 11, day: 1 });
  });

  it("fraction 0 always gives day 1", () => {
    expect(tickToGameDate(5, 0).day).toBe(1);
  });

  it("fraction 0.999 gives day 30", () => {
    expect(tickToGameDate(5, 0.999).day).toBe(30);
  });

  it("epoch year constant is 2025", () => {
    expect(EPOCH_YEAR).toBe(2025);
  });
});

describe("toGameTimeView", () => {
  it("returns authoritative day and month fraction from tick/subtick/fraction", () => {
    expect(toGameTimeView(2, 14, 0.5)).toEqual({
      tick: 2,
      subtick: 14,
      dayOfMonth: 15,
      monthFraction: 14.5 / 30,
    });
  });
});

describe("formatGameDate", () => {
  it('"15 Mar 2025"', () => {
    expect(formatGameDate({ year: 2025, month: 2, day: 15 })).toBe("15 Mar 2025");
  });

  it('"1 Jan 2025"', () => {
    expect(formatGameDate({ year: 2025, month: 0, day: 1 })).toBe("1 Jan 2025");
  });

  it('"30 Dec 2026"', () => {
    expect(formatGameDate({ year: 2026, month: 11, day: 30 })).toBe("30 Dec 2026");
  });
});

describe("formatGameDateShort", () => {
  it('"Mar 2025"', () => {
    expect(formatGameDateShort({ year: 2025, month: 2, day: 1 })).toBe("Mar 2025");
  });

  it('"Jan 2026"', () => {
    expect(formatGameDateShort({ year: 2026, month: 0, day: 15 })).toBe("Jan 2026");
  });
});

describe("monthsAndDaysBetween", () => {
  it("3,0 → 5,0.5 gives {months:2, days:15}", () => {
    expect(monthsAndDaysBetween(3, 0, 5, 0.5)).toEqual({ months: 2, days: 15 });
  });

  it("same position gives {months:0, days:0}", () => {
    expect(monthsAndDaysBetween(4, 0.5, 4, 0.5)).toEqual({ months: 0, days: 0 });
  });

  it("past position is clamped to {months:0, days:0}", () => {
    expect(monthsAndDaysBetween(5, 0, 3, 0)).toEqual({ months: 0, days: 0 });
  });

  it("exactly 1 month apart → {months:1, days:0}", () => {
    expect(monthsAndDaysBetween(2, 0, 3, 0)).toEqual({ months: 1, days: 0 });
  });

  it("whole tick difference with fraction remainder", () => {
    // from tick 0 frac 0.3, to tick 1 frac 0.0 → 0.7 months = 21 days
    expect(monthsAndDaysBetween(0, 0.3, 1, 0.0)).toEqual({ months: 0, days: 21 });
  });
});

describe("formatRemaining", () => {
  it("(0,0) → 'expires today'", () => {
    expect(formatRemaining(0, 0)).toBe("expires today");
  });

  it("(0,1) → '1 day left'", () => {
    expect(formatRemaining(0, 1)).toBe("1 day left");
  });

  it("(0,14) → '14 days left'", () => {
    expect(formatRemaining(0, 14)).toBe("14 days left");
  });

  it("(1,0) → '1 month left'", () => {
    expect(formatRemaining(1, 0)).toBe("1 month left");
  });

  it("(3,0) → '3 months left'", () => {
    expect(formatRemaining(3, 0)).toBe("3 months left");
  });

  it("(2,14) → '2 months 14 days left'", () => {
    expect(formatRemaining(2, 14)).toBe("2 months 14 days left");
  });

  it("(1,1) → '1 month 1 day left'", () => {
    expect(formatRemaining(1, 1)).toBe("1 month 1 day left");
  });
});
