(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __objRest = (source, exclude) => {
    var target = {};
    for (var prop in source)
      if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
        target[prop] = source[prop];
    if (source != null && __getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(source)) {
        if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
          target[prop] = source[prop];
      }
    return target;
  };
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // packages/game-logic/src/balance/contracts.ts
  var CONTRACT_PAYOUT_MULTIPLIER = 1.75;
  var UNRESTRICTED_MARKET_OFFER_SHARE_FLOOR = 0.34;
  var NON_GPU_MARKET_OFFER_SHARE_FLOOR = 0.34;
  function minimumOffersForShare(offerTarget, shareFloor) {
    return Math.max(1, Math.round(Math.max(0, offerTarget) * shareFloor));
  }
  function minimumUnrestrictedMarketOffers(offerTarget) {
    return minimumOffersForShare(offerTarget, UNRESTRICTED_MARKET_OFFER_SHARE_FLOOR);
  }
  function minimumNonGpuMarketOffers(offerTarget) {
    return minimumOffersForShare(offerTarget, NON_GPU_MARKET_OFFER_SHARE_FLOOR);
  }

  // packages/game-logic/src/balance/datacenter-upgrades.ts
  var DATACENTER_UPGRADE_FABRIC_NETWORK_TYPE = "fiber";
  var DATACENTER_UPGRADE_BALANCE = {
    garage: {
      tracks: {
        cooling: {
          label: "Cooling loop",
          presentation: "level",
          nodes: [
            {
              id: "air",
              label: "Air cooling",
              capexCost: 0,
              infrastructure: { coolingType: "air", coolingCapacityBtuPerHr: 12e4 }
            },
            {
              id: "hybrid",
              label: "Hybrid cooling",
              capexCost: 18e4,
              fixedMonthlyOpex: 900,
              infrastructure: { coolingType: "hybrid", coolingCapacityBtuPerHr: 25e4 }
            }
          ]
        },
        networkType: {
          label: "Network uplink",
          presentation: "level",
          nodes: [
            {
              id: "cat6",
              label: "Cat6 uplink",
              capexCost: 0,
              infrastructure: { networkType: "cat6", bandwidthGbps: 80 }
            },
            {
              id: "cat8",
              label: "Cat8 uplink",
              capexCost: 75e3,
              fixedMonthlyOpex: 350,
              infrastructure: { networkType: "cat8", bandwidthGbps: 160 }
            },
            {
              id: "fiber",
              label: "Fiber uplink",
              capexCost: 18e4,
              fixedMonthlyOpex: 1250,
              infrastructure: { networkType: "fiber", bandwidthGbps: 320 }
            }
          ]
        },
        onsiteGeneration: {
          label: "Gas generators",
          presentation: "slots",
          nodes: [
            {
              id: "gen-0",
              label: "0 generators installed",
              capexCost: 0,
              infrastructure: { onsiteGenerationCapacityKw: 0 }
            },
            {
              id: "gen-1",
              label: "1 generator installed",
              capexCost: 12e4,
              fixedMonthlyOpex: 1600,
              infrastructure: { onsiteGenerationCapacityKw: 25 }
            }
          ]
        }
      }
    },
    warehouse: {
      tracks: {
        cooling: {
          label: "Cooling loop",
          presentation: "level",
          nodes: [
            {
              id: "air",
              label: "Air cooling",
              capexCost: 0,
              infrastructure: { coolingType: "air", coolingCapacityBtuPerHr: 52e4 }
            },
            {
              id: "hybrid",
              label: "Hybrid cooling",
              capexCost: 36e4,
              fixedMonthlyOpex: 2200,
              infrastructure: { coolingType: "hybrid", coolingCapacityBtuPerHr: 9e5 }
            },
            {
              id: "liquid",
              label: "Liquid cooling",
              capexCost: 84e4,
              fixedMonthlyOpex: 5200,
              infrastructure: { coolingType: "liquid", coolingCapacityBtuPerHr: 14e5 }
            }
          ]
        },
        networkType: {
          label: "Network uplink",
          presentation: "level",
          nodes: [
            {
              id: "cat8",
              label: "Cat8 uplink",
              capexCost: 0,
              infrastructure: { networkType: "cat8", bandwidthGbps: 400 }
            },
            {
              id: "fiber",
              label: "Fiber uplink",
              capexCost: 275e3,
              fixedMonthlyOpex: 2e3,
              infrastructure: { networkType: "fiber", bandwidthGbps: 1e3 }
            }
          ]
        },
        onsiteGeneration: {
          label: "Gas generators",
          presentation: "slots",
          nodes: [
            {
              id: "gen-0",
              label: "0 generators installed",
              capexCost: 0,
              infrastructure: { onsiteGenerationCapacityKw: 0 }
            },
            {
              id: "gen-1",
              label: "1 generator installed",
              capexCost: 45e4,
              fixedMonthlyOpex: 3800,
              infrastructure: { onsiteGenerationCapacityKw: 80 }
            },
            {
              id: "gen-2",
              label: "2 generators installed",
              capexCost: 9e5,
              fixedMonthlyOpex: 7600,
              infrastructure: { onsiteGenerationCapacityKw: 160 }
            }
          ]
        }
      }
    },
    hyperscale: {
      tracks: {
        cooling: {
          label: "Cooling loop",
          presentation: "level",
          nodes: [
            {
              id: "liquid",
              label: "Liquid cooling",
              capexCost: 0,
              infrastructure: { coolingType: "liquid", coolingCapacityBtuPerHr: 105e5 }
            }
          ]
        },
        networkType: {
          label: "Network uplink",
          presentation: "level",
          nodes: [
            {
              id: "fiber",
              label: "Fiber uplink",
              capexCost: 0,
              infrastructure: { networkType: "fiber", bandwidthGbps: 5e3 }
            }
          ]
        },
        onsiteGeneration: {
          label: "Gas generators",
          presentation: "slots",
          nodes: [
            {
              id: "gen-0",
              label: "0 generators installed",
              capexCost: 0,
              infrastructure: { onsiteGenerationCapacityKw: 0 }
            },
            {
              id: "gen-1",
              label: "1 generator installed",
              capexCost: 18e5,
              fixedMonthlyOpex: 16e3,
              infrastructure: { onsiteGenerationCapacityKw: 400 }
            },
            {
              id: "gen-2",
              label: "2 generators installed",
              capexCost: 36e5,
              fixedMonthlyOpex: 32e3,
              infrastructure: { onsiteGenerationCapacityKw: 800 }
            },
            {
              id: "gen-3",
              label: "3 generators installed",
              capexCost: 54e5,
              fixedMonthlyOpex: 48e3,
              infrastructure: { onsiteGenerationCapacityKw: 1200 }
            },
            {
              id: "gen-4",
              label: "4 generators installed",
              capexCost: 72e5,
              fixedMonthlyOpex: 64e3,
              infrastructure: { onsiteGenerationCapacityKw: 1600 }
            }
          ]
        }
      }
    }
  };

  // packages/game-logic/src/balance/difficulty.ts
  var DEFAULT_DIFFICULTY = "hard";
  var DIFFICULTY_CONFIG = {
    easy: {
      startingCash: 8e6,
      repairTimeMultiplier: 0.75,
      breachPenaltyMultiplier: 0.5,
      failureCurvePct: [0, 1, 2, 4, 8, 16]
    },
    hard: {
      startingCash: 4e6,
      repairTimeMultiplier: 1,
      breachPenaltyMultiplier: 1,
      failureCurvePct: [0, 2, 4, 8, 16, 32]
    }
  };

  // packages/game-logic/src/balance/fabric.ts
  var REGIONAL_FABRIC_JOIN_COST = 15e4;

  // packages/game-logic/src/balance/easier.ts
  var EXTRA_MAINTENANCE_STAFF_WAGE_MULTIPLIER = 0.8;
  var REPAIR_DURATION_MULTIPLIER = 0.5;
  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }
  function maintenanceStaffWagePerHead(baseStaffWage) {
    return roundMoney(baseStaffWage * EXTRA_MAINTENANCE_STAFF_WAGE_MULTIPLIER);
  }
  function applyRepairDurationMultiplier(baseRepairDays) {
    return baseRepairDays * REPAIR_DURATION_MULTIPLIER;
  }

  // packages/game-logic/src/balance/maintenance.ts
  var DAYS_PER_TICK = 30;
  var BASE_REPAIR_DAYS_BY_RACK_KIND = {
    compute: applyRepairDurationMultiplier(6),
    memory: applyRepairDurationMultiplier(8),
    storage: applyRepairDurationMultiplier(10),
    gpu: applyRepairDurationMultiplier(18)
  };
  var DEFAULT_MAINTENANCE_STAFF = 0;
  var MAX_MAINTENANCE_STAFF = 8;
  var BASE_REPAIR_SPEED_MULTIPLIER = 1;
  var REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF = 0.25;
  var MAX_REPAIR_SPEED_MULTIPLIER = 3;
  function repairBaseDaysForRackKind(kind) {
    return BASE_REPAIR_DAYS_BY_RACK_KIND[kind];
  }

  // packages/game-logic/src/economy/constants.ts
  var HOURS_PER_MONTH = 730;
  var BANDWIDTH_USD_PER_GBPS_MONTH = 85;
  var COOLING_OVERHEAD_RATIO = 0.3;
  var MARKET_REFRESH_SIZE = 6;
  var CONTRACT_TERM_DISCOUNT_BASELINE_MONTHS = 6;
  var CONTRACT_TERM_DISCOUNT_PER_EXTRA_MONTH = 0.02;
  var CONTRACT_TERM_DISCOUNT_FLOOR = 0.68;

  // packages/game-logic/src/balance/power.ts
  var RACK_IDLE_BASELINE_POWER_KW = 0.8;
  var ACTIVE_RACK_POWER_MULTIPLIER = 1;

  // packages/game-logic/src/balance/regional-opex.ts
  var BASE_REGION_OPEX = {
    powerCostPerKwh: 0.08,
    staffWagePerMonth: 6500
  };
  var REGIONAL_OPEX_PROFILES = {
    us_east: {
      powerMultiplier: 1,
      wageMultiplier: 1,
      sourceNote: "US East baseline using EIA-backed power references and BLS support-specialist wages.",
      gameplayNote: "Premium labor baseline; benchmark region for multiplier comparisons."
    },
    us_west: {
      powerMultiplier: 0.8,
      wageMultiplier: 0.95,
      sourceNote: "Pacific Northwest power is typically cheaper than Northern Virginia for large industrial users.",
      gameplayNote: "Slightly cheaper labor and clearly cheaper power than US East."
    },
    eu_west: {
      powerMultiplier: 2.25,
      wageMultiplier: 0.9,
      sourceNote: "Eurostat and KPMG benchmarks show materially higher electricity costs in Ireland than US regions.",
      gameplayNote: "High power-cost region with labor still below the US gameplay baseline."
    },
    eu_central: {
      powerMultiplier: 2.13,
      wageMultiplier: 0.92,
      sourceNote: "Germany remains a high-cost European electricity market in 2024 benchmarks.",
      gameplayNote: "Very expensive power and slightly higher labor than EU West."
    },
    ap_northeast: {
      powerMultiplier: 2,
      wageMultiplier: 0.78,
      sourceNote: "Japan commercial and industrial power remains well above US-East reference pricing.",
      gameplayNote: "High power costs but labor below Europe for the intended gameplay curve."
    },
    ap_southeast: {
      powerMultiplier: 2.25,
      wageMultiplier: 0.8,
      sourceNote: "Singapore power pricing is comparable to high-cost European markets in available benchmarks.",
      gameplayNote: "Very expensive power, but labor still cheaper than Europe and the US."
    },
    sa_east: {
      powerMultiplier: 1.63,
      wageMultiplier: 0.35,
      sourceNote: "Brazil power prices sit above the US baseline but below the most expensive EU and AP markets.",
      gameplayNote: "Mid-cost power offset by a notably cheaper labor market."
    },
    me_central: {
      powerMultiplier: 1.13,
      wageMultiplier: 0.65,
      sourceNote: "Dubai power is relatively competitive compared with Europe and AP while labor is below US levels.",
      gameplayNote: "Near-baseline power with discounted labor."
    }
  };
  function roundMoney2(value) {
    return Math.round(value * 100) / 100;
  }
  function roundPowerCost(value) {
    return Math.round(value * 100) / 100;
  }
  function regionKey(regionId2) {
    return String(regionId2);
  }
  function getRegionalOpexProfile(regionId2) {
    const profile = REGIONAL_OPEX_PROFILES[regionKey(regionId2)];
    if (!profile) {
      throw new Error(`Unknown regional OpEx profile: ${String(regionId2)}`);
    }
    return profile;
  }
  function powerCostForRegionProfile(profile) {
    return roundPowerCost(BASE_REGION_OPEX.powerCostPerKwh * profile.powerMultiplier);
  }
  function staffWageForRegionProfile(profile) {
    return roundMoney2(BASE_REGION_OPEX.staffWagePerMonth * profile.wageMultiplier);
  }
  function powerCostForRegion(regionId2) {
    return powerCostForRegionProfile(getRegionalOpexProfile(regionId2));
  }
  function staffWageForRegion(regionId2) {
    return staffWageForRegionProfile(getRegionalOpexProfile(regionId2));
  }

  // packages/game-logic/src/balance/reliability.ts
  var RELIABILITY_MIN_SCORE = 0;
  var RELIABILITY_MAX_SCORE = 100;
  var RELIABILITY_BASELINE_SCORE = 50;
  var RELIABILITY_DELTA_FULFILLED = 3;
  var RELIABILITY_DELTA_BREACHED = -8;
  var RELIABILITY_DELTA_CANCELLED = -12;
  var RELIABILITY_BAND_THRESHOLDS = {
    bronzeMax: 19,
    silverMax: 39,
    goldMax: 59,
    platinumMax: 79
  };
  var RELIABILITY_RECENT_OUTCOME_LIMIT = 6;
  var RELIABILITY_MARKET_OFFER_COUNT = {
    bronze: 3,
    silver: 5,
    gold: MARKET_REFRESH_SIZE,
    platinum: 8,
    diamond: 10
  };
  var RELIABILITY_TERM_BIAS = {
    bronze: {
      longTermBias: 0.6,
      shortTermBias: 1.4
    },
    silver: {
      longTermBias: 0.85,
      shortTermBias: 1.15
    },
    gold: {
      longTermBias: 1,
      shortTermBias: 1
    },
    platinum: {
      longTermBias: 1.2,
      shortTermBias: 0.85
    },
    diamond: {
      longTermBias: 1.4,
      shortTermBias: 0.6
    }
  };
  function clampReliabilityScore(score) {
    if (!Number.isFinite(score)) {
      return RELIABILITY_BASELINE_SCORE;
    }
    return Math.max(RELIABILITY_MIN_SCORE, Math.min(RELIABILITY_MAX_SCORE, Math.round(score)));
  }
  function reliabilityBandForScore(score) {
    const normalizedScore = clampReliabilityScore(score);
    if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.bronzeMax) {
      return "bronze";
    }
    if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.silverMax) {
      return "silver";
    }
    if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.goldMax) {
      return "gold";
    }
    if (normalizedScore <= RELIABILITY_BAND_THRESHOLDS.platinumMax) {
      return "platinum";
    }
    return "diamond";
  }
  function reliabilityMarketPolicyForScore(score) {
    const band = reliabilityBandForScore(score);
    const termBias = RELIABILITY_TERM_BIAS[band];
    return {
      band,
      offerCount: RELIABILITY_MARKET_OFFER_COUNT[band],
      longTermBias: termBias.longTermBias,
      shortTermBias: termBias.shortTermBias
    };
  }

  // packages/game-logic/src/catalog/datacenters.ts
  var datacenterSpecId = (value) => value;
  var DATACENTER_CATALOG = {
    garage: {
      id: datacenterSpecId("garage"),
      name: "Garage Datacenter",
      rows: 2,
      positionsPerRow: 4,
      powerCapacityKw: 60,
      coolingCapacityBtuPerHr: 12e4,
      coolingType: "air",
      networkType: "cat6",
      bandwidthGbps: 80,
      capexCost: 25e4,
      staffCount: 1
    },
    warehouse: {
      id: datacenterSpecId("warehouse"),
      name: "Warehouse Datacenter",
      rows: 4,
      positionsPerRow: 10,
      powerCapacityKw: 320,
      coolingCapacityBtuPerHr: 52e4,
      coolingType: "air",
      networkType: "cat8",
      bandwidthGbps: 400,
      capexCost: 14e5,
      staffCount: 4
    },
    hyperscale: {
      id: datacenterSpecId("hyperscale"),
      name: "Hyperscale Campus",
      rows: 8,
      positionsPerRow: 25,
      powerCapacityKw: 2500,
      coolingCapacityBtuPerHr: 105e5,
      coolingType: "liquid",
      networkType: "fiber",
      bandwidthGbps: 5e3,
      capexCost: 18e6,
      staffCount: 45
    }
  };

  // packages/game-logic/src/catalog/racks.ts
  var rackSpecId = (value) => value;
  var RACK_CATALOG = {
    C0: {
      id: rackSpecId("C0"),
      name: "C0 Compute Rack",
      kind: "compute",
      tier: 0,
      vCpu: 64,
      ramGb: 256,
      storageTb: 8,
      gpuFlops: 0,
      powerDrawKw: 1.2,
      heatOutputBtuPerHr: 4094,
      bandwidthGbps: 5,
      capexCost: 25e3,
      monthlyMaintenance: 200
    },
    C1: {
      id: rackSpecId("C1"),
      name: "C1 Compute Rack",
      kind: "compute",
      tier: 1,
      vCpu: 128,
      ramGb: 512,
      storageTb: 16,
      gpuFlops: 0,
      powerDrawKw: 2.4,
      heatOutputBtuPerHr: 8189,
      bandwidthGbps: 10,
      capexCost: 5e4,
      monthlyMaintenance: 400
    },
    C2: {
      id: rackSpecId("C2"),
      name: "C2 Compute Rack",
      kind: "compute",
      tier: 2,
      vCpu: 256,
      ramGb: 768,
      storageTb: 24,
      gpuFlops: 0,
      powerDrawKw: 4.2,
      heatOutputBtuPerHr: 14330,
      bandwidthGbps: 18,
      capexCost: 12e4,
      monthlyMaintenance: 960
    },
    C3: {
      id: rackSpecId("C3"),
      name: "C3 Compute Rack",
      kind: "compute",
      tier: 3,
      vCpu: 512,
      ramGb: 1024,
      storageTb: 32,
      gpuFlops: 0,
      powerDrawKw: 8.4,
      heatOutputBtuPerHr: 28661,
      bandwidthGbps: 32,
      capexCost: 28e4,
      monthlyMaintenance: 2240
    },
    M0: {
      id: rackSpecId("M0"),
      name: "M0 Memory Rack",
      kind: "memory",
      tier: 0,
      vCpu: 24,
      ramGb: 1024,
      storageTb: 10,
      gpuFlops: 0,
      powerDrawKw: 1.14,
      heatOutputBtuPerHr: 3890,
      bandwidthGbps: 4,
      capexCost: 32500,
      monthlyMaintenance: 260
    },
    M1: {
      id: rackSpecId("M1"),
      name: "M1 Memory Rack",
      kind: "memory",
      tier: 1,
      vCpu: 48,
      ramGb: 2048,
      storageTb: 20,
      gpuFlops: 0,
      powerDrawKw: 2.28,
      heatOutputBtuPerHr: 7780,
      bandwidthGbps: 8,
      capexCost: 65e3,
      monthlyMaintenance: 520
    },
    M2: {
      id: rackSpecId("M2"),
      name: "M2 Memory Rack",
      kind: "memory",
      tier: 2,
      vCpu: 64,
      ramGb: 4096,
      storageTb: 28,
      gpuFlops: 0,
      powerDrawKw: 4.14,
      heatOutputBtuPerHr: 14125,
      bandwidthGbps: 14,
      capexCost: 16e4,
      monthlyMaintenance: 1280
    },
    M3: {
      id: rackSpecId("M3"),
      name: "M3 Memory Rack",
      kind: "memory",
      tier: 3,
      vCpu: 96,
      ramGb: 8192,
      storageTb: 40,
      gpuFlops: 0,
      powerDrawKw: 8.1,
      heatOutputBtuPerHr: 27638,
      bandwidthGbps: 24,
      capexCost: 38e4,
      monthlyMaintenance: 3040
    },
    S0: {
      id: rackSpecId("S0"),
      name: "S0 Storage Rack",
      kind: "storage",
      tier: 0,
      vCpu: 12,
      ramGb: 128,
      storageTb: 250,
      gpuFlops: 0,
      powerDrawKw: 0.96,
      heatOutputBtuPerHr: 3276,
      bandwidthGbps: 3,
      capexCost: 31e3,
      monthlyMaintenance: 1200
    },
    S1: {
      id: rackSpecId("S1"),
      name: "S1 Storage Rack",
      kind: "storage",
      tier: 1,
      vCpu: 24,
      ramGb: 256,
      storageTb: 500,
      gpuFlops: 0,
      powerDrawKw: 1.92,
      heatOutputBtuPerHr: 6551,
      bandwidthGbps: 6,
      capexCost: 62e3,
      monthlyMaintenance: 3e3
    },
    S2: {
      id: rackSpecId("S2"),
      name: "S2 Storage Rack",
      kind: "storage",
      tier: 2,
      vCpu: 32,
      ramGb: 384,
      storageTb: 1200,
      gpuFlops: 0,
      powerDrawKw: 3.48,
      heatOutputBtuPerHr: 11874,
      bandwidthGbps: 10,
      capexCost: 155e3,
      monthlyMaintenance: 9e3
    },
    S3: {
      id: rackSpecId("S3"),
      name: "S3 Storage Rack",
      kind: "storage",
      tier: 3,
      vCpu: 48,
      ramGb: 512,
      storageTb: 2800,
      gpuFlops: 0,
      powerDrawKw: 7.68,
      heatOutputBtuPerHr: 26205,
      bandwidthGbps: 18,
      capexCost: 365e3,
      monthlyMaintenance: 22e3
    },
    G0: {
      id: rackSpecId("G0"),
      name: "G0 GPU Rack",
      kind: "gpu",
      tier: 0,
      vCpu: 32,
      ramGb: 512,
      storageTb: 12,
      gpuFlops: 250,
      powerDrawKw: 1.8,
      heatOutputBtuPerHr: 6142,
      bandwidthGbps: 8,
      capexCost: 4e5,
      monthlyMaintenance: 3200
    },
    G1: {
      id: rackSpecId("G1"),
      name: "G1 GPU Rack",
      kind: "gpu",
      tier: 1,
      vCpu: 64,
      ramGb: 1024,
      storageTb: 24,
      gpuFlops: 500,
      powerDrawKw: 3.6,
      heatOutputBtuPerHr: 12284,
      bandwidthGbps: 16,
      capexCost: 8e5,
      monthlyMaintenance: 6400
    },
    G2: {
      id: rackSpecId("G2"),
      name: "G2 GPU Rack",
      kind: "gpu",
      tier: 2,
      vCpu: 96,
      ramGb: 1536,
      storageTb: 32,
      gpuFlops: 1100,
      powerDrawKw: 6.6,
      heatOutputBtuPerHr: 22520,
      bandwidthGbps: 28,
      capexCost: 22e5,
      monthlyMaintenance: 17600
    },
    G3: {
      id: rackSpecId("G3"),
      name: "G3 GPU Rack",
      kind: "gpu",
      tier: 3,
      vCpu: 128,
      ramGb: 2048,
      storageTb: 48,
      gpuFlops: 2400,
      powerDrawKw: 13.2,
      heatOutputBtuPerHr: 45040,
      bandwidthGbps: 48,
      capexCost: 55e5,
      monthlyMaintenance: 44e3
    }
  };

  // packages/game-logic/src/catalog/regions.ts
  var regionId = (value) => value;
  function baseRegion(regionKey2, region) {
    return __spreadValues({
      id: regionId(regionKey2),
      powerCostPerKwh: powerCostForRegion(regionKey2),
      staffWage: staffWageForRegion(regionKey2)
    }, region);
  }
  var CONTRACT_REGION_AFFINITY_REGION_IDS = {
    eu: [regionId("eu_west"), regionId("eu_central")],
    asia: [regionId("ap_northeast"), regionId("ap_southeast")],
    usa: [regionId("us_east"), regionId("us_west")]
  };
  var REGION_CATALOG = {
    us_east: baseRegion("us_east", {
      name: "US East",
      code: "IAD",
      city: "Ashburn",
      coordinates: { x: 24, y: 35.5 },
      taxRate: 0.06,
      totalPowerAvailable: 1e4,
      totalStaffAvailable: 800,
      powerUsed: 0,
      staffUsed: 0
    }),
    us_west: baseRegion("us_west", {
      name: "US West",
      code: "PDX",
      city: "Boardman",
      coordinates: { x: 15, y: 33 },
      taxRate: 0.07,
      totalPowerAvailable: 8e3,
      totalStaffAvailable: 400,
      powerUsed: 0,
      staffUsed: 0
    }),
    eu_west: baseRegion("eu_west", {
      name: "EU West",
      code: "DUB",
      city: "Dublin",
      coordinates: { x: 44, y: 26 },
      taxRate: 0.125,
      totalPowerAvailable: 5e3,
      totalStaffAvailable: 350,
      powerUsed: 0,
      staffUsed: 0
    }),
    eu_central: baseRegion("eu_central", {
      name: "EU Central",
      code: "FRA",
      city: "Frankfurt",
      coordinates: { x: 46, y: 29 },
      taxRate: 0.28,
      totalPowerAvailable: 6e3,
      totalStaffAvailable: 450,
      powerUsed: 0,
      staffUsed: 0
    }),
    ap_northeast: baseRegion("ap_northeast", {
      name: "AP Northeast",
      code: "NRT",
      city: "Tokyo",
      coordinates: { x: 83, y: 36 },
      taxRate: 0.22,
      totalPowerAvailable: 4500,
      totalStaffAvailable: 400,
      powerUsed: 0,
      staffUsed: 0
    }),
    ap_southeast: baseRegion("ap_southeast", {
      name: "AP Southeast",
      code: "SIN",
      city: "Singapore",
      coordinates: { x: 75, y: 54 },
      taxRate: 0.17,
      totalPowerAvailable: 4e3,
      totalStaffAvailable: 350,
      powerUsed: 0,
      staffUsed: 0
    }),
    sa_east: baseRegion("sa_east", {
      name: "SA East",
      code: "GRU",
      city: "S\xE3o Paulo",
      coordinates: { x: 34.5, y: 65.5 },
      taxRate: 0.34,
      totalPowerAvailable: 3500,
      totalStaffAvailable: 450,
      powerUsed: 0,
      staffUsed: 0
    }),
    me_central: baseRegion("me_central", {
      name: "ME Central",
      code: "DXB",
      city: "Dubai",
      coordinates: { x: 61, y: 43 },
      taxRate: 0.09,
      totalPowerAvailable: 5500,
      totalStaffAvailable: 300,
      powerUsed: 0,
      staffUsed: 0
    })
  };
  function regionMatchesContractAffinity(regionId2, affinityKey) {
    return CONTRACT_REGION_AFFINITY_REGION_IDS[affinityKey].includes(regionId2);
  }
  function regionIdsForContractAffinity(affinityKey, regions = Object.values(REGION_CATALOG)) {
    return regions.filter((region) => regionMatchesContractAffinity(region.id, affinityKey)).map((region) => region.id);
  }

  // packages/game-logic/src/economy/rack-activity.ts
  function rackDemandByKindFromRequirements(requirements) {
    return {
      compute: requirements.vCpu,
      memory: requirements.ramGb,
      storage: requirements.storageTb,
      gpu: requirements.gpuFlops
    };
  }
  var RACK_KIND_ORDER = ["compute", "memory", "storage", "gpu"];
  function emptyRackDemandByKind() {
    return {
      compute: 0,
      memory: 0,
      storage: 0,
      gpu: 0
    };
  }
  function normalizeRackDemandByKind(demandByKind) {
    var _a;
    const normalized = emptyRackDemandByKind();
    for (const kind of RACK_KIND_ORDER) {
      const value = (_a = demandByKind[kind]) != null ? _a : 0;
      normalized[kind] = Number.isFinite(value) && value > 0 ? value : 0;
    }
    return normalized;
  }
  function allocateRackActivity(racks, demandByKind) {
    const remainingDemandByKind = normalizeRackDemandByKind(demandByKind);
    const activities = [];
    const orderedRacks = [...racks].sort((a, b) => {
      if (a.kind !== b.kind) {
        return RACK_KIND_ORDER.indexOf(a.kind) - RACK_KIND_ORDER.indexOf(b.kind);
      }
      return String(a.placementId).localeCompare(String(b.placementId));
    });
    for (const rack of orderedRacks) {
      const isRepairing = Boolean(rack.isRepairing);
      const availableUnits = Number.isFinite(rack.serviceUnits) && rack.serviceUnits > 0 ? rack.serviceUnits : 0;
      const reservedPowerKw = Number.isFinite(rack.powerDrawKw) && rack.powerDrawKw > 0 ? rack.powerDrawKw : 0;
      let status = "idle";
      if (isRepairing) {
        status = "repairing";
      } else if (remainingDemandByKind[rack.kind] > 0 && availableUnits > 0) {
        status = "active";
        remainingDemandByKind[rack.kind] = Math.max(0, remainingDemandByKind[rack.kind] - availableUnits);
      }
      const billedPowerKw = status === "active" ? reservedPowerKw * ACTIVE_RACK_POWER_MULTIPLIER : RACK_IDLE_BASELINE_POWER_KW;
      activities.push({
        placementId: rack.placementId,
        specId: rack.specId,
        kind: rack.kind,
        status,
        reservedPowerKw,
        billedPowerKw
      });
    }
    return {
      activities,
      remainingDemandByKind
    };
  }
  function summarizeRackActivity(activities) {
    let reservedPowerKw = 0;
    let idleBaselinePowerKw = 0;
    let activePowerKw = 0;
    let billedPowerKw = 0;
    let activeRackCount = 0;
    let idleRackCount = 0;
    let repairingRackCount = 0;
    for (const activity of activities) {
      reservedPowerKw += activity.reservedPowerKw;
      billedPowerKw += activity.billedPowerKw;
      if (activity.status === "active") {
        activeRackCount += 1;
        activePowerKw += activity.reservedPowerKw;
        continue;
      }
      idleBaselinePowerKw += activity.billedPowerKw;
      if (activity.status === "repairing") {
        repairingRackCount += 1;
      } else {
        idleRackCount += 1;
      }
    }
    return {
      reservedPowerKw,
      idleBaselinePowerKw,
      activePowerKw,
      billedPowerKw,
      activeRackCount,
      idleRackCount,
      repairingRackCount,
      totalRackCount: activities.length
    };
  }

  // packages/game-logic/src/catalog/datacenter-upgrades.ts
  var datacenterSpecId2 = (value) => value;
  function toUpgradeTrackNode(node) {
    return {
      id: node.id,
      label: node.label,
      capexCost: node.capexCost,
      opex: node.fixedMonthlyOpex && node.fixedMonthlyOpex > 0 ? { fixedMonthly: node.fixedMonthlyOpex } : {},
      infrastructure: node.infrastructure
    };
  }
  function buildUpgradeBlueprint(specId) {
    const balance = DATACENTER_UPGRADE_BALANCE[specId];
    if (!balance) {
      throw new Error(`Unknown datacenter upgrade balance: ${specId}`);
    }
    return {
      specId: datacenterSpecId2(specId),
      tracks: {
        cooling: {
          id: "cooling",
          label: balance.tracks.cooling.label,
          presentation: balance.tracks.cooling.presentation,
          nodes: balance.tracks.cooling.nodes.map(toUpgradeTrackNode)
        },
        networkType: {
          id: "networkType",
          label: balance.tracks.networkType.label,
          presentation: balance.tracks.networkType.presentation,
          nodes: balance.tracks.networkType.nodes.map(toUpgradeTrackNode)
        },
        onsiteGeneration: {
          id: "onsiteGeneration",
          label: balance.tracks.onsiteGeneration.label,
          presentation: balance.tracks.onsiteGeneration.presentation,
          nodes: balance.tracks.onsiteGeneration.nodes.map(toUpgradeTrackNode)
        }
      }
    };
  }
  var DATACENTER_UPGRADE_CATALOG = {
    garage: buildUpgradeBlueprint("garage"),
    warehouse: buildUpgradeBlueprint("warehouse"),
    hyperscale: buildUpgradeBlueprint("hyperscale")
  };
  function listDatacenterUpgradeTrackDefinitions(specId) {
    return Object.values(getDatacenterUpgradeBlueprint(specId).tracks);
  }
  function getDatacenterUpgradeBlueprint(specId) {
    const blueprint = DATACENTER_UPGRADE_CATALOG[specId];
    if (!blueprint) {
      throw new Error(`Unknown datacenter upgrade blueprint: ${specId}`);
    }
    return blueprint;
  }
  function getDatacenterUpgradeTrackDefinition(specId, trackId) {
    const track = getDatacenterUpgradeBlueprint(specId).tracks[trackId];
    if (!track) {
      throw new Error(`Unknown datacenter upgrade track '${trackId}' for blueprint '${specId}'`);
    }
    return track;
  }
  function defaultDatacenterUpgradeNodeByTrack(specId) {
    const blueprint = getDatacenterUpgradeBlueprint(specId);
    return {
      cooling: blueprint.tracks.cooling.nodes[0],
      networkType: blueprint.tracks.networkType.nodes[0],
      onsiteGeneration: blueprint.tracks.onsiteGeneration.nodes[0]
    };
  }
  function createDatacenterUpgradeProgress(specId) {
    const defaultNodes = defaultDatacenterUpgradeNodeByTrack(specId);
    return {
      currentNodeByTrack: {
        cooling: defaultNodes.cooling.id,
        networkType: defaultNodes.networkType.id,
        onsiteGeneration: defaultNodes.onsiteGeneration.id
      }
    };
  }
  function isNetworkTypeFiber(networkType) {
    return networkType === DATACENTER_UPGRADE_FABRIC_NETWORK_TYPE;
  }

  // packages/game-logic/src/sim/maintenance.ts
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function rackAgeMonths(currentTick, rack) {
    return Math.max(0, currentTick - rack.installedAtTick);
  }
  function rackFailureChance(ageMonths, difficulty = DEFAULT_DIFFICULTY) {
    const failureCurve = DIFFICULTY_CONFIG[difficulty].failureCurvePct;
    const clampedYearIndex = clamp(Math.floor(Math.max(0, ageMonths) / 12), 0, failureCurve.length - 1);
    return failureCurve[clampedYearIndex] / 100;
  }
  function rackDailyFailureChance(monthlyChance) {
    if (monthlyChance <= 0) {
      return 0;
    }
    if (monthlyChance >= 1) {
      return 1;
    }
    return 1 - (1 - monthlyChance) ** (1 / DAYS_PER_TICK);
  }
  function repairSpeedMultiplier(maintenanceStaff) {
    const extraStaff = Math.max(0, maintenanceStaff);
    return clamp(
      BASE_REPAIR_SPEED_MULTIPLIER + extraStaff * REPAIR_SPEED_BONUS_PER_MAINTENANCE_STAFF,
      BASE_REPAIR_SPEED_MULTIPLIER,
      MAX_REPAIR_SPEED_MULTIPLIER
    );
  }
  function repairProgressPerSubtick(maintenanceStaff) {
    return repairSpeedMultiplier(maintenanceStaff);
  }
  function rackKindFromRepairTarget(target) {
    return typeof target === "string" ? target : target.kind;
  }
  function repairDurationDays(target, difficulty = DEFAULT_DIFFICULTY) {
    return repairBaseDaysForRackKind(rackKindFromRepairTarget(target)) * DIFFICULTY_CONFIG[difficulty].repairTimeMultiplier;
  }
  function advanceRackRepair(rack, maintenanceStaff, difficulty = DEFAULT_DIFFICULTY) {
    var _a;
    if (rack.health !== "repairing") {
      return rack;
    }
    const nextRepairProgressDays = ((_a = rack.repairProgressDays) != null ? _a : 0) + repairProgressPerSubtick(maintenanceStaff);
    if (nextRepairProgressDays < repairDurationDays(rack, difficulty)) {
      return __spreadProps(__spreadValues({}, rack), {
        repairProgressDays: nextRepairProgressDays
      });
    }
    const _b = rack, { repairProgressDays: _repairProgressDays } = _b, repairedRack = __objRest(_b, ["repairProgressDays"]);
    return __spreadProps(__spreadValues({}, repairedRack), {
      health: "healthy"
    });
  }

  // packages/game-logic/src/entities/region.ts
  function regionPowerUsed(regionId2, datacenters) {
    return datacenters.filter((dc) => dc.regionId === regionId2).reduce((total, dc) => total + datacenterBaseInfrastructure(dc.spec).gridImportCapacityKw, 0);
  }
  function regionStaffUsed(regionId2, datacenters) {
    return datacenters.filter((dc) => dc.regionId === regionId2).reduce((total, dc) => total + dc.spec.staffCount + dc.maintenanceStaff, 0);
  }
  function canBuildInRegion(region, spec, datacenters) {
    const powerNeeded = regionPowerUsed(region.id, datacenters) + datacenterBaseInfrastructure(spec).gridImportCapacityKw;
    const staffNeeded = regionStaffUsed(region.id, datacenters) + spec.staffCount;
    return powerNeeded <= region.totalPowerAvailable && staffNeeded <= region.totalStaffAvailable;
  }

  // packages/game-logic/src/entities/rack.ts
  function rackCapacity(spec) {
    return {
      vCpu: spec.vCpu,
      ramGb: spec.ramGb,
      storageTb: spec.storageTb,
      gpuFlops: spec.gpuFlops
    };
  }

  // packages/game-logic/src/entities/datacenter.ts
  var EMPTY_CAPACITY = {
    vCpu: 0,
    ramGb: 0,
    storageTb: 0,
    gpuFlops: 0
  };
  function cloneCapacity(capacity) {
    return {
      vCpu: capacity.vCpu,
      ramGb: capacity.ramGb,
      storageTb: capacity.storageTb,
      gpuFlops: capacity.gpuFlops
    };
  }
  function cloneUsage(usage) {
    return {
      powerKw: usage.powerKw,
      heatOutputBtuPerHr: usage.heatOutputBtuPerHr,
      bandwidthGbps: usage.bandwidthGbps,
      slotsUsed: usage.slotsUsed
    };
  }
  function subtractCapacity(total, reserved) {
    return {
      vCpu: Math.max(0, total.vCpu - reserved.vCpu),
      ramGb: Math.max(0, total.ramGb - reserved.ramGb),
      storageTb: Math.max(0, total.storageTb - reserved.storageTb),
      gpuFlops: Math.max(0, total.gpuFlops - reserved.gpuFlops)
    };
  }
  function getRackSpec(placement) {
    const spec = RACK_CATALOG[placement.specId];
    if (!spec) {
      throw new Error(`Unknown rack spec: ${placement.specId}`);
    }
    return spec;
  }
  function datacenterBaseInfrastructure(spec) {
    return {
      gridImportCapacityKw: spec.powerCapacityKw,
      onsiteGenerationCapacityKw: 0,
      rackPowerCapacityKw: spec.powerCapacityKw,
      coolingCapacityBtuPerHr: spec.coolingCapacityBtuPerHr,
      coolingType: spec.coolingType,
      networkType: spec.networkType,
      bandwidthGbps: spec.bandwidthGbps
    };
  }
  function resolveDatacenterUpgradeProgress(datacenter) {
    var _a;
    return (_a = datacenter.upgrades) != null ? _a : createDatacenterUpgradeProgress(datacenter.spec.id);
  }
  function resolveDatacenterUpgradeState(datacenter) {
    var _a;
    const progress = resolveDatacenterUpgradeProgress(datacenter);
    const tracks = listDatacenterUpgradeTrackDefinitions(datacenter.spec.id).map((track) => {
      var _a2, _b;
      const currentNodeId = (_a2 = progress.currentNodeByTrack[track.id]) != null ? _a2 : track.nodes[0].id;
      const currentNodeIndex = track.nodes.findIndex((node) => node.id === currentNodeId);
      if (currentNodeIndex < 0) {
        throw new Error(`Unknown current node '${currentNodeId}' for track '${track.id}' on '${datacenter.spec.id}'`);
      }
      return {
        trackId: track.id,
        label: track.label,
        presentation: track.presentation,
        currentNode: track.nodes[currentNodeIndex],
        currentNodeIndex,
        nextNode: (_b = track.nodes[currentNodeIndex + 1]) != null ? _b : null,
        maxNode: track.nodes[track.nodes.length - 1],
        maxed: currentNodeIndex === track.nodes.length - 1
      };
    });
    const networkTrack = tracks.find((track) => track.trackId === "networkType");
    if (!networkTrack) {
      throw new Error(`Datacenter '${datacenter.spec.id}' is missing a networkType upgrade track`);
    }
    return {
      progress,
      tracks,
      fabricEligible: isNetworkTypeFiber((_a = networkTrack.currentNode.infrastructure.networkType) != null ? _a : datacenter.spec.networkType)
    };
  }
  function validateDatacenterUpgradeRequest(datacenter, trackId, targetNodeId) {
    var _a;
    const trackDefinition = getDatacenterUpgradeTrackDefinition(datacenter.spec.id, trackId);
    const trackState = resolveDatacenterUpgradeState(datacenter).tracks.find((candidate) => candidate.trackId === trackId);
    if (!trackState) {
      throw new Error(`Datacenter '${datacenter.spec.id}' does not support upgrade track '${trackId}'`);
    }
    if (trackState.maxed) {
      throw new Error(`Upgrade track '${trackId}' is already maxed for datacenter '${datacenter.spec.id}'`);
    }
    if (targetNodeId === trackState.currentNode.id) {
      throw new Error(`Upgrade track '${trackId}' is already at node '${targetNodeId}'`);
    }
    const requestedNode = trackDefinition.nodes.find((node) => node.id === targetNodeId);
    if (!requestedNode) {
      throw new Error(`Unknown datacenter upgrade node '${targetNodeId}' for track '${trackId}' on '${datacenter.spec.id}'`);
    }
    const nextNode = trackState.nextNode;
    if (!nextNode || nextNode.id !== requestedNode.id) {
      throw new Error(
        `Upgrade track '${trackId}' must advance to immediate next node '${(_a = nextNode == null ? void 0 : nextNode.id) != null ? _a : "<maxed>"}', received '${targetNodeId}'`
      );
    }
    return {
      trackId,
      trackLabel: trackState.label,
      currentNode: trackState.currentNode,
      targetNode: requestedNode,
      capexCost: requestedNode.capexCost
    };
  }
  function applyDatacenterUpgrade(datacenter, trackId, targetNodeId) {
    validateDatacenterUpgradeRequest(datacenter, trackId, targetNodeId);
    const progress = resolveDatacenterUpgradeProgress(datacenter);
    return __spreadProps(__spreadValues({}, datacenter), {
      upgrades: {
        currentNodeByTrack: __spreadProps(__spreadValues({}, progress.currentNodeByTrack), {
          [trackId]: targetNodeId
        })
      }
    });
  }
  function resolveDatacenterInfrastructureFromUpgradeState(datacenter, upgradeState) {
    var _a, _b, _c, _d, _e;
    const resolved = datacenterBaseInfrastructure(datacenter.spec);
    for (const track of upgradeState.tracks) {
      if (track.currentNodeIndex === 0) {
        continue;
      }
      const { infrastructure } = track.currentNode;
      resolved.coolingType = (_a = infrastructure.coolingType) != null ? _a : resolved.coolingType;
      resolved.coolingCapacityBtuPerHr = (_b = infrastructure.coolingCapacityBtuPerHr) != null ? _b : resolved.coolingCapacityBtuPerHr;
      resolved.networkType = (_c = infrastructure.networkType) != null ? _c : resolved.networkType;
      resolved.bandwidthGbps = (_d = infrastructure.bandwidthGbps) != null ? _d : resolved.bandwidthGbps;
      resolved.onsiteGenerationCapacityKw = (_e = infrastructure.onsiteGenerationCapacityKw) != null ? _e : resolved.onsiteGenerationCapacityKw;
    }
    resolved.rackPowerCapacityKw = resolved.gridImportCapacityKw + resolved.onsiteGenerationCapacityKw;
    return resolved;
  }
  function resolveDatacenterUpgradeEconomicsFromUpgradeState(upgradeState) {
    var _a;
    const byTrack = {
      cooling: 0,
      networkType: 0,
      onsiteGeneration: 0
    };
    for (const track of upgradeState.tracks) {
      byTrack[track.trackId] = (_a = track.currentNode.opex.fixedMonthly) != null ? _a : 0;
    }
    return {
      fixedMonthly: byTrack.cooling + byTrack.networkType + byTrack.onsiteGeneration,
      byTrack
    };
  }
  function resolveDatacenterOperationalProfile(datacenter) {
    const upgradeState = resolveDatacenterUpgradeState(datacenter);
    return {
      upgradeState,
      infrastructure: resolveDatacenterInfrastructureFromUpgradeState(datacenter, upgradeState),
      upgradeEconomics: resolveDatacenterUpgradeEconomicsFromUpgradeState(upgradeState)
    };
  }
  function resolveDatacenterInfrastructure(datacenter) {
    return resolveDatacenterOperationalProfile(datacenter).infrastructure;
  }
  function isWithinBounds(datacenter, position) {
    return position.row >= 0 && position.row < datacenter.spec.rows && position.position >= 0 && position.position < datacenter.spec.positionsPerRow;
  }
  function isSlotTaken(datacenter, position) {
    return datacenter.placements.some(
      (placement) => placement.row === position.row && placement.position === position.position
    );
  }
  function summarizeDatacenterPlacements(datacenter, currentTick) {
    let powerKw = 0;
    let heatOutputBtuPerHr = 0;
    let bandwidthGbps = 0;
    let slotsUsed = 0;
    let installedVCpu = 0;
    let installedRamGb = 0;
    let installedStorageTb = 0;
    let installedGpuFlops = 0;
    let usableVCpu = 0;
    let usableRamGb = 0;
    let usableStorageTb = 0;
    let usableGpuFlops = 0;
    let repairingRackCount = 0;
    let rackAgeMonthsTotal = 0;
    for (const placement of datacenter.placements) {
      const spec = getRackSpec(placement);
      const capacity = rackCapacity(spec);
      powerKw += spec.powerDrawKw;
      heatOutputBtuPerHr += spec.heatOutputBtuPerHr;
      bandwidthGbps += spec.bandwidthGbps;
      slotsUsed += 1;
      installedVCpu += capacity.vCpu;
      installedRamGb += capacity.ramGb;
      installedStorageTb += capacity.storageTb;
      installedGpuFlops += capacity.gpuFlops;
      if (placement.health === "healthy") {
        usableVCpu += capacity.vCpu;
        usableRamGb += capacity.ramGb;
        usableStorageTb += capacity.storageTb;
        usableGpuFlops += capacity.gpuFlops;
      } else {
        repairingRackCount += 1;
      }
      if (currentTick !== void 0) {
        rackAgeMonthsTotal += rackAgeMonths(currentTick, placement);
      }
    }
    const totalRackCount = datacenter.placements.length;
    return {
      usage: {
        powerKw,
        heatOutputBtuPerHr,
        bandwidthGbps,
        slotsUsed
      },
      installed: {
        vCpu: installedVCpu,
        ramGb: installedRamGb,
        storageTb: installedStorageTb,
        gpuFlops: installedGpuFlops
      },
      usable: {
        vCpu: usableVCpu,
        ramGb: usableRamGb,
        storageTb: usableStorageTb,
        gpuFlops: usableGpuFlops
      },
      totalRackCount,
      repairingRackCount,
      averageRackAgeMonths: currentTick === void 0 || totalRackCount === 0 ? void 0 : rackAgeMonthsTotal / totalRackCount
    };
  }
  function committedDemandForContracts(contracts, dcId) {
    let vCpu = 0;
    let ramGb = 0;
    let storageTb = 0;
    let gpuFlops = 0;
    for (const contract of contracts) {
      if (contract.assignedDcId !== dcId || !isLiveContract(contract)) {
        continue;
      }
      vCpu += contract.requirements.vCpu;
      ramGb += contract.requirements.ramGb;
      storageTb += contract.requirements.storageTb;
      gpuFlops += contract.requirements.gpuFlops;
    }
    return { vCpu, ramGb, storageTb, gpuFlops };
  }
  function summarizeAllDatacenterOperationalCapacities(datacenters, contracts, currentTick) {
    const committedByDcId = /* @__PURE__ */ new Map();
    for (const contract of contracts) {
      if (!contract.assignedDcId || !isLiveContract(contract)) {
        continue;
      }
      const existing = committedByDcId.get(contract.assignedDcId);
      if (existing) {
        existing.vCpu += contract.requirements.vCpu;
        existing.ramGb += contract.requirements.ramGb;
        existing.storageTb += contract.requirements.storageTb;
        existing.gpuFlops += contract.requirements.gpuFlops;
        continue;
      }
      committedByDcId.set(contract.assignedDcId, {
        vCpu: contract.requirements.vCpu,
        ramGb: contract.requirements.ramGb,
        storageTb: contract.requirements.storageTb,
        gpuFlops: contract.requirements.gpuFlops
      });
    }
    return datacenters.map((datacenter) => {
      var _a, _b;
      const placementAggregate = summarizeDatacenterPlacements(datacenter, currentTick);
      const committed = cloneCapacity((_a = committedByDcId.get(datacenter.id)) != null ? _a : EMPTY_CAPACITY);
      return {
        dcId: datacenter.id,
        usage: cloneUsage(placementAggregate.usage),
        installed: cloneCapacity(placementAggregate.installed),
        usable: cloneCapacity(placementAggregate.usable),
        committed,
        available: subtractCapacity(placementAggregate.usable, committed),
        maintenance: currentTick === void 0 ? void 0 : {
          totalRackCount: placementAggregate.totalRackCount,
          healthyRackCount: placementAggregate.totalRackCount - placementAggregate.repairingRackCount,
          repairingRackCount: placementAggregate.repairingRackCount,
          averageRackAgeMonths: (_b = placementAggregate.averageRackAgeMonths) != null ? _b : 0
        }
      };
    });
  }
  function datacenterUsage(datacenter) {
    return cloneUsage(summarizeDatacenterPlacements(datacenter).usage);
  }
  function datacenterContractCapacitySummary(datacenter, contracts) {
    const placementAggregate = summarizeDatacenterPlacements(datacenter);
    const committed = committedDemandForContracts(contracts, datacenter.id);
    return {
      installed: cloneCapacity(placementAggregate.installed),
      usable: cloneCapacity(placementAggregate.usable),
      committed,
      available: subtractCapacity(placementAggregate.usable, committed)
    };
  }
  function serviceUnitsForRackKind(spec) {
    switch (spec.kind) {
      case "compute":
        return spec.vCpu;
      case "memory":
        return spec.ramGb;
      case "storage":
        return spec.storageTb;
      case "gpu":
        return spec.gpuFlops;
      default:
        return 0;
    }
  }
  function datacenterRackActivityCandidates(datacenter) {
    return datacenter.placements.map((placement) => {
      const spec = getRackSpec(placement);
      return {
        placementId: placement.id,
        specId: placement.specId,
        kind: placement.kind,
        powerDrawKw: spec.powerDrawKw,
        serviceUnits: serviceUnitsForRackKind(spec),
        isRepairing: placement.health !== "healthy"
      };
    });
  }
  function allocateDatacenterRackActivity(datacenter, assignedDemand) {
    return allocateRackActivity(
      datacenterRackActivityCandidates(datacenter),
      rackDemandByKindFromRequirements(assignedDemand)
    );
  }
  function datacenterRackActivityView(datacenter, assignedDemand) {
    return allocateDatacenterRackActivity(datacenter, assignedDemand).activities;
  }
  function datacenterRackPowerSummary(datacenter, assignedDemand) {
    const activities = datacenterRackActivityView(datacenter, assignedDemand);
    return summarizeRackActivity(activities);
  }
  function canPlaceRack(datacenter, spec, position) {
    if (!isWithinBounds(datacenter, position)) {
      return { ok: false, reason: "out_of_bounds" };
    }
    if (isSlotTaken(datacenter, position)) {
      return { ok: false, reason: "slot_taken" };
    }
    const infrastructure = resolveDatacenterInfrastructure(datacenter);
    if (infrastructure.coolingType === "air" && spec.tier === 3) {
      return { ok: false, reason: "cooling_type_mismatch" };
    }
    const usage = datacenterUsage(datacenter);
    if (usage.powerKw + spec.powerDrawKw > infrastructure.rackPowerCapacityKw) {
      return { ok: false, reason: "insufficient_power" };
    }
    if (usage.heatOutputBtuPerHr + spec.heatOutputBtuPerHr > infrastructure.coolingCapacityBtuPerHr) {
      return { ok: false, reason: "insufficient_cooling" };
    }
    if (usage.bandwidthGbps + spec.bandwidthGbps > infrastructure.bandwidthGbps) {
      return { ok: false, reason: "insufficient_bandwidth" };
    }
    return { ok: true };
  }
  function canMoveRack(sourceDc, targetDc, placement, targetPosition) {
    if (sourceDc.id === targetDc.id) {
      return { ok: false, reason: "Cannot move rack to the same datacenter" };
    }
    const placementExists = sourceDc.placements.some((p) => p.id === placement.id);
    if (!placementExists) {
      return { ok: false, reason: "Rack placement not found in source datacenter" };
    }
    const spec = getRackSpec(placement);
    const placeResult = canPlaceRack(targetDc, spec, targetPosition);
    if (!placeResult.ok) {
      return { ok: false, reason: `Cannot place rack: ${placeResult.reason}` };
    }
    return { ok: true };
  }

  // packages/game-logic/src/contracts/lifecycle.ts
  var CONTRACT_BREACH_AUTO_CANCEL_MONTHS = 3;
  function isLiveContractLifecycleState(lifecycleState) {
    return lifecycleState === "serving" || lifecycleState === "breached";
  }
  function isHistoricalContractLifecycleState(lifecycleState) {
    return lifecycleState === "market_expired" || lifecycleState === "cancelled" || lifecycleState === "completed";
  }
  function effectiveLifecycleState(contract) {
    return contract.status ? lifecycleStateFromStatus(contract) : contract.lifecycleState;
  }
  function isMarketOpenContract(contract) {
    return effectiveLifecycleState(contract) === "market_open";
  }
  function isLiveContract(contract) {
    return isLiveContractLifecycleState(effectiveLifecycleState(contract));
  }
  function isHistoricalContract(contract) {
    return isHistoricalContractLifecycleState(effectiveLifecycleState(contract));
  }
  function isCompletedContract(contract) {
    return effectiveLifecycleState(contract) === "completed";
  }
  function isCancelledContract(contract) {
    return effectiveLifecycleState(contract) === "cancelled";
  }
  function selectOpenMarketContracts(contracts) {
    return contracts.filter(isMarketOpenContract);
  }
  function selectLiveContracts(contracts) {
    return contracts.filter(isLiveContract);
  }
  function selectHistoricalContracts(contracts) {
    return contracts.filter(isHistoricalContract);
  }
  function lifecycleStateFromStatus(contract) {
    switch (contract.status) {
      case "offered":
        return "market_open";
      case "active":
        return "serving";
      case "breached":
        return "breached";
      case "cancelled":
        return "cancelled";
      case "expired":
        return contract.assignedDcId ? "completed" : "market_expired";
    }
  }
  function normalizedContract(contract) {
    const lifecycleState = lifecycleStateFromStatus(contract);
    const normalized = withContractSlaDefaults(contract);
    if (normalized.lifecycleState === lifecycleState) {
      return normalized;
    }
    return __spreadProps(__spreadValues({}, normalized), {
      lifecycleState
    });
  }
  function contractsFromState(state) {
    var _a, _b, _c;
    const legacyContracts = [...(_a = state.activeContracts) != null ? _a : [], ...(_b = state.contractMarket) != null ? _b : []];
    const contracts = (_c = state.contracts) != null ? _c : [];
    const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
    const legacyOverrides = legacyContracts.filter((contract) => {
      const canonical = contractsById.get(contract.id);
      return !canonical || canonical.status !== contract.status || canonical.assignedDcId !== contract.assignedDcId;
    });
    const legacyOverrideIds = new Set(legacyOverrides.map((contract) => contract.id));
    return [
      ...legacyOverrides,
      ...contracts.filter((contract) => !legacyOverrideIds.has(contract.id))
    ].map(normalizedContract);
  }
  function withDerivedContractViews(state) {
    const openMarket = selectOpenMarketContracts(state.contracts);
    const acceptedHistoryOrLive = state.contracts.filter(
      (contract) => isLiveContract(contract) || isCompletedContract(contract) || isCancelledContract(contract)
    );
    return __spreadProps(__spreadValues({}, state), {
      contractMarket: openMarket,
      activeContracts: acceptedHistoryOrLive
    });
  }

  // packages/game-logic/src/state/indexed-view.ts
  function createEntityIndexView(state) {
    return {
      datacenterById: new Map(state.datacenters.map((datacenter) => [datacenter.id, datacenter])),
      regionById: new Map(state.map.regions.map((region) => [region.id, region]))
    };
  }
  function createIndexedGameStateView(state) {
    const contracts = contractsFromState(state);
    return __spreadProps(__spreadValues({}, createEntityIndexView(state)), {
      contractById: new Map(contracts.map((contract) => [contract.id, contract])),
      contracts,
      openMarketContracts: selectOpenMarketContracts(contracts),
      liveContracts: selectLiveContracts(contracts),
      historicalContracts: selectHistoricalContracts(contracts)
    });
  }

  // packages/game-logic/src/entities/fabric.ts
  var EMPTY_MEMBER_IDS = [];
  var EMPTY_CAPACITY2 = {
    vCpu: 0,
    ramGb: 0,
    storageTb: 0,
    gpuFlops: 0
  };
  function accumulateCapacity(total, delta) {
    total.vCpu += delta.vCpu;
    total.ramGb += delta.ramGb;
    total.storageTb += delta.storageTb;
    total.gpuFlops += delta.gpuFlops;
  }
  function subtractCapacity2(total, reserved) {
    return {
      vCpu: Math.max(0, total.vCpu - reserved.vCpu),
      ramGb: Math.max(0, total.ramGb - reserved.ramGb),
      storageTb: Math.max(0, total.storageTb - reserved.storageTb),
      gpuFlops: Math.max(0, total.gpuFlops - reserved.gpuFlops)
    };
  }
  function capacitySummaryOf(summary) {
    return {
      installed: __spreadValues({}, summary.installed),
      usable: __spreadValues({}, summary.usable),
      committed: __spreadValues({}, summary.committed),
      available: __spreadValues({}, summary.available)
    };
  }
  function aggregateCapacitySummaries(summaries) {
    const installed = __spreadValues({}, EMPTY_CAPACITY2);
    const usable = __spreadValues({}, EMPTY_CAPACITY2);
    const committed = __spreadValues({}, EMPTY_CAPACITY2);
    for (const summary of summaries) {
      accumulateCapacity(installed, summary.installed);
      accumulateCapacity(usable, summary.usable);
      accumulateCapacity(committed, summary.committed);
    }
    return {
      installed,
      usable,
      committed,
      available: subtractCapacity2(usable, committed)
    };
  }
  function getDatacenterOrThrow(datacenters, dcId) {
    const datacenter = datacenters.find((candidate) => candidate.id === dcId);
    if (!datacenter) {
      throw new Error(`Unknown datacenter: ${dcId}`);
    }
    return datacenter;
  }
  function getRegionOrThrow(regions, regionId2) {
    let region;
    if (Array.isArray(regions)) {
      region = regions.find((candidate) => candidate.id === regionId2);
    } else {
      region = regions.get(regionId2);
    }
    if (!region) {
      throw new Error(`Unknown region: ${regionId2}`);
    }
    return region;
  }
  function createEmptyRegionFabric() {
    return {
      memberDcIds: [...EMPTY_MEMBER_IDS]
    };
  }
  function ensureRegionFabric(fabric) {
    return fabric != null ? fabric : createEmptyRegionFabric();
  }
  function getRegionFabricMemberIds(region) {
    return [...ensureRegionFabric(region.fabric).memberDcIds];
  }
  function isDatacenterInRegionFabric(region, dcId) {
    return getRegionFabricMemberIds(region).includes(dcId);
  }
  function isDatacenterFiberEligible(datacenter) {
    return resolveDatacenterUpgradeState(datacenter).fabricEligible;
  }
  function resolveDatacenterCapacityPoolMemberIds(state, dcId) {
    const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
    const region = state.map.regions.find((candidate) => candidate.id === datacenter.regionId);
    if (!region) {
      return [dcId];
    }
    return isDatacenterInRegionFabric(region, dcId) ? getRegionFabricMemberIds(region) : [dcId];
  }
  function fabricPoolKey(memberDcIds) {
    return memberDcIds.join("\0");
  }
  function toOperationalCapacitySummaryMap(summaries) {
    return new Map(summaries.map((summary) => [summary.dcId, summary]));
  }
  function summarizeAllDatacenterFabricCapacities(state, contracts = contractsFromState(state)) {
    const indexedState = createEntityIndexView(state);
    const localSummaries = summarizeAllDatacenterOperationalCapacities(
      state.datacenters,
      selectLiveContracts(contracts)
    );
    const localSummaryByDcId = toOperationalCapacitySummaryMap(localSummaries);
    const pooledSummaryByKey = /* @__PURE__ */ new Map();
    return localSummaries.map((localSummary) => {
      const datacenter = indexedState.datacenterById.get(localSummary.dcId);
      if (!datacenter) {
        throw new Error(`Unknown datacenter: ${localSummary.dcId}`);
      }
      const region = indexedState.regionById.get(datacenter.regionId);
      const memberDcIds = region && isDatacenterInRegionFabric(region, datacenter.id) ? getRegionFabricMemberIds(region) : [datacenter.id];
      const connected = memberDcIds.length > 1;
      const local = capacitySummaryOf(localSummary);
      if (!connected) {
        return __spreadValues({
          dcId: datacenter.id,
          connected: false,
          memberDcIds,
          local
        }, local);
      }
      const poolKey = fabricPoolKey(memberDcIds);
      let pooled = pooledSummaryByKey.get(poolKey);
      if (!pooled) {
        pooled = {
          memberDcIds: [...memberDcIds],
          summary: aggregateCapacitySummaries(
            memberDcIds.map((memberDcId) => {
              const memberSummary = localSummaryByDcId.get(memberDcId);
              if (!memberSummary) {
                throw new Error(`Unknown datacenter in fabric pool: ${memberDcId}`);
              }
              return memberSummary;
            })
          )
        };
        pooledSummaryByKey.set(poolKey, pooled);
      }
      return __spreadValues({
        dcId: datacenter.id,
        connected: true,
        memberDcIds: [...pooled.memberDcIds],
        local
      }, capacitySummaryOf(pooled.summary));
    });
  }
  function summarizeFabricCapacityForDatacenter(state, dcId, contracts = contractsFromState(state)) {
    const liveContracts = selectLiveContracts(contracts);
    const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
    const local = datacenterContractCapacitySummary(datacenter, liveContracts);
    const memberDcIds = resolveDatacenterCapacityPoolMemberIds(state, dcId);
    const connected = memberDcIds.length > 1;
    if (!connected) {
      return __spreadValues({
        dcId,
        connected,
        memberDcIds,
        local
      }, local);
    }
    const pooled = aggregateCapacitySummaries(
      memberDcIds.map((memberDcId) => datacenterContractCapacitySummary(getDatacenterOrThrow(state.datacenters, memberDcId), liveContracts))
    );
    return __spreadValues({
      dcId,
      connected,
      memberDcIds,
      local
    }, pooled);
  }
  var FabricLinkError = class extends Error {
    constructor(message, data) {
      super(message);
      __publicField(this, "data");
      this.name = "FabricLinkError";
      this.data = data;
    }
  };
  function unknownDatacenterError(sourceDcId, targetDcId, dcId) {
    return new FabricLinkError(`Unknown datacenter: ${dcId}`, {
      code: "unknown_datacenter",
      sourceDcId,
      targetDcId,
      dcId
    });
  }
  function validateFabricLinkRequest(state, sourceDcId, targetDcId) {
    const indexedState = createEntityIndexView(state);
    const sourceDc = indexedState.datacenterById.get(sourceDcId);
    if (!sourceDc) {
      throw unknownDatacenterError(sourceDcId, targetDcId, sourceDcId);
    }
    const targetDc = indexedState.datacenterById.get(targetDcId);
    if (!targetDc) {
      throw unknownDatacenterError(sourceDcId, targetDcId, targetDcId);
    }
    if (sourceDc.id === targetDc.id) {
      throw new FabricLinkError("Cannot join a datacenter to itself", {
        code: "invalid_join",
        sourceDcId,
        targetDcId,
        dcId: sourceDc.id
      });
    }
    if (sourceDc.regionId !== targetDc.regionId) {
      throw new FabricLinkError(
        `Datacenters ${sourceDc.id} and ${targetDc.id} must be in the same region to share fabric`,
        {
          code: "cross_region",
          sourceDcId,
          targetDcId,
          regionId: sourceDc.regionId
        }
      );
    }
    if (!isDatacenterFiberEligible(sourceDc)) {
      throw new FabricLinkError(`Datacenter ${sourceDc.id} must be on fiber before joining the regional fabric`, {
        code: "non_fiber_datacenter",
        sourceDcId,
        targetDcId,
        dcId: sourceDc.id,
        regionId: sourceDc.regionId
      });
    }
    if (!isDatacenterFiberEligible(targetDc)) {
      throw new FabricLinkError(`Datacenter ${targetDc.id} must be on fiber before joining the regional fabric`, {
        code: "non_fiber_datacenter",
        sourceDcId,
        targetDcId,
        dcId: targetDc.id,
        regionId: sourceDc.regionId
      });
    }
    const region = getRegionOrThrow(indexedState.regionById, sourceDc.regionId);
    const memberDcIds = getRegionFabricMemberIds(region);
    const sourceMember = memberDcIds.includes(sourceDc.id);
    const targetMember = memberDcIds.includes(targetDc.id);
    if (sourceMember && targetMember) {
      throw new FabricLinkError(`Datacenters ${sourceDc.id} and ${targetDc.id} are already linked to the regional fabric`, {
        code: "duplicate_join",
        sourceDcId,
        targetDcId,
        regionId: region.id
      });
    }
    if (memberDcIds.length === 0) {
      return {
        regionId: region.id,
        sourceDc,
        targetDc,
        updatedMemberDcIds: [sourceDc.id, targetDc.id],
        capexCost: REGIONAL_FABRIC_JOIN_COST,
        mode: "bootstrap"
      };
    }
    if (!sourceMember && !targetMember) {
      throw new FabricLinkError(
        `Region ${region.id} already has a fabric; new joins must connect through an existing member`,
        {
          code: "invalid_join",
          sourceDcId,
          targetDcId,
          regionId: region.id
        }
      );
    }
    return {
      regionId: region.id,
      sourceDc,
      targetDc,
      updatedMemberDcIds: sourceMember ? [...memberDcIds, targetDc.id] : [...memberDcIds, sourceDc.id],
      capexCost: REGIONAL_FABRIC_JOIN_COST,
      mode: "join"
    };
  }
  function applyValidatedFabricLink(region, validated) {
    if (region.id !== validated.regionId) {
      throw new Error(`Fabric link targets region ${validated.regionId}, received ${region.id}`);
    }
    return __spreadProps(__spreadValues({}, region), {
      fabric: {
        memberDcIds: validated.updatedMemberDcIds
      }
    });
  }

  // packages/game-logic/src/contracts/sla.ts
  var DEFAULT_CONTRACT_SLA_TARGET_PERCENT = 90;
  function createEmptyContractSlaWindow() {
    return {
      sampledDays: 0,
      servedDays: 0,
      failedDays: 0
    };
  }
  function pickContractSlaTargetPercent(contract) {
    if (contract.urgency === "rush" || contract.tier >= 3) {
      return 95;
    }
    if (contract.penaltyPerMonth >= contract.monthlyPayment * 0.5) {
      return 95;
    }
    if (contract.urgency === "anchor") {
      return 80;
    }
    return DEFAULT_CONTRACT_SLA_TARGET_PERCENT;
  }
  function normalizeContractSlaWindow(window) {
    var _a, _b, _c;
    return {
      sampledDays: (_a = window == null ? void 0 : window.sampledDays) != null ? _a : 0,
      servedDays: (_b = window == null ? void 0 : window.servedDays) != null ? _b : 0,
      failedDays: (_c = window == null ? void 0 : window.failedDays) != null ? _c : 0
    };
  }
  function withContractSlaDefaults(contract) {
    var _a;
    return __spreadProps(__spreadValues({}, contract), {
      slaTargetPercent: (_a = contract.slaTargetPercent) != null ? _a : DEFAULT_CONTRACT_SLA_TARGET_PERCENT,
      currentSlaWindow: normalizeContractSlaWindow(contract.currentSlaWindow)
    });
  }
  function canServeContractPool(dcId, capacitySummaryByDcId) {
    const summary = capacitySummaryByDcId.get(dcId);
    if (!summary) {
      return false;
    }
    return summary.usable.vCpu >= summary.committed.vCpu && summary.usable.ramGb >= summary.committed.ramGb && summary.usable.storageTb >= summary.committed.storageTb && summary.usable.gpuFlops >= summary.committed.gpuFlops;
  }
  function sampleContractSlaWindows(state, contracts) {
    const liveContracts = selectLiveContracts(contracts);
    const capacitySummaryByDcId = new Map(
      summarizeAllDatacenterFabricCapacities(state, liveContracts).map((summary) => [summary.dcId, summary])
    );
    return contracts.map((contract) => {
      if (contract.lifecycleState !== "serving" && contract.lifecycleState !== "breached") {
        return withContractSlaDefaults(contract);
      }
      const normalized = withContractSlaDefaults(contract);
      if (!normalized.assignedDcId) {
        return __spreadProps(__spreadValues({}, normalized), {
          currentSlaWindow: {
            sampledDays: normalized.currentSlaWindow.sampledDays + 1,
            servedDays: normalized.currentSlaWindow.servedDays,
            failedDays: normalized.currentSlaWindow.failedDays + 1
          }
        });
      }
      const served = canServeContractPool(normalized.assignedDcId, capacitySummaryByDcId);
      return __spreadProps(__spreadValues({}, normalized), {
        currentSlaWindow: {
          sampledDays: normalized.currentSlaWindow.sampledDays + 1,
          servedDays: normalized.currentSlaWindow.servedDays + (served ? 1 : 0),
          failedDays: normalized.currentSlaWindow.failedDays + (served ? 0 : 1)
        }
      });
    });
  }
  function contractSlaServedPercent(contract) {
    const sampledDays = contract.currentSlaWindow.sampledDays;
    if (sampledDays <= 0) {
      return 100;
    }
    return contract.currentSlaWindow.servedDays / sampledDays * 100;
  }
  function contractMeetsSlaTarget(contract) {
    return contractSlaServedPercent(contract) >= contract.slaTargetPercent;
  }
  function resetContractSlaWindow(contract) {
    return __spreadProps(__spreadValues({}, contract), {
      currentSlaWindow: createEmptyContractSlaWindow()
    });
  }

  // packages/game-logic/src/contracts/generator.ts
  var COMPANY_PREFIXES = [
    "Apex",
    "Blue",
    "Cobalt",
    "Global",
    "Helix",
    "Nimbus",
    "Northstar",
    "Nova",
    "Orbital",
    "Quantum",
    "Vertex"
  ];
  var COMPANY_SUFFIXES = [
    "Cloud",
    "Compute",
    "Dynamics",
    "Industries",
    "Labs",
    "Networks",
    "Platforms",
    "Systems",
    "Technologies",
    "Works"
  ];
  var PROJECT_CODENAMES = [
    "Atlas",
    "Aurora",
    "Beacon",
    "Catalyst",
    "Helios",
    "Meridian",
    "Nova",
    "Orion",
    "Signal",
    "Vector"
  ];
  var CONTRACT_THEMES = [
    {
      id: "ai_training",
      label: "AI Training",
      deliverables: ["LLM Cluster", "Foundation Model Pod", "Training Fabric"],
      standardTermRange: [4, 10],
      anchorTermRange: [10, 18],
      rushTermRange: [1, 2],
      affinityWeights: [
        { key: "global", weight: 3 },
        { key: "usa", weight: 6 },
        { key: "asia", weight: 1 }
      ],
      weights: { vCpu: 0.2, ramGb: 0.45, storageTb: 0.15, gpuFlops: 1 }
    },
    {
      id: "ai_inference",
      label: "AI Inference",
      deliverables: ["Inference Mesh", "Serving Fleet", "Vector Gateway"],
      standardTermRange: [2, 6],
      anchorTermRange: [6, 12],
      rushTermRange: [1, 2],
      affinityWeights: [
        { key: "global", weight: 5 },
        { key: "asia", weight: 3 },
        { key: "usa", weight: 2 }
      ],
      weights: { vCpu: 0.45, ramGb: 0.4, storageTb: 0.15, gpuFlops: 0.55 }
    },
    {
      id: "hpc_simulation",
      label: "HPC Simulation",
      deliverables: ["Simulation Grid", "Compute Sweep", "Monte Carlo Farm"],
      standardTermRange: [3, 8],
      anchorTermRange: [8, 14],
      rushTermRange: [1, 2],
      affinityWeights: [
        { key: "global", weight: 6 },
        { key: "usa", weight: 3 },
        { key: "eu", weight: 1 }
      ],
      weights: { vCpu: 1, ramGb: 0.7, storageTb: 0.2, gpuFlops: 0.3 }
    },
    {
      id: "enterprise_db",
      label: "Enterprise OLTP",
      deliverables: ["OLTP Failover Ring", "Transactional Core", "Business Continuity Stack"],
      standardTermRange: [9, 18],
      anchorTermRange: [18, 30],
      rushTermRange: [1, 2],
      affinityWeights: [
        { key: "global", weight: 3 },
        { key: "eu", weight: 6 },
        { key: "usa", weight: 1 }
      ],
      weights: { vCpu: 0.55, ramGb: 1, storageTb: 0.45, gpuFlops: 0 }
    },
    {
      id: "cold_storage",
      label: "Cold Storage",
      deliverables: ["Archive Vault", "Compliance Repository", "Deep Backup Lake"],
      standardTermRange: [12, 24],
      anchorTermRange: [24, 36],
      rushTermRange: [1, 2],
      affinityWeights: [
        { key: "global", weight: 4 },
        { key: "eu", weight: 5 },
        { key: "asia", weight: 1 }
      ],
      weights: { vCpu: 0.05, ramGb: 0.08, storageTb: 1, gpuFlops: 0 }
    },
    {
      id: "cdn_edge",
      label: "CDN Edge",
      deliverables: ["Edge POP Rollout", "Caching Mesh", "Regional Delivery Grid"],
      standardTermRange: [4, 9],
      anchorTermRange: [9, 16],
      rushTermRange: [1, 2],
      affinityWeights: [
        { key: "global", weight: 6 },
        { key: "asia", weight: 3 },
        { key: "eu", weight: 1 }
      ],
      weights: { vCpu: 0.8, ramGb: 0.3, storageTb: 0.55, gpuFlops: 0 }
    },
    {
      id: "video_render",
      label: "Video Transcoding",
      deliverables: ["Render Pipeline", "Transcode Swarm", "Streaming Encode Farm"],
      standardTermRange: [1, 4],
      anchorTermRange: [4, 6],
      rushTermRange: [1, 2],
      affinityWeights: [
        { key: "global", weight: 5 },
        { key: "asia", weight: 4 },
        { key: "usa", weight: 1 }
      ],
      weights: { vCpu: 0.45, ramGb: 0.35, storageTb: 0.25, gpuFlops: 0.7 }
    }
  ];
  var REQUIREMENT_UNITS = {
    vCpu: 256,
    ramGb: 4096,
    storageTb: 1200,
    gpuFlops: 1100
  };
  var PRICING_WEIGHTS = {
    vCpu: 50,
    ramGb: 2.1,
    storageTb: 24,
    gpuFlops: 39
  };
  var BASE_CONTRACT_MONTHLY_FEE = 5e3;
  var DEFAULT_CONTRACT_PRICING = {
    baseMonthlyFee: BASE_CONTRACT_MONTHLY_FEE,
    weights: PRICING_WEIGHTS
  };
  var OFFER_DURATION_TICKS = 6;
  var SHORT_TERM_MAX_MONTHS = 6;
  var LONG_TERM_MIN_MONTHS = 12;
  var MARKET_BAND_GENERATION_ATTEMPTS = 6;
  var BASELINE_CONTRACT_GENERATION_POLICY = reliabilityMarketPolicyForScore(
    RELIABILITY_BASELINE_SCORE
  );
  function clampDifficulty(difficulty) {
    return Math.min(1, Math.max(0, difficulty));
  }
  function contractId(value) {
    return value;
  }
  function pickOne(rng, values) {
    const index = Math.floor(rng.next() * values.length);
    return values[Math.min(index, values.length - 1)];
  }
  function pickWeighted(rng, values) {
    const totalWeight = values.reduce((sum, value) => sum + Math.max(0, value.weight), 0);
    if (totalWeight <= 0) {
      return values[0].value;
    }
    let roll = rng.next() * totalWeight;
    for (const value of values) {
      roll -= Math.max(0, value.weight);
      if (roll <= 0) {
        return value.value;
      }
    }
    return values[values.length - 1].value;
  }
  function availableThemes(difficulty, constraints = {}) {
    let themes = difficulty < 0.25 ? CONTRACT_THEMES.filter((t) => t.weights.gpuFlops === 0) : CONTRACT_THEMES;
    if (constraints.requireNonGpu) {
      themes = themes.filter((theme) => theme.weights.gpuFlops === 0);
    }
    return themes;
  }
  function generateContractName(rng, theme) {
    const company = `${pickOne(rng, COMPANY_PREFIXES)} ${pickOne(rng, COMPANY_SUFFIXES)}`;
    const codename = pickOne(rng, PROJECT_CODENAMES);
    const deliverable = pickOne(rng, theme.deliverables);
    return `${company} ${codename} ${deliverable}`;
  }
  function roundToMultiple(value, multiple) {
    return Math.max(multiple, Math.round(value / multiple) * multiple);
  }
  function roundMoney3(value) {
    return Math.round(value * 100) / 100;
  }
  function roundMoneyToNearest(value, multiple) {
    return roundMoney3(Math.round(value / multiple) * multiple);
  }
  function monthlyRateMultiplierForTerm(termMonths) {
    const extraMonths = Math.max(0, Math.round(termMonths) - CONTRACT_TERM_DISCOUNT_BASELINE_MONTHS);
    return Math.max(
      CONTRACT_TERM_DISCOUNT_FLOOR,
      1 - extraMonths * CONTRACT_TERM_DISCOUNT_PER_EXTRA_MONTH
    );
  }
  function contractDifficultyPriceMultiplier(difficulty) {
    return 0.8 + clampDifficulty(difficulty) * 0.25;
  }
  function paymentMultiplierForUrgency(urgency) {
    switch (urgency) {
      case "rush":
        return 1.4;
      case "anchor":
        return 0.75;
      default:
        return 1;
    }
  }
  function contractTermBand(termMonths) {
    if (termMonths <= SHORT_TERM_MAX_MONTHS) {
      return "short";
    }
    if (termMonths >= LONG_TERM_MIN_MONTHS) {
      return "long";
    }
    return "standard";
  }
  function generateRequirement(rng, unit, weight, difficulty, multiple) {
    if (weight === 0) {
      return 0;
    }
    const magnitude = 0.55 + difficulty * 1.1;
    const jitter = 0.85 + rng.next() * 0.35;
    return roundToMultiple(unit * magnitude * weight * jitter, multiple);
  }
  function createRequirements(rng, theme, difficulty) {
    return {
      vCpu: generateRequirement(rng, REQUIREMENT_UNITS.vCpu, theme.weights.vCpu, difficulty, 16),
      ramGb: generateRequirement(rng, REQUIREMENT_UNITS.ramGb, theme.weights.ramGb, difficulty, 64),
      storageTb: generateRequirement(rng, REQUIREMENT_UNITS.storageTb, theme.weights.storageTb, difficulty, 10),
      gpuFlops: generateRequirement(rng, REQUIREMENT_UNITS.gpuFlops, theme.weights.gpuFlops, difficulty, 50)
    };
  }
  function contractValue(requirements, pricingWeights = PRICING_WEIGHTS) {
    return requirements.vCpu * pricingWeights.vCpu + requirements.ramGb * pricingWeights.ramGb + requirements.storageTb * pricingWeights.storageTb + requirements.gpuFlops * pricingWeights.gpuFlops;
  }
  function monthlyPaymentForRequirements(requirements, difficulty, termMonths, urgency, pricing = DEFAULT_CONTRACT_PRICING) {
    return roundMoneyToNearest(
      (pricing.baseMonthlyFee + contractValue(requirements, pricing.weights) * contractDifficultyPriceMultiplier(difficulty)) * paymentMultiplierForUrgency(urgency) * monthlyRateMultiplierForTerm(termMonths) * CONTRACT_PAYOUT_MULTIPLIER,
      100
    );
  }
  function createRegionAffinity(rng, theme, regions, requireUnrestricted = false) {
    if (requireUnrestricted) {
      return void 0;
    }
    const selectedAffinity = pickWeighted(
      rng,
      theme.affinityWeights.map((option) => ({ value: option.key, weight: option.weight }))
    );
    if (selectedAffinity === "global") {
      return void 0;
    }
    const allowedRegionIds = regionIdsForContractAffinity(selectedAffinity, regions);
    if (allowedRegionIds.length === 0) {
      return void 0;
    }
    return {
      key: selectedAffinity,
      allowedRegionIds
    };
  }
  function rollTermMonths(rng, range, difficulty) {
    const [minMonths, maxMonths] = range;
    if (minMonths >= maxMonths) {
      return minMonths;
    }
    const span = maxMonths - minMonths;
    const difficultyFloor = Math.floor(span * clampDifficulty(difficulty) * 0.5);
    const remainingSpan = Math.max(0, span - difficultyFloor);
    return minMonths + difficultyFloor + Math.floor(rng.next() * (remainingSpan + 1));
  }
  function urgencyThresholdsForPolicy(policy) {
    const rushThreshold = Math.max(0.12, Math.min(0.32, 0.2 * policy.shortTermBias));
    const anchorThreshold = Math.max(
      rushThreshold + 0.05,
      Math.min(0.48, rushThreshold + 0.15 * policy.longTermBias)
    );
    return {
      rushThreshold,
      anchorThreshold
    };
  }
  function termBiasOffset(policy) {
    return Math.round((policy.longTermBias - policy.shortTermBias) * 2);
  }
  function applyTermBias(termMonths, policy) {
    return Math.max(1, termMonths + termBiasOffset(policy));
  }
  function generateContract(rng, difficulty, policy = BASELINE_CONTRACT_GENERATION_POLICY, regions = Object.values(REGION_CATALOG), constraints = {}) {
    const normalizedDifficulty = clampDifficulty(difficulty);
    const theme = pickOne(rng, availableThemes(normalizedDifficulty, constraints));
    const requirements = createRequirements(rng, theme, normalizedDifficulty);
    const contractName = generateContractName(rng, theme);
    const urgencyRoll = rng.next();
    const urgencyThresholds = urgencyThresholdsForPolicy(policy);
    let urgency = "standard";
    let offerDuration = OFFER_DURATION_TICKS;
    let termMonths = rollTermMonths(rng, theme.standardTermRange, normalizedDifficulty);
    let penaltyMultiplier = 1;
    if (urgencyRoll < urgencyThresholds.rushThreshold) {
      urgency = "rush";
      offerDuration = 2;
      termMonths = rollTermMonths(rng, theme.rushTermRange, normalizedDifficulty);
      penaltyMultiplier = 1.2;
    } else if (urgencyRoll < urgencyThresholds.anchorThreshold) {
      urgency = "anchor";
      termMonths = rollTermMonths(rng, theme.anchorTermRange, normalizedDifficulty);
      penaltyMultiplier = 0.6;
    }
    termMonths = applyTermBias(termMonths, policy);
    const tier = normalizedDifficulty < 0.35 ? 1 : normalizedDifficulty < 0.7 ? 2 : 3;
    const regionAffinity = createRegionAffinity(rng, theme, regions, constraints.requireUnrestricted === true);
    const monthlyPayment = monthlyPaymentForRequirements(requirements, normalizedDifficulty, termMonths, urgency);
    const penaltyPerMonth = roundMoneyToNearest(
      Math.max(1e3, monthlyPayment * (0.4 + rng.next() * 0.15)) * penaltyMultiplier,
      100
    );
    const idSuffix = Math.floor(rng.next() * 1e6).toString(16).padStart(5, "0");
    const slaTargetPercent = pickContractSlaTargetPercent({
      urgency,
      tier,
      monthlyPayment,
      penaltyPerMonth
    });
    return __spreadProps(__spreadValues({
      id: contractId(`contract-${theme.id}-${idSuffix}`),
      name: contractName,
      requirements,
      monthlyPayment,
      penaltyPerMonth,
      termMonths,
      slaTargetPercent,
      currentSlaWindow: createEmptyContractSlaWindow(),
      lifecycleState: "market_open",
      status: "offered",
      urgency,
      tier
    }, regionAffinity ? { regionAffinity } : {}), {
      offeredAtTick: 0,
      expiresAtTick: offerDuration
    });
  }
  function generateContractForTermBand(rng, difficulty, desiredBand, policy = BASELINE_CONTRACT_GENERATION_POLICY, regions = Object.values(REGION_CATALOG), constraints = {}) {
    const satisfiesConstraints = (contract) => (!constraints.requireUnrestricted || !contract.regionAffinity) && (!constraints.requireNonGpu || contract.requirements.gpuFlops === 0);
    let fallback = generateContract(rng, difficulty, policy, regions, constraints);
    let constrainedFallback = satisfiesConstraints(fallback) ? fallback : void 0;
    if (contractTermBand(fallback.termMonths) === desiredBand && satisfiesConstraints(fallback)) {
      return fallback;
    }
    for (let attempt = 1; attempt < MARKET_BAND_GENERATION_ATTEMPTS; attempt++) {
      const candidate = generateContract(rng, difficulty, policy, regions, constraints);
      fallback = candidate;
      if (satisfiesConstraints(candidate)) {
        constrainedFallback = candidate;
      }
      if (contractTermBand(candidate.termMonths) === desiredBand && satisfiesConstraints(candidate)) {
        return candidate;
      }
    }
    return constrainedFallback != null ? constrainedFallback : fallback;
  }

  // packages/game-logic/src/balance/scenario-validation.ts
  var REBALANCE_VALIDATION_SCENARIOS = [
    {
      id: "starter-garage-mixed",
      label: "Starter garage with a mixed C1/M1/S1 footprint",
      datacenterId: DATACENTER_CATALOG.garage.id,
      regionId: REGION_CATALOG.sa_east.id,
      rackSpecIds: [RACK_CATALOG.C1.id, RACK_CATALOG.M1.id, RACK_CATALOG.S1.id],
      requirements: {
        vCpu: 192,
        ramGb: 2560,
        storageTb: 150,
        gpuFlops: 0
      },
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    },
    {
      id: "warehouse-storage-heavy",
      label: "Storage-heavy early warehouse build",
      datacenterId: DATACENTER_CATALOG.warehouse.id,
      regionId: REGION_CATALOG.sa_east.id,
      rackSpecIds: [
        RACK_CATALOG.S1.id,
        RACK_CATALOG.S1.id,
        RACK_CATALOG.S1.id,
        RACK_CATALOG.S1.id,
        RACK_CATALOG.S1.id,
        RACK_CATALOG.S1.id,
        RACK_CATALOG.S1.id,
        RACK_CATALOG.S1.id
      ],
      requirements: {
        vCpu: 192,
        ramGb: 2048,
        storageTb: 4e3,
        gpuFlops: 0
      },
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    },
    {
      id: "garage-oltp-edge",
      label: "Mixed compute+memory build for OLTP / edge contracts",
      datacenterId: DATACENTER_CATALOG.garage.id,
      regionId: REGION_CATALOG.us_west.id,
      rackSpecIds: [RACK_CATALOG.C1.id, RACK_CATALOG.C1.id, RACK_CATALOG.M1.id, RACK_CATALOG.M1.id],
      requirements: {
        vCpu: 320,
        ramGb: 4800,
        storageTb: 60,
        gpuFlops: 0
      },
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    }
  ];
  var EARLY_GAME_RUNWAY_REQUIREMENTS = {
    vCpu: 320,
    ramGb: 4800,
    storageTb: 60,
    gpuFlops: 0
  };
  var EARLY_GAME_RUNWAY_RACK_SPEC_IDS = [
    RACK_CATALOG.C1.id,
    RACK_CATALOG.C1.id,
    RACK_CATALOG.M1.id,
    RACK_CATALOG.M1.id
  ];
  var EARLY_GAME_RUNWAY_VALIDATION_SCENARIOS = [
    {
      id: "starter-garage-us-east",
      label: "Starter garage runway in US East",
      datacenterId: DATACENTER_CATALOG.garage.id,
      regionId: REGION_CATALOG.us_east.id,
      rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
      requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    },
    {
      id: "starter-garage-us-west",
      label: "Starter garage runway in US West",
      datacenterId: DATACENTER_CATALOG.garage.id,
      regionId: REGION_CATALOG.us_west.id,
      rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
      requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    },
    {
      id: "starter-garage-eu-west",
      label: "Starter garage runway in EU West",
      datacenterId: DATACENTER_CATALOG.garage.id,
      regionId: REGION_CATALOG.eu_west.id,
      rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
      requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    },
    {
      id: "starter-garage-ap-southeast",
      label: "Starter garage runway in AP Southeast",
      datacenterId: DATACENTER_CATALOG.garage.id,
      regionId: REGION_CATALOG.ap_southeast.id,
      rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
      requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    },
    {
      id: "starter-garage-sa-east",
      label: "Starter garage runway in SA East",
      datacenterId: DATACENTER_CATALOG.garage.id,
      regionId: REGION_CATALOG.sa_east.id,
      rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
      requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    },
    {
      id: "starter-garage-me-central",
      label: "Starter garage runway in ME Central",
      datacenterId: DATACENTER_CATALOG.garage.id,
      regionId: REGION_CATALOG.me_central.id,
      rackSpecIds: EARLY_GAME_RUNWAY_RACK_SPEC_IDS,
      requirements: EARLY_GAME_RUNWAY_REQUIREMENTS,
      difficulty: 0.65,
      termMonths: 3,
      urgency: "standard"
    }
  ];

  // packages/game-logic/src/sim/rng.ts
  var UINT32_MAX_PLUS_ONE = 4294967296;
  function normalizeSeed(seed) {
    return seed >>> 0;
  }
  function createRng(seed) {
    let currentState = normalizeSeed(seed);
    return {
      next() {
        currentState = currentState + 1831565813 >>> 0;
        let value = currentState;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / UINT32_MAX_PLUS_ONE;
      },
      state() {
        return currentState;
      }
    };
  }
  function rngFromState(state) {
    return createRng(state);
  }

  // packages/game-logic/src/economy/capex.ts
  var ledgerEntryId = (value) => value;
  function createLedgerEntry(state, amount, reason) {
    return {
      id: ledgerEntryId(`ledger-${state.tick}-${state.ledger.length}`),
      tick: state.tick,
      type: "capex",
      amount,
      reason
    };
  }
  function applyCapex(state, amount, reason) {
    if (amount < 0) {
      throw new Error("Capex amount must be non-negative.");
    }
    if (state.player.cash < amount) {
      throw new Error(`Insufficient funds for capex: required ${amount}, available ${state.player.cash}.`);
    }
    return __spreadProps(__spreadValues({}, state), {
      player: __spreadProps(__spreadValues({}, state.player), {
        cash: state.player.cash - amount
      }),
      ledger: [...state.ledger, createLedgerEntry(state, -amount, reason)]
    });
  }

  // packages/game-logic/src/economy/move.ts
  var SAME_REGION_MOVE_COST_PERCENT = 0.1;
  var CROSS_REGION_MOVE_COST_PERCENT = 0.25;
  function calculateMoveCost(rackSpec, sourceRegionId, targetRegionId) {
    const percent = sourceRegionId === targetRegionId ? SAME_REGION_MOVE_COST_PERCENT : CROSS_REGION_MOVE_COST_PERCENT;
    return Math.round(rackSpec.capexCost * percent);
  }

  // packages/game-logic/src/contracts/reliability.ts
  function contractReliabilityDelta(kind) {
    switch (kind) {
      case "fulfilled":
        return RELIABILITY_DELTA_FULFILLED;
      case "breached":
        return RELIABILITY_DELTA_BREACHED;
      case "cancelled":
        return RELIABILITY_DELTA_CANCELLED;
    }
  }
  function createContractSlaOutcome(contract, tick2, kind) {
    return {
      contractId: contract.id,
      contractName: contract.name,
      tick: tick2,
      kind
    };
  }
  function calculateReliabilityDelta(outcomes) {
    return outcomes.reduce((total, outcome) => total + contractReliabilityDelta(outcome.kind), 0);
  }
  function applyReliabilityDelta(score, delta) {
    return clampReliabilityScore(score + delta);
  }
  function updatePlayerReliability(reliability, outcomes) {
    if (outcomes.length === 0) {
      return reliability;
    }
    const delta = calculateReliabilityDelta(outcomes);
    const nextRecentOutcomes = [...reliability.recentOutcomes, ...outcomes].slice(-RELIABILITY_RECENT_OUTCOME_LIMIT);
    return {
      score: applyReliabilityDelta(reliability.score, delta),
      lastDelta: delta,
      recentOutcomes: nextRecentOutcomes
    };
  }

  // packages/game-logic/src/economy/opex.ts
  var EMPTY_CAPACITY3 = {
    vCpu: 0,
    ramGb: 0,
    storageTb: 0,
    gpuFlops: 0
  };
  function roundMoney4(value) {
    return Math.round(value * 100) / 100;
  }
  function maintenanceCostForDatacenter(datacenter) {
    let maintenance = 0;
    for (const placement of datacenter.placements) {
      const spec = RACK_CATALOG[placement.specId];
      if (!spec) {
        throw new Error(`Unknown rack spec: ${placement.specId}`);
      }
      maintenance += spec.monthlyMaintenance;
    }
    return maintenance;
  }
  function buildAssignedDemandByDatacenter(contracts) {
    const assignedDemandByDatacenter = /* @__PURE__ */ new Map();
    for (const contract of contracts) {
      if (!contract.assignedDcId || !isLiveContract(contract)) {
        continue;
      }
      const existing = assignedDemandByDatacenter.get(contract.assignedDcId);
      if (existing) {
        existing.vCpu += contract.requirements.vCpu;
        existing.ramGb += contract.requirements.ramGb;
        existing.storageTb += contract.requirements.storageTb;
        existing.gpuFlops += contract.requirements.gpuFlops;
        continue;
      }
      assignedDemandByDatacenter.set(contract.assignedDcId, {
        vCpu: contract.requirements.vCpu,
        ramGb: contract.requirements.ramGb,
        storageTb: contract.requirements.storageTb,
        gpuFlops: contract.requirements.gpuFlops
      });
    }
    return assignedDemandByDatacenter;
  }
  function summarizeDatacenterOpexInputs(datacenter, options = {}) {
    var _a;
    const usage = datacenterUsage(datacenter);
    const operationalProfile = resolveDatacenterOperationalProfile(datacenter);
    const assignedDemand = (_a = options.assignedDemand) != null ? _a : EMPTY_CAPACITY3;
    const billedPowerKw = options.activityAwareBilling ? datacenterRackPowerSummary(datacenter, assignedDemand).billedPowerKw : usage.powerKw;
    return {
      usage,
      infrastructure: operationalProfile.infrastructure,
      upgradeEconomics: operationalProfile.upgradeEconomics,
      assignedDemand,
      billedPowerKw,
      maintenance: maintenanceCostForDatacenter(datacenter)
    };
  }
  function tickOpexFromInputs(datacenter, region, inputs) {
    const rawPowerCost = inputs.billedPowerKw * HOURS_PER_MONTH * region.powerCostPerKwh;
    const power = roundMoney4(rawPowerCost);
    const cooling = roundMoney4(rawPowerCost * COOLING_OVERHEAD_RATIO);
    const bandwidth = roundMoney4(inputs.infrastructure.bandwidthGbps * BANDWIDTH_USD_PER_GBPS_MONTH);
    const maintenanceStaffWage = maintenanceStaffWagePerHead(region.staffWage);
    const staff = roundMoney4(
      datacenter.spec.staffCount * region.staffWage + datacenter.maintenanceStaff * maintenanceStaffWage
    );
    const breakdown = {
      power,
      cooling,
      bandwidth,
      staff,
      maintenance: roundMoney4(inputs.maintenance),
      upgrades: roundMoney4(inputs.upgradeEconomics.fixedMonthly),
      tax: 0
    };
    return {
      total: roundMoney4(
        breakdown.power + breakdown.cooling + breakdown.bandwidth + breakdown.staff + breakdown.maintenance + breakdown.upgrades
      ),
      breakdown
    };
  }
  function tickRevenue(state, contracts = contractsFromState(state)) {
    const breachPenaltyMultiplier = DIFFICULTY_CONFIG[state.difficulty].breachPenaltyMultiplier;
    let revenue = 0;
    const perDcRevenue = {};
    const liveContracts = selectLiveContracts(contracts);
    const outcomes = [];
    const updatedLiveContracts = liveContracts.map((contract) => {
      var _a, _b, _c;
      const normalized = withContractSlaDefaults(contract);
      const dcId = normalized.assignedDcId;
      const penalty = roundMoney4(normalized.penaltyPerMonth * breachPenaltyMultiplier);
      const meetsTarget = dcId !== void 0 && contractMeetsSlaTarget(normalized);
      if (meetsTarget) {
        revenue += normalized.monthlyPayment;
        perDcRevenue[dcId] = ((_a = perDcRevenue[dcId]) != null ? _a : 0) + normalized.monthlyPayment;
        outcomes.push(createContractSlaOutcome(normalized, state.tick, "fulfilled"));
        return resetContractSlaWindow(__spreadProps(__spreadValues({}, normalized), {
          lifecycleState: "serving",
          status: "active",
          breachStreakMonths: 0
        }));
      }
      if (dcId !== void 0) {
        revenue -= penalty;
        perDcRevenue[dcId] = ((_b = perDcRevenue[dcId]) != null ? _b : 0) - penalty;
      }
      outcomes.push(createContractSlaOutcome(normalized, state.tick, "breached"));
      return resetContractSlaWindow(__spreadProps(__spreadValues({}, normalized), {
        lifecycleState: "breached",
        status: "breached",
        breachStreakMonths: ((_c = normalized.breachStreakMonths) != null ? _c : 0) + 1
      }));
    });
    const updatedContractsById = new Map(updatedLiveContracts.map((contract) => [contract.id, contract]));
    const updatedContracts = contracts.map((contract) => {
      var _a;
      return (_a = updatedContractsById.get(contract.id)) != null ? _a : contract;
    });
    return {
      revenue: roundMoney4(revenue),
      perDcRevenue,
      updatedContracts,
      outcomes
    };
  }

  // packages/game-logic/src/contracts/market.ts
  var ContractAcceptanceError = class extends Error {
    constructor(data) {
      super(
        data.code === "insufficient_capacity" ? `Datacenter ${data.dcId} lacks available capacity for this contract` : `Datacenter ${data.dcId} is in region ${data.dcRegionId}, but this contract only allows ${data.allowedRegionIds.join(", ")}`
      );
      __publicField(this, "data");
      this.name = "ContractAcceptanceError";
      this.data = data;
    }
  };
  function canCoverRequirements(capacity, requirements) {
    return capacity.vCpu >= requirements.vCpu && capacity.ramGb >= requirements.ramGb && capacity.storageTb >= requirements.storageTb && capacity.gpuFlops >= requirements.gpuFlops;
  }
  function datacenterRegionAllowed(contract, regionId2) {
    return contract.regionAffinity ? contract.regionAffinity.allowedRegionIds.includes(regionId2) : true;
  }
  function marketDifficulty(currentTick, roll) {
    const baseline = 0.15 + Math.min(0.65, currentTick * 0.015);
    if (currentTick <= 5) {
      return Math.max(0.05, Math.min(0.25, baseline + roll * 0.15));
    }
    return Math.max(0.05, Math.min(0.85, baseline + roll * 0.35 - 0.1));
  }
  function desiredMarketBandMix(offerTarget) {
    const shortTarget = Math.max(1, Math.floor(offerTarget / 3));
    const longTarget = Math.max(1, Math.floor(offerTarget / 3));
    const standardTarget = Math.max(0, offerTarget - shortTarget - longTarget);
    const mix = [];
    for (let i = 0; i < offerTarget; i++) {
      if (i % 3 === 0 && mix.filter((band) => band === "short").length < shortTarget) {
        mix.push("short");
        continue;
      }
      if (i % 3 === 1 && mix.filter((band) => band === "standard").length < standardTarget) {
        mix.push("standard");
        continue;
      }
      if (mix.filter((band) => band === "long").length < longTarget) {
        mix.push("long");
        continue;
      }
      if (mix.filter((band) => band === "short").length < shortTarget) {
        mix.push("short");
        continue;
      }
      mix.push("standard");
    }
    return mix;
  }
  function nextDesiredMarketBand(existingOffers, offerTarget) {
    var _a, _b, _c, _d;
    const desiredMix = desiredMarketBandMix(offerTarget);
    const currentCounts = /* @__PURE__ */ new Map([
      ["short", 0],
      ["standard", 0],
      ["long", 0]
    ]);
    for (const offer of existingOffers) {
      const band = contractTermBand(offer.termMonths);
      currentCounts.set(band, ((_a = currentCounts.get(band)) != null ? _a : 0) + 1);
    }
    const desiredCounts = /* @__PURE__ */ new Map([
      ["short", desiredMix.filter((band) => band === "short").length],
      ["standard", desiredMix.filter((band) => band === "standard").length],
      ["long", desiredMix.filter((band) => band === "long").length]
    ]);
    for (const band of ["short", "long", "standard"]) {
      if (((_b = currentCounts.get(band)) != null ? _b : 0) < ((_c = desiredCounts.get(band)) != null ? _c : 0)) {
        return band;
      }
    }
    return (_d = desiredMix[existingOffers.length % desiredMix.length]) != null ? _d : "standard";
  }
  function countUnrestrictedOffers(offers) {
    return offers.filter((offer) => !offer.regionAffinity).length;
  }
  function countNonGpuOffers(offers) {
    return offers.filter((offer) => offer.requirements.gpuFlops === 0).length;
  }
  function nextGenerationConstraints(existingOffers, offerTarget) {
    const remainingSlots = Math.max(0, offerTarget - existingOffers.length);
    if (remainingSlots === 0) {
      return {};
    }
    const unrestrictedGap = Math.max(0, minimumUnrestrictedMarketOffers(offerTarget) - countUnrestrictedOffers(existingOffers));
    const nonGpuGap = Math.max(0, minimumNonGpuMarketOffers(offerTarget) - countNonGpuOffers(existingOffers));
    const constraints = {};
    if (unrestrictedGap > 0) {
      constraints.requireUnrestricted = unrestrictedGap >= remainingSlots;
    }
    if (nonGpuGap > 0) {
      constraints.requireNonGpu = nonGpuGap >= remainingSlots;
    }
    if (unrestrictedGap > 0 && nonGpuGap > 0 && remainingSlots <= unrestrictedGap + nonGpuGap) {
      constraints.requireUnrestricted = true;
      constraints.requireNonGpu = true;
    }
    return constraints;
  }
  function fillMarketOffers(existingOffers, state, rngState) {
    const rng = rngFromState(rngState);
    const marketPolicy = reliabilityMarketPolicyForScore(state.player.reliability.score);
    const offerTarget = marketPolicy.offerCount;
    const offers = [...existingOffers].slice(0, offerTarget);
    while (offers.length < offerTarget) {
      const difficulty = marketDifficulty(state.tick, rng.next());
      const desiredBand = nextDesiredMarketBand(offers, offerTarget);
      const constraints = nextGenerationConstraints(offers, offerTarget);
      const generatedContract = generateContractForTermBand(
        rng,
        difficulty,
        desiredBand,
        marketPolicy,
        state.map.regions,
        constraints
      );
      offers.push(__spreadProps(__spreadValues({}, generatedContract), {
        offeredAtTick: state.tick,
        expiresAtTick: state.tick + generatedContract.expiresAtTick,
        lifecycleState: "market_open",
        status: "offered"
      }));
    }
    return { offers, rngState: rng.state() };
  }
  function refreshContractMarket(state) {
    const contracts = contractsFromState(state);
    const contractsWithExpiredOffers = contracts.map(
      (contract) => contract.lifecycleState === "market_open" && contract.expiresAtTick <= state.tick ? __spreadProps(__spreadValues({}, contract), {
        lifecycleState: "market_expired",
        status: "expired",
        closedAtTick: state.tick
      }) : contract
    );
    const retainedOffers = selectOpenMarketContracts(contractsWithExpiredOffers);
    const filledMarket = fillMarketOffers(retainedOffers, state, state.rngState);
    return withDerivedContractViews(__spreadProps(__spreadValues({}, state), {
      contracts: [
        ...contractsWithExpiredOffers.filter((contract) => contract.lifecycleState !== "market_open"),
        ...filledMarket.offers
      ],
      rngState: filledMarket.rngState
    }));
  }
  function acceptContract(state, contractId2, dcId) {
    const datacenter = state.datacenters.find((candidate) => candidate.id === dcId);
    if (!datacenter) {
      throw new Error(`Unknown datacenter: ${dcId}`);
    }
    const contracts = contractsFromState(state);
    const existingLiveContract = selectLiveContracts(contracts).find((contract) => contract.id === contractId2);
    if (existingLiveContract) {
      throw new Error(`Contract already active: ${contractId2}`);
    }
    const contractToAccept = selectOpenMarketContracts(contracts).find((contract) => contract.id === contractId2);
    if (!contractToAccept) {
      throw new Error(`Unknown market contract: ${contractId2}`);
    }
    if (!datacenterRegionAllowed(contractToAccept, datacenter.regionId)) {
      throw new ContractAcceptanceError({
        code: "region_not_allowed",
        dcId,
        dcRegionId: datacenter.regionId,
        affinityKey: contractToAccept.regionAffinity.key,
        allowedRegionIds: [...contractToAccept.regionAffinity.allowedRegionIds]
      });
    }
    const capacitySummary = summarizeFabricCapacityForDatacenter(state, dcId);
    if (!canCoverRequirements(capacitySummary.available, contractToAccept.requirements)) {
      throw new ContractAcceptanceError({
        code: "insufficient_capacity",
        dcId,
        required: contractToAccept.requirements,
        available: capacitySummary.available
      });
    }
    const acceptedContract = __spreadProps(__spreadValues({}, contractToAccept), {
      lifecycleState: "serving",
      status: "active",
      startedAtTick: state.tick,
      acceptedAtTick: state.tick,
      assignedDcId: dcId
    });
    const contractsWithAccepted = contracts.map(
      (contract) => contract.id === contractId2 ? acceptedContract : contract
    );
    const remainingMarket = selectOpenMarketContracts(contractsWithAccepted);
    const filledMarket = fillMarketOffers(remainingMarket, state, state.rngState);
    return withDerivedContractViews(__spreadProps(__spreadValues({}, state), {
      contracts: [
        ...contractsWithAccepted.filter((contract) => contract.lifecycleState !== "market_open"),
        ...filledMarket.offers
      ],
      rngState: filledMarket.rngState
    }));
  }

  // packages/game-logic/src/query/datacenters.ts
  var EMPTY_CAPACITY4 = {
    vCpu: 0,
    ramGb: 0,
    storageTb: 0,
    gpuFlops: 0
  };
  function accumulateCapacity2(total, delta) {
    total.vCpu += delta.vCpu;
    total.ramGb += delta.ramGb;
    total.storageTb += delta.storageTb;
    total.gpuFlops += delta.gpuFlops;
  }
  function summarizeAllDatacenterCapacitiesFromState(state) {
    return summarizeAllDatacenterOperationalCapacities(
      state.datacenters,
      selectLiveContracts(contractsFromState(state))
    ).map(({ dcId, installed, usable, committed, available }) => ({
      dcId,
      installed,
      usable,
      committed,
      available
    }));
  }
  function summarizeNetworkCapacityFromState(state) {
    const perDc = summarizeAllDatacenterCapacitiesFromState(state);
    const installed = __spreadValues({}, EMPTY_CAPACITY4);
    const usable = __spreadValues({}, EMPTY_CAPACITY4);
    const committed = __spreadValues({}, EMPTY_CAPACITY4);
    const available = __spreadValues({}, EMPTY_CAPACITY4);
    for (const summary of perDc) {
      accumulateCapacity2(installed, summary.installed);
      accumulateCapacity2(usable, summary.usable);
      accumulateCapacity2(committed, summary.committed);
      accumulateCapacity2(available, summary.available);
    }
    return {
      installed,
      usable,
      committed,
      available,
      perDc
    };
  }

  // packages/game-logic/src/query/finance.ts
  function selectLatestFinancialSnapshotFromState(state) {
    return state.financialHistory.at(-1);
  }
  function summarizeCumulativeRevenue(ledger) {
    return ledger.filter((entry) => entry.type === "revenue").reduce((sum, entry) => sum + entry.amount, 0);
  }
  function selectCumulativeRevenueFromState(state) {
    const latestSnapshot = selectLatestFinancialSnapshotFromState(state);
    return latestSnapshot && latestSnapshot.tick >= state.tick ? latestSnapshot.cumulativeRevenue : summarizeCumulativeRevenue(state.ledger);
  }

  // packages/game-logic/src/query/leaderboard.ts
  var LEADERBOARD_METRIC_KEYS = [
    "money",
    "cumulativeRevenue",
    "totalServers",
    "computeCapacity",
    "memoryCapacity",
    "storageCapacity",
    "gpuCapacity"
  ];
  function summarizeLeaderboardFromState(state) {
    const network = summarizeNetworkCapacityFromState(state);
    return {
      gameId: state.gameId,
      gameMonth: state.tick,
      metrics: normalizeLeaderboardMetrics({
        money: state.player.cash,
        cumulativeRevenue: selectCumulativeRevenueFromState(state),
        totalServers: countInstalledServers(state),
        computeCapacity: network.installed.vCpu,
        memoryCapacity: network.installed.ramGb,
        storageCapacity: network.installed.storageTb,
        gpuCapacity: network.installed.gpuFlops
      })
    };
  }
  function countInstalledServers(state) {
    return state.datacenters.reduce(
      (sum, datacenter) => sum + datacenter.placements.length,
      0
    );
  }
  function totalLeaderboardCapacity(metrics) {
    return metrics.computeCapacity + metrics.memoryCapacity + metrics.storageCapacity + metrics.gpuCapacity;
  }
  function normalizeLeaderboardMetrics(metrics) {
    return {
      money: roundLeaderboardMetric(metrics.money),
      cumulativeRevenue: roundLeaderboardMetric(metrics.cumulativeRevenue),
      totalServers: roundLeaderboardMetric(metrics.totalServers),
      computeCapacity: roundLeaderboardMetric(metrics.computeCapacity),
      memoryCapacity: roundLeaderboardMetric(metrics.memoryCapacity),
      storageCapacity: roundLeaderboardMetric(metrics.storageCapacity),
      gpuCapacity: roundLeaderboardMetric(metrics.gpuCapacity)
    };
  }
  function roundLeaderboardMetric(value) {
    return Math.round(value);
  }

  // packages/game-logic/src/state/financial-history.ts
  function roundMoney5(value) {
    return Math.round(value * 100) / 100;
  }
  function createBaselineFinancialSnapshot(cash, tick2) {
    return {
      tick: tick2,
      cash: roundMoney5(cash),
      revenue: 0,
      opex: 0,
      penalty: 0,
      capex: 0,
      netOperating: 0,
      netCashFlow: 0,
      cumulativeRevenue: 0
    };
  }
  function summarizeCapexBetweenTicks(ledger, startTickInclusive, endTickInclusive) {
    return roundMoney5(
      ledger.reduce((sum, entry) => {
        if (entry.type !== "capex") {
          return sum;
        }
        if (entry.tick < startTickInclusive || entry.tick > endTickInclusive) {
          return sum;
        }
        return sum + Math.max(0, -entry.amount);
      }, 0)
    );
  }
  function createMonthlyFinancialSnapshot({
    previousSnapshot,
    tick: tick2,
    cash,
    revenue,
    opex,
    penalty,
    capex
  }) {
    const normalizedRevenue = roundMoney5(Math.max(0, revenue));
    const normalizedOpex = roundMoney5(Math.max(0, opex));
    const normalizedPenalty = roundMoney5(Math.max(0, penalty));
    const normalizedCapex = roundMoney5(Math.max(0, capex));
    const normalizedCash = roundMoney5(cash);
    return {
      tick: tick2,
      cash: normalizedCash,
      revenue: normalizedRevenue,
      opex: normalizedOpex,
      penalty: normalizedPenalty,
      capex: normalizedCapex,
      netOperating: roundMoney5(normalizedRevenue - normalizedOpex - normalizedPenalty),
      netCashFlow: roundMoney5(normalizedCash - previousSnapshot.cash),
      cumulativeRevenue: roundMoney5(previousSnapshot.cumulativeRevenue + normalizedRevenue)
    };
  }

  // packages/game-logic/src/sim/tick.ts
  function roundMoney6(value) {
    return Math.round(value * 100) / 100;
  }
  function createLedgerEntry2(state, tick2, type, amount, reason, offset) {
    return {
      id: `ledger-${tick2}-${state.ledger.length + offset}`,
      tick: tick2,
      type,
      amount,
      reason
    };
  }
  function finalizeContract(contract, tick2) {
    var _a;
    if (!isLiveContract(contract) || contract.startedAtTick === void 0) {
      return contract;
    }
    if (contract.lifecycleState === "breached" && ((_a = contract.breachStreakMonths) != null ? _a : 0) >= CONTRACT_BREACH_AUTO_CANCEL_MONTHS) {
      return __spreadProps(__spreadValues({}, contract), {
        lifecycleState: "cancelled",
        status: "cancelled",
        closedAtTick: tick2
      });
    }
    const hasTermEnded = tick2 >= contract.startedAtTick + contract.termMonths;
    if (!hasTermEnded) {
      return contract;
    }
    return __spreadProps(__spreadValues({}, contract), {
      lifecycleState: "completed",
      status: "expired",
      breachStreakMonths: 0,
      closedAtTick: tick2
    });
  }
  function settleMonthlyTick(state) {
    var _a, _b;
    const nextTick = state.tick + 1;
    const maintenanceView = createIndexedGameStateView(state);
    const maintenanceState = __spreadProps(__spreadValues({}, state), {
      tick: nextTick,
      subtick: 0,
      contracts: [...maintenanceView.contracts]
    });
    const assignedDemandByDatacenter = buildAssignedDemandByDatacenter(maintenanceView.liveContracts);
    const perDcOpex = /* @__PURE__ */ new Map();
    let baseOpexTotal = 0;
    for (const datacenter of maintenanceState.datacenters) {
      const region = maintenanceView.regionById.get(datacenter.regionId);
      if (!region) {
        throw new Error(`Region not found for datacenter: ${datacenter.regionId}`);
      }
      const opexInputs = summarizeDatacenterOpexInputs(datacenter, {
        assignedDemand: assignedDemandByDatacenter.get(datacenter.id),
        activityAwareBilling: true
      });
      const opex = tickOpexFromInputs(datacenter, region, opexInputs);
      perDcOpex.set(datacenter.id, opex);
      baseOpexTotal += opex.total;
    }
    const revenueResult = tickRevenue(maintenanceState, maintenanceView.contracts);
    let totalTax = 0;
    for (const datacenter of maintenanceState.datacenters) {
      const region = maintenanceView.regionById.get(datacenter.regionId);
      if (!region) {
        throw new Error(`Region not found for datacenter: ${datacenter.regionId}`);
      }
      const opex = perDcOpex.get(datacenter.id);
      const dcRevenue = (_a = revenueResult.perDcRevenue[datacenter.id]) != null ? _a : 0;
      const profit = Math.max(0, dcRevenue - opex.total);
      const tax = roundMoney6(profit * region.taxRate);
      totalTax += tax;
      opex.breakdown.tax = tax;
    }
    const totalOpex = roundMoney6(baseOpexTotal + totalTax);
    const finalizedContracts = revenueResult.updatedContracts.map((contract) => finalizeContract(contract, nextTick));
    const nextReliability = updatePlayerReliability(state.player.reliability, revenueResult.outcomes);
    const revenue = Math.max(0, revenueResult.revenue);
    const penalty = Math.max(0, -revenueResult.revenue);
    const netCashDelta = roundMoney6(revenueResult.revenue - totalOpex);
    const ledgerEntries = [];
    if (totalOpex !== 0) {
      ledgerEntries.push(
        createLedgerEntry2(state, nextTick, "opex", -totalOpex, "Monthly datacenter operating costs", 0)
      );
    }
    if (revenue > 0) {
      ledgerEntries.push(
        createLedgerEntry2(
          state,
          nextTick,
          "revenue",
          revenue,
          "Contract revenue for SLA-compliant months",
          ledgerEntries.length
        )
      );
    } else if (penalty > 0) {
      ledgerEntries.push(
        createLedgerEntry2(
          state,
          nextTick,
          "penalty",
          -penalty,
          "Contract penalties for missed SLA months",
          ledgerEntries.length
        )
      );
    }
    const nextCash = roundMoney6(state.player.cash + netCashDelta);
    const previousSnapshot = (_b = state.financialHistory.at(-1)) != null ? _b : createBaselineFinancialSnapshot(state.player.cash, state.tick);
    const capex = summarizeCapexBetweenTicks(state.ledger, previousSnapshot.tick, nextTick);
    const advancedState = __spreadProps(__spreadValues({}, maintenanceState), {
      player: __spreadProps(__spreadValues({}, maintenanceState.player), {
        cash: nextCash,
        reliability: nextReliability
      }),
      contracts: finalizedContracts,
      ledger: [...state.ledger, ...ledgerEntries],
      financialHistory: [
        ...state.financialHistory,
        createMonthlyFinancialSnapshot({
          previousSnapshot,
          tick: nextTick,
          cash: nextCash,
          revenue,
          opex: totalOpex,
          penalty,
          capex
        })
      ]
    });
    return refreshContractMarket(withDerivedContractViews(advancedState));
  }
  function tick(state) {
    const targetTick = state.tick + 1;
    let nextState = state;
    while (nextState.tick < targetTick) {
      nextState = advanceSubtick(nextState);
    }
    return nextState;
  }

  // packages/game-logic/src/sim/subtick.ts
  function advanceDatacenterMaintenance(state) {
    const rng = rngFromState(state.rngState);
    const datacenters = state.datacenters.map((datacenter) => __spreadProps(__spreadValues({}, datacenter), {
      placements: datacenter.placements.map((placement) => {
        if (placement.health === "repairing") {
          return advanceRackRepair(placement, datacenter.maintenanceStaff, state.difficulty);
        }
        const monthlyFailureChance = rackFailureChance(rackAgeMonths(state.tick, placement), state.difficulty);
        const dailyFailureChance = rackDailyFailureChance(monthlyFailureChance);
        if (rng.next() >= dailyFailureChance) {
          return placement;
        }
        return __spreadProps(__spreadValues({}, placement), {
          health: "repairing",
          repairProgressDays: 0,
          lastFailureAtTick: state.tick,
          lastFailureAtSubtick: state.subtick
        });
      })
    }));
    return {
      datacenters,
      rngState: rng.state()
    };
  }
  function advanceSubtick(state) {
    const nextSubtick = state.subtick + 1;
    const maintenance = advanceDatacenterMaintenance(state);
    const maintenanceState = __spreadProps(__spreadValues({}, state), {
      datacenters: maintenance.datacenters,
      rngState: maintenance.rngState
    });
    const contracts = sampleContractSlaWindows(maintenanceState, contractsFromState(maintenanceState));
    const sampledState = withDerivedContractViews(__spreadProps(__spreadValues({}, maintenanceState), {
      contracts
    }));
    if (nextSubtick < DAYS_PER_TICK) {
      return __spreadProps(__spreadValues({}, sampledState), {
        subtick: nextSubtick
      });
    }
    return settleMonthlyTick(__spreadProps(__spreadValues({}, sampledState), {
      subtick: 0
    }));
  }

  // packages/game-logic/src/sim/mapgen.ts
  var POWER_COST_VARIATION = 0.1;
  var STAFF_WAGE_VARIATION = 0.05;
  function cloneRegion(region) {
    return __spreadValues({}, region);
  }
  function applyVariation(base, variation, rng) {
    const delta = (rng.next() * 2 - 1) * variation;
    return Math.round(base * (1 + delta) * 100) / 100;
  }
  function generateMap(seed) {
    const rng = createRng(seed);
    const regions = Object.values(REGION_CATALOG).map((region) => {
      const cloned = cloneRegion(region);
      cloned.powerCostPerKwh = applyVariation(region.powerCostPerKwh, POWER_COST_VARIATION, rng);
      cloned.staffWage = Math.round(applyVariation(region.staffWage, STAFF_WAGE_VARIATION, rng));
      return cloned;
    });
    return { regions };
  }

  // packages/game-logic/src/state/newGame.ts
  var DEFAULT_PLAYER_ID = "player-1";
  var INITIAL_TICK = 0;
  var INITIAL_SUBTICK = 0;
  function normalizeSeed2(seed) {
    return seed >>> 0;
  }
  function initializeRegionalFabric(map) {
    return __spreadProps(__spreadValues({}, map), {
      regions: map.regions.map((region) => __spreadProps(__spreadValues({}, region), {
        fabric: createEmptyRegionFabric()
      }))
    });
  }
  function newGame(seed, options = {}) {
    var _a, _b, _c, _d, _e;
    const effectiveSeed = normalizeSeed2((_a = options.seed) != null ? _a : seed);
    const difficulty = (_b = options.difficulty) != null ? _b : DEFAULT_DIFFICULTY;
    const startingCash = (_c = options.startingCash) != null ? _c : DIFFICULTY_CONFIG[difficulty].startingCash;
    const gameId = (_d = options.gameId) != null ? _d : crypto.randomUUID();
    if (!Number.isFinite(startingCash) || startingCash < 0) {
      throw new Error(`Invalid starting cash: ${startingCash}`);
    }
    const initialMap = initializeRegionalFabric(generateMap(effectiveSeed));
    const initialState = {
      gameId,
      game: {
        speed: 1,
        paused: false
      },
      tick: INITIAL_TICK,
      subtick: INITIAL_SUBTICK,
      seed: effectiveSeed,
      rngState: effectiveSeed,
      difficulty,
      player: {
        id: DEFAULT_PLAYER_ID,
        name: (_e = options.playerName) != null ? _e : "Player",
        cash: startingCash,
        reliability: {
          score: RELIABILITY_BASELINE_SCORE,
          recentOutcomes: []
        }
      },
      datacenters: [],
      contracts: [],
      contractMarket: [],
      activeContracts: [],
      ledger: [],
      financialHistory: [createBaselineFinancialSnapshot(startingCash, INITIAL_TICK)],
      audioEnabled: true,
      audioSettings: {
        master: true,
        music: true,
        sfx: true,
        money: true,
        ambient: true
      },
      map: initialMap
    };
    return withDerivedContractViews(refreshContractMarket(initialState));
  }
  function createVerifiedGenesisState(descriptor) {
    return newGame(descriptor.seed, {
      difficulty: descriptor.difficulty,
      gameId: descriptor.gameId,
      playerName: descriptor.playerName
    });
  }

  // packages/game-logic/src/state/reduce.ts
  function getDatacenterSpec(specId) {
    const spec = DATACENTER_CATALOG[specId];
    if (!spec) {
      throw new Error(`Unknown datacenter spec: ${specId}`);
    }
    return spec;
  }
  function getRackSpec2(specId) {
    const spec = RACK_CATALOG[specId];
    if (!spec) {
      throw new Error(`Unknown rack spec: ${specId}`);
    }
    return spec;
  }
  function getDatacenter(datacenterById, dcId) {
    const datacenter = datacenterById.get(dcId);
    if (!datacenter) {
      throw new Error(`Unknown datacenter: ${dcId}`);
    }
    return datacenter;
  }
  function getRegion(regionById, regionId2) {
    const region = regionById.get(regionId2);
    if (!region) {
      throw new Error(`Unknown region: ${regionId2}`);
    }
    return region;
  }
  function replaceDatacenter(state, updatedDatacenter) {
    return __spreadProps(__spreadValues({}, state), {
      datacenters: state.datacenters.map(
        (datacenter) => datacenter.id === updatedDatacenter.id ? updatedDatacenter : datacenter
      )
    });
  }
  function assertUniqueDatacenterId(datacenterById, dcId) {
    if (datacenterById.has(dcId)) {
      throw new Error(`Datacenter already exists: ${dcId}`);
    }
  }
  function assertUniquePlacementId(state, placementId) {
    if (state.datacenters.some(
      (datacenter) => datacenter.placements.some((placement) => placement.id === placementId)
    )) {
      throw new Error(`Rack placement already exists: ${placementId}`);
    }
  }
  function buildDatacenter(state, specId, dcId, regionId2) {
    const indexedState = createEntityIndexView(state);
    assertUniqueDatacenterId(indexedState.datacenterById, dcId);
    const spec = getDatacenterSpec(specId);
    const region = getRegion(indexedState.regionById, regionId2);
    if (!canBuildInRegion(region, spec, state.datacenters)) {
      throw new Error(`Insufficient power or staff in region: ${regionId2}`);
    }
    const sameSpecCount = state.datacenters.filter((datacenter) => datacenter.spec.id === spec.id).length;
    const namedDatacenter = {
      id: dcId,
      name: sameSpecCount === 0 ? spec.name : `${spec.name} ${sameSpecCount + 1}`,
      spec,
      placements: [],
      builtAtTick: state.tick,
      regionId: regionId2,
      maintenanceStaff: DEFAULT_MAINTENANCE_STAFF,
      upgrades: createDatacenterUpgradeProgress(spec.id)
    };
    const updatedRegions = state.map.regions.map(
      (r) => r.id === regionId2 ? __spreadProps(__spreadValues({}, r), {
        powerUsed: r.powerUsed + spec.powerCapacityKw,
        staffUsed: r.staffUsed + spec.staffCount
      }) : r
    );
    const debitedState = applyCapex(state, spec.capexCost, `Build datacenter: ${spec.name}`);
    return __spreadProps(__spreadValues({}, debitedState), {
      datacenters: [...debitedState.datacenters, namedDatacenter],
      map: __spreadProps(__spreadValues({}, debitedState.map), { regions: updatedRegions })
    });
  }
  function createRackPlacementError(datacenter, reason) {
    const error = new Error(`Cannot place rack: ${reason}`);
    if (reason === "out_of_bounds") {
      error.data = {
        code: "out_of_bounds",
        dcId: datacenter.id,
        rows: datacenter.spec.rows,
        positionsPerRow: datacenter.spec.positionsPerRow
      };
    }
    return error;
  }
  function placeRack(state, dcId, specId, row, position, placementId) {
    const indexedState = createEntityIndexView(state);
    assertUniquePlacementId(state, placementId);
    const datacenter = getDatacenter(indexedState.datacenterById, dcId);
    const spec = getRackSpec2(specId);
    const placementCheck = canPlaceRack(datacenter, spec, { row, position });
    if (!placementCheck.ok) {
      throw createRackPlacementError(datacenter, placementCheck.reason);
    }
    const placement = {
      id: placementId,
      specId: spec.id,
      kind: spec.kind,
      installedAtTick: state.tick,
      health: "healthy",
      row,
      position
    };
    const debitedState = applyCapex(state, spec.capexCost, `Purchase rack: ${spec.name}`);
    const refreshedDatacenter = __spreadProps(__spreadValues({}, datacenter), {
      placements: [...datacenter.placements, placement]
    });
    return replaceDatacenter(debitedState, refreshedDatacenter);
  }
  function removeRack(state, dcId, placementId) {
    const indexedState = createEntityIndexView(state);
    const datacenter = getDatacenter(indexedState.datacenterById, dcId);
    const placementExists = datacenter.placements.some((placement) => placement.id === placementId);
    if (!placementExists) {
      throw new Error(`Unknown rack placement: ${placementId}`);
    }
    return replaceDatacenter(state, __spreadProps(__spreadValues({}, datacenter), {
      placements: datacenter.placements.filter((placement) => placement.id !== placementId)
    }));
  }
  function moveRack(state, dcId, placementId, targetDcId, row, position) {
    const indexedState = createEntityIndexView(state);
    const sourceDc = getDatacenter(indexedState.datacenterById, dcId);
    const placement = sourceDc.placements.find((p) => p.id === placementId);
    if (!placement) {
      throw new Error(`Unknown rack placement: ${placementId}`);
    }
    if (dcId === targetDcId) {
      throw new Error("Cannot move rack to the same datacenter");
    }
    const targetDc = getDatacenter(indexedState.datacenterById, targetDcId);
    const spec = getRackSpec2(placement.specId);
    const moveCheck = canMoveRack(sourceDc, targetDc, placement, { row, position });
    if (!moveCheck.ok) {
      const reason = moveCheck.reason.replace(/^Cannot place rack: /, "");
      if (reason === "slot_taken" || reason === "out_of_bounds" || reason === "insufficient_power" || reason === "insufficient_cooling" || reason === "insufficient_bandwidth" || reason === "cooling_type_mismatch") {
        throw createRackPlacementError(targetDc, reason);
      }
      throw new Error(moveCheck.reason);
    }
    const cost = calculateMoveCost(spec, sourceDc.regionId, targetDc.regionId);
    const debitedState = applyCapex(state, cost, `Move rack: ${spec.name} to ${targetDc.name}`);
    const movedPlacement = __spreadProps(__spreadValues({}, placement), {
      row,
      position
    });
    const updatedSourceDc = __spreadProps(__spreadValues({}, sourceDc), {
      placements: sourceDc.placements.filter((p) => p.id !== placementId)
    });
    const updatedTargetDc = __spreadProps(__spreadValues({}, targetDc), {
      placements: [...targetDc.placements, movedPlacement]
    });
    return replaceDatacenter(replaceDatacenter(debitedState, updatedSourceDc), updatedTargetDc);
  }
  function upgradeDatacenter(state, dcId, trackId, targetNodeId) {
    const indexedState = createEntityIndexView(state);
    const datacenter = getDatacenter(indexedState.datacenterById, dcId);
    const validated = validateDatacenterUpgradeRequest(datacenter, trackId, targetNodeId);
    const debitedState = applyCapex(
      state,
      validated.capexCost,
      `Upgrade datacenter: ${datacenter.name} ${validated.trackLabel} \u2192 ${validated.targetNode.label}`
    );
    const refreshedDatacenter = applyDatacenterUpgrade(datacenter, trackId, targetNodeId);
    return replaceDatacenter(debitedState, refreshedDatacenter);
  }
  function cancelContract(state, contractId2) {
    const indexedState = createIndexedGameStateView(state);
    const contract = indexedState.contractById.get(contractId2);
    if (!contract) {
      throw new Error(`Unknown active contract: ${contractId2}`);
    }
    if (!isLiveContract(contract)) {
      throw new Error(`Contract cannot be cancelled from lifecycle state: ${contract.lifecycleState}`);
    }
    return withDerivedContractViews(__spreadProps(__spreadValues({}, state), {
      contracts: indexedState.contracts.map(
        (candidate) => candidate.id === contractId2 ? __spreadProps(__spreadValues({}, candidate), {
          lifecycleState: "cancelled",
          status: "cancelled",
          closedAtTick: state.tick
        }) : candidate
      )
    }));
  }
  function linkRegionalFabric(state, sourceDcId, targetDcId) {
    const validated = validateFabricLinkRequest(state, sourceDcId, targetDcId);
    const debitedState = applyCapex(
      state,
      validated.capexCost,
      validated.mode === "bootstrap" ? `Create regional fabric: ${validated.sourceDc.name} \u2194 ${validated.targetDc.name}` : `Join regional fabric: ${validated.sourceDc.name} \u2194 ${validated.targetDc.name}`
    );
    return __spreadProps(__spreadValues({}, debitedState), {
      map: __spreadProps(__spreadValues({}, debitedState.map), {
        regions: debitedState.map.regions.map(
          (region) => region.id === validated.regionId ? applyValidatedFabricLink(region, validated) : region
        )
      })
    });
  }
  function clampMaintenanceStaff(maintenanceStaff) {
    return Math.max(0, Math.min(MAX_MAINTENANCE_STAFF, maintenanceStaff));
  }
  function setMaintenanceStaff(state, dcId, maintenanceStaff) {
    if (!Number.isFinite(maintenanceStaff) || !Number.isInteger(maintenanceStaff)) {
      throw new Error(`Invalid maintenance staff: ${maintenanceStaff}`);
    }
    const indexedState = createEntityIndexView(state);
    const datacenter = getDatacenter(indexedState.datacenterById, dcId);
    const nextMaintenanceStaff = clampMaintenanceStaff(maintenanceStaff);
    const delta = nextMaintenanceStaff - datacenter.maintenanceStaff;
    if (delta === 0) {
      return replaceDatacenter(state, __spreadProps(__spreadValues({}, datacenter), {
        maintenanceStaff: nextMaintenanceStaff
      }));
    }
    const region = getRegion(indexedState.regionById, datacenter.regionId);
    if (delta > 0 && region.staffUsed + delta > region.totalStaffAvailable) {
      throw new Error(`Insufficient staff available in region: ${region.id}`);
    }
    const updatedRegions = state.map.regions.map(
      (candidate) => candidate.id === region.id ? __spreadProps(__spreadValues({}, candidate), {
        staffUsed: candidate.staffUsed + delta
      }) : candidate
    );
    return __spreadProps(__spreadValues({}, replaceDatacenter(state, __spreadProps(__spreadValues({}, datacenter), {
      maintenanceStaff: nextMaintenanceStaff
    }))), {
      map: __spreadProps(__spreadValues({}, state.map), {
        regions: updatedRegions
      })
    });
  }
  function assertNever(value) {
    throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
  }
  function reduce(state, action) {
    var _a;
    switch (action.type) {
      case "BuildDatacenter":
        return buildDatacenter(state, action.specId, action.dcId, action.regionId);
      case "PlaceRack":
        return placeRack(state, action.dcId, action.specId, action.row, action.position, action.placementId);
      case "RemoveRack":
        return removeRack(state, action.dcId, action.placementId);
      case "MoveRack":
        return moveRack(state, action.dcId, action.placementId, action.targetDcId, action.row, action.position);
      case "AcceptContract":
        return acceptContract(state, action.contractId, action.dcId);
      case "CancelContract":
        return cancelContract(state, action.contractId);
      case "FabricLink":
        return linkRegionalFabric(state, action.sourceDcId, action.targetDcId);
      case "UpgradeDatacenter":
        return upgradeDatacenter(state, action.dcId, action.trackId, action.targetNodeId);
      case "SetMaintenanceStaff":
        return setMaintenanceStaff(state, action.dcId, action.maintenanceStaff);
      case "SetAudioEnabled":
        return __spreadProps(__spreadValues({}, state), {
          audioEnabled: action.enabled,
          audioSettings: __spreadProps(__spreadValues({}, state.audioSettings), { master: action.enabled })
        });
      case "UpdateAudioSettings":
        return __spreadProps(__spreadValues({}, state), {
          audioSettings: __spreadValues(__spreadValues({}, state.audioSettings), action.settings),
          audioEnabled: (_a = action.settings.master) != null ? _a : state.audioSettings.master
        });
      case "SetSpeed":
        return __spreadProps(__spreadValues({}, state), {
          game: __spreadProps(__spreadValues({}, state.game), { speed: action.speed, paused: action.speed === 0 })
        });
      case "SetPaused":
        return __spreadProps(__spreadValues({}, state), {
          game: __spreadProps(__spreadValues({}, state.game), { paused: action.paused })
        });
      case "Subtick":
        return advanceSubtick(state);
      case "Tick":
        return tick(state);
      default:
        return assertNever(action);
    }
  }

  // packages/game-logic/src/verification/leaderboard.ts
  var LEADERBOARD_VERIFICATION_ACTION_TYPES = [
    "BuildDatacenter",
    "PlaceRack",
    "RemoveRack",
    "MoveRack",
    "AcceptContract",
    "CancelContract",
    "FabricLink",
    "UpgradeDatacenter",
    "SetMaintenanceStaff",
    "Subtick",
    "Tick"
  ];
  function replayLeaderboardVerificationActions(initialState, actions) {
    const state = actions.reduce((currentState, action) => reduce(currentState, action), initialState);
    return {
      state,
      summary: summarizeLeaderboardFromState(state)
    };
  }

  // packages/game-logic/src/index.ts
  var VERSION = "0.1.0";

  // packages/server-go/jsbridge/entry.ts
  function canonicalJson(value) {
    return JSON.stringify(normalize(value));
  }
  function normalize(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Canonical JSON cannot encode non-finite numbers.");
      return value;
    }
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== "object") throw new Error(`Canonical JSON cannot encode values of type ${typeof value}.`);
    const entries = Object.entries(value).filter(([, v]) => v !== void 0).sort(([l], [r]) => l.localeCompare(r));
    return Object.fromEntries(entries.map(([k, v]) => [k, normalize(v)]));
  }
  globalThis.DT = {
    version: VERSION,
    metricKeys: LEADERBOARD_METRIC_KEYS,
    actionTypes: LEADERBOARD_VERIFICATION_ACTION_TYPES,
    canonicalJson: (json) => canonicalJson(JSON.parse(json)),
    genesis: (descJson) => JSON.stringify(createVerifiedGenesisState(JSON.parse(descJson))),
    // Returns {ok:true,state,summary} or {ok:false,message}; message mirrors the TS server's
    // `error instanceof Error ? error.message : "Verified run replay failed."`.
    replay: (stateJson, actionsJson) => {
      try {
        const r = replayLeaderboardVerificationActions(JSON.parse(stateJson), JSON.parse(actionsJson));
        return JSON.stringify({ ok: true, state: r.state, summary: r.summary });
      } catch (error) {
        return JSON.stringify({ ok: false, message: error instanceof Error ? error.message : "Verified run replay failed." });
      }
    },
    summarize: (stateJson) => JSON.stringify(summarizeLeaderboardFromState(JSON.parse(stateJson))),
    totalCapacity: (metricsJson) => totalLeaderboardCapacity(JSON.parse(metricsJson))
  };
})();
