import {
	Alert,
	AlertDescription,
	AlertIcon,
	Box,
	Button,
	Card,
	CardBody,
	chakra,
	FormControl,
	FormErrorMessage,
	FormLabel,
	HStack,
	IconButton,
	Input as CInput,
	InputGroup,
	InputLeftElement,
	InputRightElement,
	Text,
	useColorMode,
	useColorModeValue,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowRightOnRectangleIcon,
	CheckIcon,
	EyeIcon,
	EyeSlashIcon,
	LockClosedIcon,
	UserIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import logoUrl from "assets/logo.svg";
import { Language } from "components/Language";
import ThemeSelector from "components/ThemeSelector";
import { AnimatePresence, motion } from "framer-motion";
import { type FC, type ReactNode, useEffect, useState } from "react";
import {
	type FieldErrors,
	useForm,
	type UseFormRegisterReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { fetch } from "service/http";
import { setAuthToken } from "utils/authStorage";
import { clearClientSession } from "utils/session";
import { z } from "zod";

const schema = z.object({
	username: z.string().min(1, "login.fieldRequired"),
	password: z.string().min(1, "login.fieldRequired"),
});

const ERROR_RESET_DELAY = 850;
const SUCCESS_REDIRECT_DELAY = 950;

export const LogoIcon = chakra("img", {
	baseStyle: {
		w: 12,
		h: 12,
	},
});

const LoginIcon = chakra(ArrowRightOnRectangleIcon, {
	baseStyle: {
		w: 5,
		h: 5,
		strokeWidth: "2px",
	},
});

const Eye = chakra(EyeIcon, { baseStyle: { w: 4, h: 4 } });
const EyeSlash = chakra(EyeSlashIcon, { baseStyle: { w: 4, h: 4 } });
const User = chakra(UserIcon, { baseStyle: { w: 5, h: 5, strokeWidth: "1.8px" } });
const Lock = chakra(LockClosedIcon, {
	baseStyle: { w: 5, h: 5, strokeWidth: "1.8px" },
});
const Check = chakra(CheckIcon, {
	baseStyle: { w: 6, h: 6, strokeWidth: "2.4px" },
});
const XMark = chakra(XMarkIcon, {
	baseStyle: { w: 6, h: 6, strokeWidth: "2.4px" },
});

type LoginFormValues = {
	username: string;
	password: string;
};

type SubmitStatus = "idle" | "loading" | "success" | "error";

type LoginFieldProps = {
	autoComplete: string;
	dir: "ltr" | "rtl";
	endElement?: ReactNode;
	errorMessage?: string;
	forceInvalid?: boolean;
	icon: ReactNode;
	label: string;
	placeholder: string;
	registration: UseFormRegisterReturn;
	shakeKey: number;
	type?: string;
};

const wait = (delay: number) =>
	new Promise((resolve) => window.setTimeout(resolve, delay));

const LoginField: FC<LoginFieldProps> = ({
	autoComplete,
	dir,
	endElement,
	errorMessage,
	forceInvalid = false,
	icon,
	label,
	placeholder,
	registration,
	shakeKey,
	type = "text",
}) => {
	const isRTL = dir === "rtl";
	const isInvalid = Boolean(errorMessage) || forceInvalid;
	const inputBg = useColorModeValue("whiteAlpha.900", "whiteAlpha.50");
	const borderColor = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
	const hoverBorderColor = useColorModeValue("primary.300", "primary.300");
	const focusBorderColor = useColorModeValue("primary.400", "primary.300");
	const iconColor = useColorModeValue("gray.500", "gray.400");
	const errorIconColor = useColorModeValue("red.500", "red.300");
	const shadowColor = useColorModeValue(
		"0 14px 30px rgba(21, 35, 74, 0.08)",
		"0 16px 34px rgba(0, 0, 0, 0.22)",
	);
	const invalidShadow = useColorModeValue(
		"0 0 0 1px rgba(229, 62, 62, 0.34)",
		"0 0 0 1px rgba(252, 129, 129, 0.36)",
	);

	return (
		<motion.div
			animate={
				shakeKey
					? { x: [0, isRTL ? 5 : -5, isRTL ? -5 : 5, isRTL ? 3 : -3, 0] }
					: { x: 0 }
			}
			style={{ width: "100%" }}
			transition={{ duration: 0.34, ease: "easeInOut" }}
		>
			<FormControl isInvalid={isInvalid}>
				<FormLabel color={isInvalid ? errorIconColor : undefined}>
					{label}
				</FormLabel>
				<InputGroup dir={dir}>
					<InputLeftElement
						color={isInvalid ? errorIconColor : iconColor}
						h="52px"
						pointerEvents="none"
					>
						{icon}
					</InputLeftElement>
					<CInput
						{...registration}
						autoComplete={autoComplete}
						bg={inputBg}
						borderColor={isInvalid ? "red.300" : borderColor}
						borderRadius="8px"
						boxShadow={isInvalid ? invalidShadow : shadowColor}
						fontSize="sm"
						h="52px"
						pe={endElement ? "3rem" : "1rem"}
						placeholder={placeholder}
						ps="3rem"
						type={type}
						_hover={{
							borderColor: isInvalid ? "red.400" : hoverBorderColor,
						}}
						_focusVisible={{
							borderColor: isInvalid ? "red.400" : focusBorderColor,
							boxShadow: isInvalid
								? invalidShadow
								: `0 0 0 1px var(--chakra-colors-${focusBorderColor.replace(".", "-")})`,
						}}
					/>
					{endElement && (
						<InputRightElement h="52px" color={iconColor}>
							{endElement}
						</InputRightElement>
					)}
				</InputGroup>
				<FormErrorMessage>{errorMessage}</FormErrorMessage>
			</FormControl>
		</motion.div>
	);
};

export const Login: FC = () => {
	const [error, setError] = useState("");
	const [invalidSubmit, setInvalidSubmit] = useState(false);
	const [shakeKey, setShakeKey] = useState(0);
	const [showPassword, setShowPassword] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === "fa";
	const dir = isRTL ? "rtl" : "ltr";
	const { colorMode } = useColorMode();
	const location = useLocation();
	const pageBg = useColorModeValue(
		"linear-gradient(135deg, #f7fafc 0%, #eefdf4 52%, #fff5f5 100%)",
		"linear-gradient(135deg, #090f1d 0%, #112420 50%, #261923 100%)",
	);
	const cardBg = useColorModeValue(
		"rgba(255, 255, 255, 0.86)",
		"rgba(23, 35, 61, 0.9)",
	);
	const cardBorder = useColorModeValue("whiteAlpha.900", "whiteAlpha.200");
	const subtleTextColor = useColorModeValue("gray.600", "gray.400");
	const logoTileBg = useColorModeValue("gray.950", "whiteAlpha.200");
	const logoTileBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.300");
	const logoTileShadow = useColorModeValue(
		"0 14px 28px rgba(14, 23, 48, 0.22)",
		"0 14px 28px rgba(0, 0, 0, 0.28)",
	);
	const {
		register,
		formState: { errors },
		handleSubmit,
		watch,
	} = useForm<LoginFormValues>({
		resolver: zodResolver(schema),
	});
	const usernameValue = watch("username") || "";
	const passwordValue = watch("password") || "";
	const hasAuthError = Boolean(error);
	const hasFieldFailure = hasAuthError || invalidSubmit;
	const canSubmit =
		Boolean(usernameValue.trim().length) &&
		Boolean(passwordValue.trim().length);
	const isFeedbackState = submitStatus !== "idle";
	const buttonIsCompact =
		submitStatus === "loading" || submitStatus === "error";
	const buttonTargetWidth =
		submitStatus === "success" ? 210 : buttonIsCompact ? 52 : "100%";
	const buttonBg =
		submitStatus === "success"
			? "green.500"
			: submitStatus === "error"
				? "red.500"
				: "primary.500";
	const buttonHoverBg =
		submitStatus === "success"
			? "green.500"
			: submitStatus === "error"
				? "red.500"
				: "primary.600";

	useEffect(() => {
		clearClientSession();
		if (location.pathname !== "/login") {
			navigate("/login", { replace: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [location.pathname, navigate]);

	useEffect(() => {
		if (error || invalidSubmit) {
			setError("");
			setInvalidSubmit(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [usernameValue, passwordValue]);

	const showFailureFeedback = async () => {
		setShakeKey((current) => current + 1);
		setSubmitStatus("error");
		await wait(ERROR_RESET_DELAY);
		setSubmitStatus((current) => (current === "error" ? "idle" : current));
	};

	const login = async (values: LoginFormValues) => {
		if (isFeedbackState) return;
		setError("");
		setInvalidSubmit(false);
		setSubmitStatus("loading");
		const formData = new URLSearchParams();
		formData.set("username", values.username);
		formData.set("password", values.password);
		formData.set("grant_type", "password");

		try {
			const { access_token: token } = await fetch<{ access_token: string }>(
				"/admin/token",
				{
					method: "post",
					body: formData,
					headers: {
						"content-type": "application/x-www-form-urlencoded",
					},
				},
			);
			clearClientSession();
			setAuthToken(token);
			setSubmitStatus("success");
			await wait(SUCCESS_REDIRECT_DELAY);
			navigate("/");
		} catch (err: any) {
			setError(err.response?._data?.detail || "Login failed");
			await showFailureFeedback();
		}
	};

	const handleInvalid = async (_errors: FieldErrors<LoginFormValues>) => {
		if (isFeedbackState) return;
		setInvalidSubmit(true);
		await showFailureFeedback();
	};

	const passwordToggle = (
		<IconButton
			aria-label={
				showPassword
					? t("admins.hidePassword", "Hide")
					: t("admins.showPassword", "Show")
			}
			color={hasFieldFailure || errors.password ? "red.400" : undefined}
			icon={showPassword ? <EyeSlash /> : <Eye />}
			onClick={() => setShowPassword((visible) => !visible)}
			onMouseDown={(event) => event.preventDefault()}
			size="sm"
			variant="ghost"
		/>
	);

	const renderButtonContent = () => {
		if (submitStatus === "loading") {
			return (
				<Box
					aria-hidden
					border="2px solid"
					borderColor="whiteAlpha.600"
					borderTopColor="white"
					className="animate-spin"
					h="22px"
					rounded="full"
					w="22px"
				/>
			);
		}
		if (submitStatus === "success") {
			return (
				<HStack spacing={2}>
					<Check color="white" />
					<Text as="span" fontWeight="800">
						{t("login.welcome")}
					</Text>
				</HStack>
			);
		}
		if (submitStatus === "error") {
			return <XMark color="white" />;
		}
		return (
			<HStack spacing={2}>
				<LoginIcon />
				<Text as="span" fontWeight="700">
					{t("login")}
				</Text>
			</HStack>
		);
	};

	return (
		<VStack
			bg={pageBg}
			justifyContent="center"
			minH="100vh"
			overflow="hidden"
			p={{ base: 4, md: 6 }}
			position="relative"
			w="full"
			_before={{
				content: '""',
				position: "absolute",
				inset: 0,
				backgroundImage:
					colorMode === "dark"
						? "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)"
						: "linear-gradient(rgba(35,54,96,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(35,54,96,0.055) 1px, transparent 1px)",
				backgroundSize: "44px 44px",
				maskImage:
					"linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 82%)",
				pointerEvents: "none",
			}}
		>
			<Card
				bg={cardBg}
				borderColor={cardBorder}
				borderRadius="8px"
				borderWidth="1px"
				boxShadow="0 24px 70px rgba(14, 23, 48, 0.18)"
				maxW="460px"
				overflow="visible"
				position="relative"
				sx={{ backdropFilter: "blur(18px)" }}
				w={{ base: "calc(100vw - 32px)", sm: "full" }}
				zIndex={1}
			>
				<CardBody p={{ base: 6, sm: 8 }}>
					<HStack justifyContent="space-between" mb={8} spacing={4}>
						<HStack spacing={3}>
							<Box
								alignItems="center"
								bg={logoTileBg}
								borderColor={logoTileBorder}
								borderRadius="8px"
								borderWidth="1px"
								boxShadow={logoTileShadow}
								display="inline-flex"
								h={12}
								justifyContent="center"
								p={2}
								w={12}
							>
								<LogoIcon
									alt={t("appName") || "Rebecca"}
									filter="brightness(0) invert(1)"
									h={8}
									src={logoUrl}
									w={8}
								/>
							</Box>
							<Text fontSize="lg" fontWeight="800">
								Rebecca
							</Text>
						</HStack>
						<HStack spacing={2}>
							<Language />
							<ThemeSelector minimal />
						</HStack>
					</HStack>

					<VStack
						alignItems="center"
						spacing={2}
						textAlign="center"
						w="full"
					>
						<Text fontSize={{ base: "2xl", sm: "3xl" }} fontWeight="800">
							{t("login.loginYourAccount")}
						</Text>
						<Text color={subtleTextColor} fontSize="sm">
							{t("login.welcomeBack")}
						</Text>
					</VStack>

					<Box pt={7} w="full">
						<form onSubmit={handleSubmit(login, handleInvalid)}>
							<VStack spacing={5}>
								<LoginField
									autoComplete="username"
									dir={dir}
									errorMessage={
										errors.username?.message
											? t(errors.username.message as string)
											: undefined
									}
									forceInvalid={hasFieldFailure}
									icon={<User />}
									label={t("username")}
									placeholder={t("username")}
									registration={register("username")}
									shakeKey={shakeKey}
								/>
								<LoginField
									autoComplete="current-password"
									dir={dir}
									endElement={passwordToggle}
									errorMessage={
										errors.password?.message
											? t(errors.password.message as string)
											: undefined
									}
									forceInvalid={hasFieldFailure}
									icon={<Lock />}
									label={t("password")}
									placeholder={t("password")}
									registration={register("password")}
									shakeKey={shakeKey}
									type={showPassword ? "text" : "password"}
								/>

								{error && (
									<Alert status="error" variant="left-accent">
										<AlertIcon />
										<AlertDescription>{error}</AlertDescription>
									</Alert>
								)}

								<Box
									display="flex"
									h="52px"
									justifyContent="center"
									pt={1}
									w="full"
								>
									<motion.div
										animate={{
											width: buttonTargetWidth,
										}}
										initial={false}
										style={{ display: "flex" }}
										transition={{
											type: "spring",
											stiffness: 280,
											damping: 24,
										}}
									>
										<Button
											aria-disabled={isFeedbackState || !canSubmit}
											bg={buttonBg}
											borderRadius={
												submitStatus === "idle" ? "8px" : "999px"
											}
											boxShadow={
												buttonIsCompact
													? "0 16px 30px rgba(14, 23, 48, 0.22)"
													: "0 14px 26px rgba(57, 111, 228, 0.25)"
											}
											color="white"
											cursor={
												!canSubmit && submitStatus === "idle"
													? "not-allowed"
													: "pointer"
											}
											h="52px"
											opacity={!canSubmit && submitStatus === "idle" ? 0.78 : 1}
											overflow="hidden"
											pointerEvents={isFeedbackState ? "none" : "auto"}
											px={
												submitStatus === "success"
													? 4
													: buttonIsCompact
														? 0
														: 5
											}
											type="submit"
											w="full"
											_hover={{ bg: buttonHoverBg }}
											_active={{
												transform:
													submitStatus === "idle" ? "translateY(1px)" : "none",
											}}
										>
											<AnimatePresence initial={false} mode="wait">
												<motion.span
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.88 }}
													initial={{ opacity: 0, scale: 0.88 }}
													key={submitStatus}
													style={{
														alignItems: "center",
														display: "inline-flex",
														justifyContent: "center",
													}}
													transition={{ duration: 0.18 }}
												>
													{renderButtonContent()}
												</motion.span>
											</AnimatePresence>
										</Button>
									</motion.div>
								</Box>
							</VStack>
						</form>
					</Box>
				</CardBody>
			</Card>
		</VStack>
	);
};

export default Login;
