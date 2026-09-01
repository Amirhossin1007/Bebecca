import { describe, expect, it } from "vitest";
import { getHostFormFields } from "./hostFormFields";

describe("getHostFormFields", () => {
	it("shows only fields supported by the selected inbound", () => {
		expect(getHostFormFields("WS", "tls", "none", "vless")).toEqual({
			supportsStreamSecurity: true,
			showsRequestHost: true,
			showsRequestPath: true,
			showsSNI: true,
			showsALPN: true,
			showsFingerprint: true,
			showsCertificateVerification: true,
			usesTLS: true,
		});
		expect(getHostFormFields("grpc", "reality", "none", "trojan")).toEqual({
			supportsStreamSecurity: true,
			showsRequestHost: true,
			showsRequestPath: true,
			showsSNI: true,
			showsALPN: false,
			showsFingerprint: true,
			showsCertificateVerification: false,
			usesTLS: false,
		});
		expect(getHostFormFields("tcp", "none", "none", "shadowsocks")).toEqual({
			supportsStreamSecurity: true,
			showsRequestHost: false,
			showsRequestPath: false,
			showsSNI: false,
			showsALPN: false,
			showsFingerprint: false,
			showsCertificateVerification: false,
			usesTLS: false,
		});
		expect(
			getHostFormFields("raw", "none", "http", "vmess").showsRequestHost,
		).toBe(true);
		expect(getHostFormFields("tcp", "tls", "none", "wireguard")).toMatchObject({
			supportsStreamSecurity: false,
			showsSNI: false,
			showsFingerprint: false,
		});
	});
});
