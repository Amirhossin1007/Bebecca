import { describe, expect, it } from "vitest";
import { checkBackupParts, parseBackupPartName } from "./backupParts";

const partName = (index: number, total: number) =>
	`rebecca-database-20261019.part${String(index).padStart(2, "0")}-of-${String(total).padStart(2, "0")}.rbbackup`;

describe("checkBackupParts", () => {
	it("accepts a single backup file", () => {
		expect(checkBackupParts(["rebecca-database-20261019.rbbackup"])).toEqual({
			status: "single",
		});
	});

	it("accepts a complete set of parts in any order", () => {
		expect(
			checkBackupParts([partName(3, 3), partName(1, 3), partName(2, 3)]),
		).toEqual({ status: "complete", total: 3 });
	});

	it("reports the missing part numbers", () => {
		expect(checkBackupParts([partName(1, 3), partName(3, 3)])).toEqual({
			status: "incomplete",
			total: 3,
			missing: [2],
		});
	});

	it("rejects files from different backups or repeated parts", () => {
		expect(
			checkBackupParts([
				partName(1, 2),
				"rebecca-database-20261020.part02-of-02.rbbackup",
			]),
		).toEqual({ status: "invalid" });
		expect(checkBackupParts([partName(1, 2), partName(1, 2)])).toEqual({
			status: "invalid",
		});
	});

	it("rejects a part mixed with an unrelated file", () => {
		expect(
			checkBackupParts([partName(1, 2), "notes.txt"]),
		).toEqual({ status: "invalid" });
	});

	it("parses the Telegram part name format", () => {
		expect(parseBackupPartName(partName(2, 5))).toEqual({
			base: "rebecca-database-20261019",
			ext: ".rbbackup",
			index: 2,
			total: 5,
		});
	});
});
