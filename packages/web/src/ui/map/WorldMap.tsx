import type { Region, RegionId } from "@datacenter-tycoon/game-logic";
import styles from "./WorldMap.module.css";

interface WorldMapProps {
	regions: Region[];
	selectedRegionId: RegionId | null;
	onSelectRegion: (id: RegionId) => void;
}

/**
 * Interactive SVG world map with percentage-positioned region markers.
 *
 * The underlying SVG uses a 1000×500 viewBox.  Region `coordinates`
 * (0‑100 percentages) map directly to that space, so markers stay
 * geographically correct regardless of viewport size.
 */
export function WorldMap({
	regions,
	selectedRegionId,
	onSelectRegion,
}: WorldMapProps) {
	return (
		<div className={styles.container}>
			<svg
				viewBox="0 0 1000 500"
				className={styles.svg}
				preserveAspectRatio="xMidYMid meet"
				aria-label="World map"
			>
				{/* ── Grid ── */}
				<g className={styles.grid}>
					{Array.from({ length: 11 }, (_, i) => (
						<line
							key={`v${i}`}
							x1={i * 100}
							y1={0}
							x2={i * 100}
							y2={500}
						/>
					))}
					{Array.from({ length: 6 }, (_, i) => (
						<line
							key={`h${i}`}
							x1={0}
							y1={i * 100}
							x2={1000}
							y2={i * 100}
						/>
					))}
				</g>

				{/* ── Continents ── */}
				<g className={styles.continents}>
					{/* North America */}
					<path d="M 90,55 L 280,48 L 320,75 L 310,125 L 298,165 L 292,205 L 302,245 L 308,285 L 295,300 L 275,292 L 258,272 L 242,248 L 225,222 L 205,200 L 185,188 L 165,175 L 145,155 L 125,132 L 108,108 L 92,82 Z" />

					{/* Greenland */}
					<path d="M 318,38 L 365,32 L 382,48 L 372,70 L 345,76 L 325,62 Z" />

					{/* South America */}
					<path d="M 268,292 L 318,282 L 340,308 L 348,358 L 340,412 L 322,452 L 298,462 L 278,442 L 268,400 L 262,358 L 260,322 Z" />

					{/* Europe (incl. UK) */}
					<path d="M 410,58 L 520,52 L 548,68 L 542,98 L 530,122 L 522,145 L 510,158 L 492,162 L 472,158 L 452,148 L 438,132 L 428,112 L 422,88 L 415,70 L 408,82 L 402,78 L 408,66 Z" />

					{/* Africa */}
					<path d="M 438,152 L 535,148 L 558,168 L 552,208 L 546,252 L 552,302 L 556,352 L 548,395 L 532,425 L 508,435 L 482,420 L 465,382 L 454,338 L 446,292 L 442,248 L 438,205 L 436,172 Z" />

					{/* Madagascar */}
					<path d="M 562,378 L 580,375 L 586,395 L 580,412 L 566,408 L 560,392 Z" />

					{/* Asia */}
					<path d="M 538,58 L 652,48 L 765,55 L 858,72 L 898,95 L 906,128 L 890,162 L 868,188 L 838,210 L 798,225 L 758,232 L 718,228 L 678,222 L 638,212 L 598,202 L 565,186 L 548,162 L 540,132 L 535,102 L 532,78 Z" />

					{/* Southeast Asia / Indonesia */}
					<path d="M 720,220 L 775,218 L 815,235 L 835,258 L 842,282 L 828,298 L 808,308 L 788,302 L 772,288 L 758,270 L 745,252 L 732,235 Z" />

					{/* Middle East */}
					<path d="M 555,180 L 620,175 L 655,195 L 670,220 L 665,245 L 648,262 L 625,268 L 600,260 L 580,242 L 565,220 L 555,200 Z" />

					{/* Australia */}
					<path d="M 785,320 L 862,315 L 902,332 L 912,365 L 898,398 L 862,410 L 822,405 L 788,388 L 780,358 L 782,335 Z" />

					{/* New Guinea */}
					<path d="M 858,290 L 895,288 L 905,302 L 898,315 L 872,312 L 858,302 Z" />
				</g>

				{/* ── Decorative equator line ── */}
				<line
					x1={0}
					y1={250}
					x2={1000}
					y2={250}
					className={styles.equator}
				/>
			</svg>

			{/* ── Region markers overlay ── */}
			<div className={styles.overlay}>
				{regions.map((region) => {
					const isSelected = region.id === selectedRegionId;
					return (
						<button
							key={region.id}
							className={[
								styles.marker,
								isSelected ? styles.markerSelected : "",
							]
								.filter(Boolean)
								.join(" ")}
							style={{
								left: `${region.coordinates.x}%`,
								top: `${region.coordinates.y}%`,
							}}
							onClick={() => onSelectRegion(region.id)}
							title={`${region.name} — ${region.city} (${region.code})`}
							aria-pressed={isSelected}
						>
							<span className={styles.markerDot} />
							<span className={styles.markerLabel}>{region.code}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
