const partNamePattern = /^(.+)\.part(\d+)-of-(\d+)(\.[^.]+)$/;

export type BackupPartName = {
	base: string;
	ext: string;
	index: number;
	total: number;
};

export type BackupPartCheck =
	| { status: "empty" }
	| { status: "single" }
	| { status: "complete"; total: number }
	| { status: "incomplete"; total: number; missing: number[] }
	| { status: "invalid" };

export const parseBackupPartName = (name: string): BackupPartName | null => {
	const match = partNamePattern.exec(name);
	if (!match) {
		return null;
	}
	const index = Number(match[2]);
	const total = Number(match[3]);
	if (index < 1 || total < 1 || index > total) {
		return null;
	}
	return { base: match[1], ext: match[4], index, total };
};

export const checkBackupParts = (names: string[]): BackupPartCheck => {
	if (names.length === 0) {
		return { status: "empty" };
	}
	const parts: BackupPartName[] = [];
	for (const name of names) {
		const part = parseBackupPartName(name);
		if (!part) {
			return names.length === 1 ? { status: "single" } : { status: "invalid" };
		}
		parts.push(part);
	}
	const first = parts[0];
	const seen = new Set<number>();
	for (const part of parts) {
		if (
			part.base !== first.base ||
			part.ext !== first.ext ||
			part.total !== first.total ||
			seen.has(part.index)
		) {
			return { status: "invalid" };
		}
		seen.add(part.index);
	}
	const missing: number[] = [];
	for (let index = 1; index <= first.total; index += 1) {
		if (!seen.has(index)) {
			missing.push(index);
		}
	}
	if (missing.length > 0) {
		return { status: "incomplete", total: first.total, missing };
	}
	return { status: "complete", total: first.total };
};
