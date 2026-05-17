import { regionIdsForContractAffinity } from "../catalog/regions.js";
import type { ContractRegionAffinityKey, Datacenter, DatacenterSpec, Region, RegionId } from "../types.js";
import { datacenterBaseInfrastructure } from "./datacenter.js";

export function regionPowerUsed(regionId: string, datacenters: Datacenter[]): number {
	return datacenters
		.filter((dc) => dc.regionId === regionId)
		.reduce((total, dc) => total + datacenterBaseInfrastructure(dc.spec).gridImportCapacityKw, 0);
}

export function regionStaffUsed(regionId: string, datacenters: Datacenter[]): number {
	return datacenters
		.filter((dc) => dc.regionId === regionId)
		.reduce((total, dc) => total + dc.spec.staffCount + dc.maintenanceStaff, 0);
}

export function regionPowerRemaining(region: Region, datacenters: Datacenter[]): number {
	return Math.max(0, region.totalPowerAvailable - regionPowerUsed(region.id, datacenters));
}

export function regionStaffRemaining(region: Region, datacenters: Datacenter[]): number {
	return Math.max(0, region.totalStaffAvailable - regionStaffUsed(region.id, datacenters));
}

export function canBuildInRegion(
	region: Region,
	spec: DatacenterSpec,
	datacenters: Datacenter[],
): boolean {
	const powerNeeded = regionPowerUsed(region.id, datacenters) + datacenterBaseInfrastructure(spec).gridImportCapacityKw;
	const staffNeeded = regionStaffUsed(region.id, datacenters) + spec.staffCount;
	return powerNeeded <= region.totalPowerAvailable && staffNeeded <= region.totalStaffAvailable;
}

export function resolveContractAffinityAllowedRegionIds(
	regions: readonly Region[],
	affinityKey?: ContractRegionAffinityKey,
): RegionId[] {
	if (!affinityKey) {
		return regions.map((region) => region.id);
	}

	return regionIdsForContractAffinity(affinityKey, regions);
}
