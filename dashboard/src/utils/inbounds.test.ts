import { describe, expect, it } from "vitest";

import {
	buildInboundPayload,
	createDefaultInboundForm,
	getInboundTraffic,
	rawInboundToFormValues,
	type RawInbound,
	validateInboundFormFields,
} from "./inbounds";

describe("inbound traffic", () => {
	it("maps uplink to upload, downlink to download, and tolerates old responses", () => {
		const base = { tag: "in", port: 443, protocol: "vless", settings: {} };
		expect(
			getInboundTraffic({ ...base, uplink: 1024, downlink: 2048 }),
		).toEqual({
			upload: 1024,
			download: 2048,
			total: 3072,
		});
		expect(getInboundTraffic(base)).toEqual({
			upload: 0,
			download: 0,
			total: 0,
		});
	});
});

describe("inbound usage coefficient", () => {
	it("round-trips as panel metadata and defaults to one", () => {
		const raw: RawInbound = {
			tag: "weighted",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			usage_coefficient: 1.5,
		};
		const values = rawInboundToFormValues(raw);
		expect(values.usageCoefficient).toBe("1.5");
		expect(buildInboundPayload(values).usage_coefficient).toBe(1.5);
		expect(createDefaultInboundForm().usageCoefficient).toBe("1");
	});

	it("rejects coefficients outside the supported range", () => {
		const values = createDefaultInboundForm();
		values.usageCoefficient = "0";
		expect(validateInboundFormFields(values).usageCoefficient).toBeTruthy();
		values.usageCoefficient = "101";
		expect(validateInboundFormFields(values).usageCoefficient).toBeTruthy();
	});
});

describe("VLESS inbound default flow", () => {
	it("round-trips the supported inbound value and drops outbound-only values", () => {
		const raw: RawInbound = {
			tag: "vless-flow",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none", flow: "xtls-rprx-vision" },
			streamSettings: {
				network: "raw",
				security: "tls",
			},
		};

		const values = rawInboundToFormValues(raw);
		expect(values.vlessFlow).toBe("xtls-rprx-vision");
		expect(
			buildInboundPayload(values, { initial: raw }).settings,
		).toMatchObject({
			flow: "xtls-rprx-vision",
		});

		const invalid = rawInboundToFormValues({
			...raw,
			settings: {
				...raw.settings,
				flow: "xtls-rprx-vision-udp443",
			},
		});
		expect(invalid.vlessFlow).toBe("");
	});
});

describe("TLS cipher suites", () => {
	it("round-trips current TLS, sniffing, certificate, and sockopt fields", () => {
		const raw: RawInbound = {
			tag: "tls-current",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			sniffing: {
				enabled: true,
				destOverride: ["http", "tls"],
				ipsExcluded: ["geoip:private"],
				domainsExcluded: ["geosite:private"],
			},
			streamSettings: {
				network: "raw",
				security: "tls",
				tlsSettings: {
					curvePreferences: ["X25519MLKEM768", "X25519"],
					certificates: [
						{
							certificateFile: "/cert.pem",
							keyFile: "/key.pem",
							ocspStapling: 3600,
						},
					],
				},
				sockopt: {
					trustedXForwardedFor: ["X-Forwarded-For"],
					customSockopt: [{ level: "SOL_SOCKET", opt: "SO_KEEPALIVE" }],
				},
			},
		};

		const values = rawInboundToFormValues(raw);
		const payload = buildInboundPayload(values, { initial: raw });
		expect(payload.sniffing).toMatchObject({
			ipsExcluded: ["geoip:private"],
			domainsExcluded: ["geosite:private"],
		});
		expect(payload.streamSettings?.tlsSettings).toMatchObject({
			curvePreferences: ["X25519MLKEM768", "X25519"],
			certificates: [{ ocspStapling: 3600 }],
		});
		expect(payload.streamSettings?.sockopt).toMatchObject({
			trustedXForwardedFor: ["X-Forwarded-For"],
			customSockopt: [{ level: "SOL_SOCKET", opt: "SO_KEEPALIVE" }],
		});
	});

	it("round-trips peer name verification and certificate pins", () => {
		const pin = "ab".repeat(32);
		const values = rawInboundToFormValues({
			tag: "tls",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			streamSettings: {
				network: "raw",
				security: "tls",
				tlsSettings: {
					verifyPeerCertByName: "cert.example.com",
					pinnedPeerCertSha256: pin,
				},
			},
		});
		expect(values.tlsVerifyPeerCertByName).toBe("cert.example.com");
		expect(values.tlsPinnedPeerCertSha256).toBe(pin);
		expect(
			buildInboundPayload(values).streamSettings?.tlsSettings,
		).toMatchObject({
			verifyPeerCertByName: "cert.example.com",
			pinnedPeerCertSha256: pin,
		});
		values.tlsPinnedPeerCertSha256 = "bad";
		expect(
			validateInboundFormFields(values).tlsPinnedPeerCertSha256,
		).toBeTruthy();
	});

	it("preserves TLS 1.2 suites and requires native Go TLS", () => {
		const values = createDefaultInboundForm("vless");
		values.streamSecurity = "tls";
		values.tlsCipherSuites =
			"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256";
		expect(validateInboundFormFields(values).tlsFingerprint).toBeTruthy();
		values.tlsFingerprint = "unsafe";
		expect(validateInboundFormFields(values).tlsFingerprint).toBeUndefined();
		expect(
			buildInboundPayload(values).streamSettings?.tlsSettings?.cipherSuites,
		).toBe(values.tlsCipherSuites);
	});

	it("omits cipher suites for Hysteria QUIC", () => {
		const values = createDefaultInboundForm("hysteria");
		values.tlsCipherSuites = "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256";
		expect(
			buildInboundPayload(values).streamSettings?.tlsSettings,
		).not.toHaveProperty("cipherSuites");
	});
});

describe("XHTTP inbound settings", () => {
	it.each([
		["current", { sessionIDPlacement: "header", sessionIDKey: "X-Session" }],
		["legacy", { sessionPlacement: "header", sessionKey: "X-Session" }],
	])("round-trips %s session ID fields through the current schema", (_, session) => {
		const raw: RawInbound = {
			tag: "xhttp",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			streamSettings: {
				network: "xhttp",
				security: "none",
				xhttpSettings: {
					path: "/x",
					mode: "packet-up",
					...session,
					sessionIDTable: "base64",
					sessionIDLength: "16-16",
					xmux: {
						maxConcurrency: "16-32",
						maxConnections: "0",
						hKeepAlivePeriod: 30,
					},
					seqPlacement: "query",
					seqKey: "x_seq",
					uplinkHTTPMethod: "GET",
					uplinkDataPlacement: "header",
					uplinkDataKey: "X-Data",
					uplinkChunkSize: "3000-4000",
					serverMaxHeaderBytes: 8192,
				},
			},
		};

		const values = rawInboundToFormValues(raw);
		expect(values.xhttpSessionPlacement).toBe("header");
		expect(values.xhttpSessionKey).toBe("X-Session");

		const payload = buildInboundPayload(values, { initial: raw });
		const settings = payload.streamSettings?.xhttpSettings;
		expect(settings).toMatchObject({
			sessionIDPlacement: "header",
			sessionIDKey: "X-Session",
			sessionIDTable: "base64",
			sessionIDLength: "16-16",
			xmux: {
				maxConcurrency: "16-32",
				maxConnections: "0",
				hKeepAlivePeriod: 30,
			},
			seqPlacement: "query",
			seqKey: "x_seq",
			uplinkHTTPMethod: "GET",
			uplinkDataPlacement: "header",
			uplinkDataKey: "X-Data",
			uplinkChunkSize: "3000-4000",
			serverMaxHeaderBytes: 8192,
		});
		expect(settings).not.toHaveProperty("sessionPlacement");
		expect(settings).not.toHaveProperty("sessionKey");
	});

	it("round-trips WebSocket heartbeat and current mKCP tuning", () => {
		const ws = rawInboundToFormValues({
			tag: "ws",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			streamSettings: {
				network: "ws",
				security: "none",
				wsSettings: {
					path: "/ws",
					heartbeatPeriod: 30,
					acceptProxyProtocol: true,
				},
			},
		});
		expect(buildInboundPayload(ws).streamSettings?.wsSettings).toMatchObject({
			heartbeatPeriod: 30,
			acceptProxyProtocol: true,
		});

		const kcp = rawInboundToFormValues({
			tag: "kcp",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			streamSettings: {
				network: "kcp",
				security: "none",
				kcpSettings: {
					mtu: 1350,
					tti: 50,
					uplinkCapacity: 5,
					downlinkCapacity: 20,
					cwndMultiplier: 1,
					maxSendingWindow: 2097152,
					congestion: true,
					readBufferSize: 2,
					writeBufferSize: 2,
				},
			},
		});
		expect(buildInboundPayload(kcp).streamSettings?.kcpSettings).toMatchObject({
			mtu: 1350,
			tti: 50,
			uplinkCapacity: 5,
			downlinkCapacity: 20,
			cwndMultiplier: 1,
			maxSendingWindow: 2097152,
			congestion: true,
			readBufferSize: 2,
			writeBufferSize: 2,
		});
	});

	it("round-trips current gRPC and HTTPUpgrade transport fields", () => {
		const grpc = rawInboundToFormValues({
			tag: "grpc",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			streamSettings: {
				network: "grpc",
				security: "none",
				grpcSettings: {
					serviceName: "service",
					authority: "example.com",
					multiMode: true,
					idle_timeout: 60,
					health_check_timeout: 20,
					permit_without_stream: true,
					initial_windows_size: 65535,
					user_agent: "grpc-go/1.0",
				},
			},
		});
		expect(buildInboundPayload(grpc).streamSettings?.grpcSettings).toMatchObject({
			idle_timeout: 60,
			health_check_timeout: 20,
			permit_without_stream: true,
			initial_windows_size: 65535,
			user_agent: "grpc-go/1.0",
		});

		const upgrade = rawInboundToFormValues({
			tag: "upgrade",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			streamSettings: {
				network: "httpupgrade",
				security: "none",
				httpupgradeSettings: {
					path: "/upgrade",
					host: "example.com",
					headers: { X_Test: "value" },
					acceptProxyProtocol: true,
				},
			},
		});
		expect(
			buildInboundPayload(upgrade).streamSettings?.httpupgradeSettings,
		).toMatchObject({
			headers: { X_Test: "value" },
			acceptProxyProtocol: true,
		});
	});

	it("round-trips REALITY fallback limits using the current field names", () => {
		const raw: RawInbound = {
			tag: "reality",
			port: 443,
			protocol: "vless",
			settings: { decryption: "none" },
			streamSettings: {
				network: "raw",
				security: "reality",
				realitySettings: {
					maxTimediff: 1000,
					limitFallbackUpload: {
						afterBytes: 1024,
						bytesPerSec: 2048,
						burstBytesPerSec: 4096,
					},
					limitFallbackDownload: {
						afterBytes: 8192,
						bytesPerSec: 16384,
						burstBytesPerSec: 32768,
					},
				},
			},
		};

		const settings = buildInboundPayload(rawInboundToFormValues(raw), {
			initial: raw,
		}).streamSettings?.realitySettings;
		expect(settings).toMatchObject({
			maxTimeDiff: 1000,
			limitFallbackUpload: {
				afterBytes: 1024,
				bytesPerSec: 2048,
				burstBytesPerSec: 4096,
			},
			limitFallbackDownload: {
				afterBytes: 8192,
				bytesPerSec: 16384,
				burstBytesPerSec: 32768,
			},
		});
		expect(settings).not.toHaveProperty("maxTimediff");
	});

	it("rejects unsafe tokens, invalid mode combinations, and invalid ranges", () => {
		const values = createDefaultInboundForm("vless");
		Object.assign(values, {
			tag: "xhttp",
			streamNetwork: "xhttp",
			xhttpMode: "auto",
			xhttpUplinkHTTPMethod: "GET",
			xhttpSessionKey: "X-Session\r\nInjected",
			xhttpUplinkDataPlacement: "header",
			xhttpUplinkChunkSize: "4000-3000",
			xhttpServerMaxHeaderBytes: "-1",
			xhttpXmuxMaxConcurrency: "16-32",
			xhttpXmuxMaxConnections: "2",
			xhttpXmuxHKeepAlivePeriod: "-2",
		});

		const errors = validateInboundFormFields(values);
		expect(errors.xhttpUplinkHTTPMethod).toContain("packet-up");
		expect(errors.xhttpSessionKey).toContain("HTTP token");
		expect(errors.xhttpUplinkDataPlacement).toContain("packet-up");
		expect(errors.xhttpUplinkChunkSize).toContain("range start");
		expect(errors.xhttpServerMaxHeaderBytes).toContain("non-negative");
		expect(errors.xhttpXmuxMaxConnections).toContain("cannot be combined");
		expect(errors.xhttpXmuxHKeepAlivePeriod).toContain("between -1");
		values.xhttpXmuxMaxConnections = "0";
		values.xhttpXmuxHKeepAlivePeriod = "-1";
		const corrected = validateInboundFormFields(values);
		expect(corrected.xhttpXmuxMaxConnections).toBeUndefined();
		expect(corrected.xhttpXmuxHKeepAlivePeriod).toBeUndefined();
	});
});
