export const UNRESTRICTED_MARKET_OFFER_SHARE_FLOOR = 0.34;
export const NON_GPU_MARKET_OFFER_SHARE_FLOOR = 0.34;

function minimumOffersForShare(offerTarget: number, shareFloor: number): number {
	return Math.max(1, Math.round(Math.max(0, offerTarget) * shareFloor));
}

export function minimumUnrestrictedMarketOffers(offerTarget: number): number {
	return minimumOffersForShare(offerTarget, UNRESTRICTED_MARKET_OFFER_SHARE_FLOOR);
}

export function minimumNonGpuMarketOffers(offerTarget: number): number {
	return minimumOffersForShare(offerTarget, NON_GPU_MARKET_OFFER_SHARE_FLOOR);
}
