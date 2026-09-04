import { afterEach, describe, expect, it, vi } from "vitest";

import { importRebeccaBackup } from "./settings";

class UploadRequest {
	static current: UploadRequest;
	status = 200;
	response = {
		scope: "database",
		tables_restored: 1,
		rows_restored: 2,
		files_restored: [],
		warnings: [],
	};
	responseType = "";
	withCredentials = false;
	url = "";
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	upload = {
		onprogress: null as ((event: ProgressEvent) => void) | null,
		onload: null as (() => void) | null,
	};

	constructor() {
		UploadRequest.current = this;
	}

	open(_method: string, url: string) {
		this.url = url;
	}

	send() {
		this.upload.onprogress?.({
			lengthComputable: true,
			loaded: 5,
			total: 10,
		} as ProgressEvent);
		this.upload.onload?.();
		this.onload?.();
	}
}

describe("importRebeccaBackup", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("reports upload progress before resolving the restore response", async () => {
		vi.stubGlobal("XMLHttpRequest", UploadRequest);
		const progress: number[] = [];

		const result = await importRebeccaBackup(
			new File(["backup"], "test.rbbackup"),
			(percent) => progress.push(percent),
		);

		expect(progress).toEqual([0, 50, 100]);
		expect(UploadRequest.current.url).toBe("/api/settings/backup/import");
		expect(UploadRequest.current.withCredentials).toBe(true);
		expect(result.rows_restored).toBe(2);
	});
});
