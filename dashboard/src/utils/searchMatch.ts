export type SearchMatchOptions = {
	matchCase: boolean;
	matchWholeWord: boolean;
};

export const DEFAULT_SEARCH_MATCH_OPTIONS: SearchMatchOptions = {
	matchCase: false,
	matchWholeWord: false,
};

const normalizeCase = (value: string, matchCase: boolean) =>
	matchCase ? value : value.toLocaleLowerCase();

const normalizeWords = (value: string) =>
	value
		.replace(/[^\p{L}\p{N}_]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");

export const matchesSearch = (
	value: unknown,
	query: string,
	options: SearchMatchOptions = DEFAULT_SEARCH_MATCH_OPTIONS,
): boolean => {
	const needle = query.trim();
	if (!needle) return true;
	const text = String(value ?? "");
	if (!options.matchWholeWord) {
		return normalizeCase(text, options.matchCase).includes(
			normalizeCase(needle, options.matchCase),
		);
	}
	const normalizedNeedle = normalizeWords(needle);
	if (!normalizedNeedle) return false;
	return normalizeCase(` ${normalizeWords(text)} `, options.matchCase).includes(
		normalizeCase(` ${normalizedNeedle} `, options.matchCase),
	);
};

export const matchesAnySearch = (
	values: unknown[],
	query: string,
	options: SearchMatchOptions = DEFAULT_SEARCH_MATCH_OPTIONS,
) =>
	!query.trim() || values.some((value) => matchesSearch(value, query, options));

export const addSearchMatchQuery = (
	params: URLSearchParams,
	options: SearchMatchOptions,
) => {
	if (options.matchCase) params.set("match_case", "true");
	if (options.matchWholeWord) params.set("match_whole_word", "true");
};
