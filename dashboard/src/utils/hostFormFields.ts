const HOST_TRANSPORTS = new Set([
	"ws",
	"websocket",
	"http",
	"h2",
	"grpc",
	"httpupgrade",
	"xhttp",
	"splithttp",
	"kcp",
	"quic",
]);
const STREAM_SECURITY_PROTOCOLS = new Set([
	"vmess",
	"vless",
	"trojan",
	"shadowsocks",
	"hysteria",
]);

export const getHostFormFields = (
	network?: string,
	security?: string,
	headerType?: string,
	protocol?: string,
) => {
	const transport = network?.trim().toLowerCase() ?? "";
	const securityMode = security?.trim().toLowerCase() ?? "";
	const supportsStreamSecurity = STREAM_SECURITY_PROTOCOLS.has(
		protocol?.trim().toLowerCase() ?? "",
	);
	const rawHTTP =
		(transport === "tcp" || transport === "raw") &&
		headerType?.trim().toLowerCase() === "http";
	const showsRequestFields =
		supportsStreamSecurity && (HOST_TRANSPORTS.has(transport) || rawHTTP);
	const usesTLS = supportsStreamSecurity && securityMode === "tls";
	const usesReality = supportsStreamSecurity && securityMode === "reality";
	return {
		supportsStreamSecurity,
		showsRequestHost: showsRequestFields,
		showsRequestPath: showsRequestFields,
		showsSNI: usesTLS || usesReality,
		showsALPN: usesTLS,
		showsFingerprint: usesTLS || usesReality,
		showsCertificateVerification: usesTLS,
		usesTLS,
	};
};
