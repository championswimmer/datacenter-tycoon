import assert from "node:assert/strict";
import test from "node:test";

import { REGION_CATALOG } from "../catalog/regions.js";
import {
	BASE_REGION_OPEX,
	REGIONAL_OPEX_PROFILES,
	getRegionalOpexProfile,
	powerCostForRegion,
	regionalOpexMultiplierLabel,
	staffWageForRegion,
} from "./regional-opex.js";

test("regional opex helpers derive the expected catalog baseline values", () => {
	assert.deepEqual(BASE_REGION_OPEX, {
		powerCostPerKwh: 0.08,
		staffWagePerMonth: 6_500,
	});
	assert.equal(powerCostForRegion("us_east"), 0.08);
	assert.equal(powerCostForRegion("us_west"), 0.06);
	assert.equal(powerCostForRegion("eu_west"), 0.18);
	assert.equal(powerCostForRegion("eu_central"), 0.17);
	assert.equal(powerCostForRegion("ap_northeast"), 0.16);
	assert.equal(powerCostForRegion("ap_southeast"), 0.18);
	assert.equal(powerCostForRegion("sa_east"), 0.13);
	assert.equal(powerCostForRegion("me_central"), 0.09);

	assert.equal(staffWageForRegion("us_east"), 6_500);
	assert.equal(staffWageForRegion("us_west"), 6_175);
	assert.equal(staffWageForRegion("eu_west"), 5_850);
	assert.equal(staffWageForRegion("eu_central"), 5_980);
	assert.equal(staffWageForRegion("ap_northeast"), 5_070);
	assert.equal(staffWageForRegion("ap_southeast"), 5_200);
	assert.equal(staffWageForRegion("sa_east"), 2_275);
	assert.equal(staffWageForRegion("me_central"), 4_225);
});

test("region catalog baseline now matches regional opex profiles", () => {
	assert.deepEqual(
		Object.fromEntries(
			Object.entries(REGION_CATALOG).map(([regionId, region]) => [regionId, { powerCostPerKwh: region.powerCostPerKwh, staffWage: region.staffWage }]),
		),
		{
			us_east: { powerCostPerKwh: 0.08, staffWage: 6_500 },
			us_west: { powerCostPerKwh: 0.06, staffWage: 6_175 },
			eu_west: { powerCostPerKwh: 0.18, staffWage: 5_850 },
			eu_central: { powerCostPerKwh: 0.17, staffWage: 5_980 },
			ap_northeast: { powerCostPerKwh: 0.16, staffWage: 5_070 },
			ap_southeast: { powerCostPerKwh: 0.18, staffWage: 5_200 },
			sa_east: { powerCostPerKwh: 0.13, staffWage: 2_275 },
			me_central: { powerCostPerKwh: 0.09, staffWage: 4_225 },
		},
	);
});

test("regional opex profiles preserve the intended gameplay ordering", () => {
	assert.equal(REGIONAL_OPEX_PROFILES.us_east.wageMultiplier, 1);
	assert.equal(REGIONAL_OPEX_PROFILES.eu_west.powerMultiplier, 2.25);
	assert.equal(regionalOpexMultiplierLabel("eu_west"), "Power 2.25x / Labor 0.90x");

	assert.ok(staffWageForRegion("us_east") >= staffWageForRegion("us_west"));
	assert.ok(staffWageForRegion("us_west") > staffWageForRegion("eu_central"));
	assert.ok(staffWageForRegion("eu_central") > staffWageForRegion("eu_west"));
	assert.ok(staffWageForRegion("eu_west") > staffWageForRegion("ap_southeast"));
	assert.ok(staffWageForRegion("ap_southeast") > staffWageForRegion("ap_northeast"));
	assert.ok(staffWageForRegion("ap_northeast") > staffWageForRegion("me_central"));
	assert.ok(staffWageForRegion("me_central") > staffWageForRegion("sa_east"));

	assert.ok(powerCostForRegion("us_west") < powerCostForRegion("us_east"));
	assert.ok(powerCostForRegion("eu_west") >= powerCostForRegion("eu_central"));
	assert.ok(powerCostForRegion("eu_west") > powerCostForRegion("sa_east"));
	assert.ok(powerCostForRegion("ap_southeast") >= powerCostForRegion("ap_northeast"));
	assert.ok(powerCostForRegion("me_central") > powerCostForRegion("us_west"));
});

test("getRegionalOpexProfile exposes source and gameplay notes for each region", () => {
	const tokyo = getRegionalOpexProfile("ap_northeast");
	assert.match(tokyo.sourceNote, /Japan/i);
	assert.match(tokyo.gameplayNote, /labor below Europe/i);
	assert.throws(() => getRegionalOpexProfile("antarctica"), /Unknown regional OpEx profile/);
});
