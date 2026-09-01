export const getSwipeTargetIndex = (
	current: number,
	count: number,
	delta: number,
) =>
	delta > 0 ? (current - 1 + count) % count : (current + 1) % count;
