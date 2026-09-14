import { fetch as apiFetch } from "./http";

export interface SponsorAsset {
	id: string;
	placement: "header" | "header_mobile" | "sidebar" | "sidebar_logo";
	image_url: string;
	target_url?: string;
	alt?: string;
	label?: string;
	valid_until: string;
}

export interface SponsorResponse {
	header: SponsorAsset[];
	header_mobile: SponsorAsset[];
	sidebar: SponsorAsset[];
	sidebar_logo: SponsorAsset[];
}

export const getSponsors = (): Promise<SponsorResponse> =>
	apiFetch("/sponsor");
