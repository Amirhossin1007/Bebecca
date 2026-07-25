export type JsonDiffLine = {
	type: "context" | "remove" | "add";
	text: string;
	beforeLine?: number;
	afterLine?: number;
};

const jsonLines = (value: unknown) => {
	if (value === undefined) return [];
	const text = JSON.stringify(value, null, 2);
	return text ? text.split("\n") : [];
};

const appendLine = (
	output: JsonDiffLine[],
	type: JsonDiffLine["type"],
	text: string,
	beforeLine: number | undefined,
	afterLine: number | undefined,
) => output.push({ type, text, beforeLine, afterLine });

const appendChangedLines = (
	output: JsonDiffLine[],
	left: string[],
	right: string[],
	leftOffset: number,
	rightOffset: number,
) => {
	if (left.length * right.length > 60_000) {
		left.forEach((text, index) => {
			appendLine(output, "remove", text, leftOffset + index + 1, undefined);
		});
		right.forEach((text, index) => {
			appendLine(output, "add", text, undefined, rightOffset + index + 1);
		});
		return;
	}
	const table = Array.from(
		{ length: left.length + 1 },
		() => new Uint16Array(right.length + 1),
	);
	for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex--) {
		for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex--) {
			table[leftIndex][rightIndex] =
				left[leftIndex] === right[rightIndex]
					? table[leftIndex + 1][rightIndex + 1] + 1
					: Math.max(
							table[leftIndex + 1][rightIndex],
							table[leftIndex][rightIndex + 1],
						);
		}
	}
	let leftIndex = 0;
	let rightIndex = 0;
	while (leftIndex < left.length || rightIndex < right.length) {
		if (left[leftIndex] === right[rightIndex]) {
			appendLine(
				output,
				"context",
				left[leftIndex],
				leftOffset + leftIndex + 1,
				rightOffset + rightIndex + 1,
			);
			leftIndex++;
			rightIndex++;
		} else if (
			rightIndex === right.length ||
			(leftIndex < left.length &&
				table[leftIndex + 1][rightIndex] >= table[leftIndex][rightIndex + 1])
		) {
			appendLine(
				output,
				"remove",
				left[leftIndex],
				leftOffset + leftIndex + 1,
				undefined,
			);
			leftIndex++;
		} else {
			appendLine(
				output,
				"add",
				right[rightIndex],
				undefined,
				rightOffset + rightIndex + 1,
			);
			rightIndex++;
		}
	}
};

export const buildJsonDiff = (
	before: unknown,
	after: unknown,
): JsonDiffLine[] => {
	const left = jsonLines(before);
	const right = jsonLines(after);
	let prefix = 0;
	while (
		prefix < left.length &&
		prefix < right.length &&
		left[prefix] === right[prefix]
	) {
		prefix++;
	}
	let suffix = 0;
	while (
		suffix < left.length - prefix &&
		suffix < right.length - prefix &&
		left[left.length - suffix - 1] === right[right.length - suffix - 1]
	) {
		suffix++;
	}

	const output: JsonDiffLine[] = [];
	for (let index = 0; index < prefix; index++) {
		appendLine(output, "context", left[index], index + 1, index + 1);
	}
	appendChangedLines(
		output,
		left.slice(prefix, left.length - suffix),
		right.slice(prefix, right.length - suffix),
		prefix,
		prefix,
	);
	for (let index = suffix; index > 0; index--) {
		const leftIndex = left.length - index;
		const rightIndex = right.length - index;
		appendLine(
			output,
			"context",
			left[leftIndex],
			leftIndex + 1,
			rightIndex + 1,
		);
	}
	return output;
};
