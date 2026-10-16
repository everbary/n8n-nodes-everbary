/**
 * eVerbary's published list prices, used only for the Quote > Get estimate.
 *
 * The REST API (v1) has no quote endpoint, so the estimate is computed from
 * the public rates. The order response always carries the exact total, with
 * any team discount, and that is the figure to rely on.
 *
 *  - $24.95 a certified page (up to 250 words) to or from English.
 *  - $34.95 a page when neither language is English.
 *  - Expedited adds 20% of the page total, Expedited Plus 40%.
 *  - Notarization is a flat $34.90.
 */
export const PRICE_PER_PAGE = 24.95;
export const NON_ENGLISH_PRICE_PER_PAGE = 34.95;
export const NOTARIZATION_PRICE = 34.9;
export const RUSH_SHARE = { standard: 0, expedited: 0.2, expeditedPlus: 0.4 } as const;

export type Turnaround = keyof typeof RUSH_SHARE;

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

export function pricePerPage(languageFrom: string, languageTo: string): number {
	const isEnglish = (language: string) => language.trim().toLowerCase() === 'english';
	return !isEnglish(languageFrom) && !isEnglish(languageTo)
		? NON_ENGLISH_PRICE_PER_PAGE
		: PRICE_PER_PAGE;
}

export function listPrice(
	languageFrom: string,
	languageTo: string,
	pages: number,
	turnaround: Turnaround,
	notarization: boolean,
) {
	const perPage = pricePerPage(languageFrom, languageTo);
	const pageTotal = perPage * pages;
	const rush = pageTotal * RUSH_SHARE[turnaround];
	const notary = notarization ? NOTARIZATION_PRICE : 0;
	return {
		pricePerPage: perPage,
		pageTotal: round2(pageTotal),
		rush: round2(rush),
		notarization: round2(notary),
		total: round2(pageTotal + rush + notary),
	};
}
