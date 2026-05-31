import { describe, it, expect } from "vitest";
import { parseRoute, routeToHash, type Route } from "./hashRouter.js";

const cases: Array<[string, Route]> = [
  ["",                      { view: "home" }],
  ["#",                     { view: "home" }],
  ["#/",                    { view: "home" }],
  ["#/dc/dc-abc/floor",     { view: "dc", dcId: "dc-abc", tab: "floor" }],
  ["#/dc/dc-abc/power",     { view: "dc", dcId: "dc-abc", tab: "power" }],
  ["#/dc/dc-abc/contracts", { view: "dc", dcId: "dc-abc", tab: "contracts" }],
  ["#/dc/dc-abc",           { view: "dc", dcId: "dc-abc", tab: "floor" }],
  ["#/contracts",           { view: "contracts" }],
  ["#/finances",            { view: "finances" }],
  ["#/log",                 { view: "log" }],
  ["#/__theme",             { view: "theme-playground" }],
  ["#/unknown",             { view: "home" }],
];

describe("parseRoute", () => {
  for (const [hash, expected] of cases) {
    it(`parses "${hash}" → ${JSON.stringify(expected)}`, () => {
      expect(parseRoute(hash)).toEqual(expected);
    });
  }
});

describe("routeToHash", () => {
  it("round-trips dc route", () => {
    const route: Route = { view: "dc", dcId: "dc-123", tab: "power" };
    expect(parseRoute(routeToHash(route))).toEqual(route);
  });

  it("round-trips contracts route", () => {
    const route: Route = { view: "contracts" };
    expect(parseRoute(routeToHash(route))).toEqual(route);
  });

  it("round-trips finances route", () => {
    const route: Route = { view: "finances" };
    expect(parseRoute(routeToHash(route))).toEqual(route);
  });

  it("round-trips log route", () => {
    expect(parseRoute(routeToHash({ view: "log" }))).toEqual({ view: "log" });
  });

  it("round-trips home route", () => {
    expect(parseRoute(routeToHash({ view: "home" }))).toEqual({ view: "home" });
  });
});
