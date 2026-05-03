import type { Datacenter, DatacenterSpec, Region } from "../types.js";

export function regionPowerUsed(regionId: string, datacenters: Datacenter[]): number {
	return datacenters
		.filter((dc) => dc.regionId === regionId)
		.reduce((total, dc) => total + dc.spec.powerCapacityKw, 0);
}

export function regionStaffUsed(regionId: string, datacenters: Datacenter[]): number {
	return datacenters
		.filter((dc) => dc.regionId === regionId)
		.reduce((total, dc) => total + dc.spec.staffCount, 0);
}

export function canBuildInRegion(
	region: Region,
	spec: DatacenterSpec,
	datacenters: Datacenter[],
): boolean {
	const powerNeeded = regionPowerUsed(region.id, datacenters) + spec.powerCapacityKw;
	const staffNeeded = regionStaffUsed(region.id, datacenters) + spec.staffCount;
	return powerNeeded <= region.totalPowerAvailable && staffNeeded <= region.totalStaffAvailable;
}
