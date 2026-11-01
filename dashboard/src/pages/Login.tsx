import { Button } from "components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "components/ui/dropdown-menu";
import { LogIn, Check, Copy, CheckCheck, Eye, EyeOff, Lock, Moon, ShieldCheck, Sun, User } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useColorMode } from "lib/color-mode";
import logoUrl from "assets/logo.svg";
import { Language } from "components/Language";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "lib/cn";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
	type FieldErrors,
	useForm,
	type UseFormRegisterReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
	confirm2FASetup,
	getSession,
	login as createSession,
	logout,
	start2FASetup,
	type TOTPSetup,
	verify2FA,
} from "service/auth";
import { clearClientSession } from "utils/session";
import { updateThemeColor } from "utils/themeColor";
import { z } from "zod";

const schema = z.object({
	username: z.string().min(1, "login.fieldRequired"),
	password: z.string().min(1, "login.fieldRequired"),
});

const THEME_KEY = "rb-theme";
const CHAKRA_THEME_KEY = "chakra-ui-color-mode";
const CUSTOM_THEMES_KEY = "rb-custom-themes";

type LoginThemeMode = "dark" | "light";

type LoginFormValues = {
	username: string;
	password: string;
};

const applyLoginThemeMode = (theme: LoginThemeMode) => {
	try {
		localStorage.setItem(THEME_KEY, theme);
		localStorage.setItem(CHAKRA_THEME_KEY, theme);
		localStorage.removeItem(CUSTOM_THEMES_KEY);
	} catch {}

	const targets = [document.documentElement, document.body].filter(
		Boolean,
	) as HTMLElement[];
	targets.forEach((target) => {
		target.classList.remove(
			"rb-theme-light",
			"rb-theme-dark",
			"chakra-ui-light",
			"chakra-ui-dark",
		);
		target.classList.add(`rb-theme-${theme}`, `chakra-ui-${theme}`);
		target.dataset.theme = theme;
		target.style.colorScheme = theme;
	});
	updateThemeColor(theme);
};

type LoginFieldProps = {
	autoComplete: string;
	dir: "ltr" | "rtl";
	endElement?: ReactNode;
	errorMessage?: string;
	icon: ReactNode;
	id: string;
	label: string;
	placeholder: string;
	registration: UseFormRegisterReturn;
	type?: string;
};

function LoginField({
	autoComplete,
	dir,
	endElement,
	errorMessage,
	icon,
	id,
	label,
	placeholder,
	registration,
	type = "text",
}: LoginFieldProps) {
	const invalid = Boolean(errorMessage);

	return (
		<div className="space-y-1.5">
			<label htmlFor={id} className="block text-xs font-semibold text-panel-text tracking-[0.01em]">
				{label}
			</label>
			<div className="relative" dir={dir}>
				<span
					className={cn(
						"pointer-events-none absolute start-3 top-1/2 -translate-y-1/2",
						invalid ? "text-panel-danger" : "text-panel-text-muted",
					)}
				>
					{icon}
				</span>
				<input
					{...registration}
					id={id}
					autoComplete={autoComplete}
					aria-invalid={invalid || undefined}
					type={type}
					placeholder={placeholder}
					className={cn(
						"h-11 w-full rounded-[10px] border bg-panel-main ps-11 text-sm text-panel-text outline-none transition-[border-color,box-shadow] placeholder:text-panel-text-muted",
						endElement ? "pe-11" : "pe-3",
						invalid
							? "border-panel-danger focus-visible:border-panel-danger focus-visible:ring-1 focus-visible:ring-panel-danger/60"
							: "border-panel-border md:hover:border-panel-border-strong focus-visible:border-panel-accent focus-visible:ring-1 focus-visible:ring-panel-accent",
					)}
				/>
				{endElement ? (
					<span className="absolute end-1.5 top-1/2 -translate-y-1/2">
						{endElement}
					</span>
				) : null}
			</div>
			{errorMessage ? (
				<p role="alert" className="text-xs text-panel-danger mt-1 font-medium">
					{errorMessage}
				</p>
			) : null}
		</div>
	);
}

const LoginThemeMenu = () => {
	const { t } = useTranslation();
	const { colorMode, setColorMode } = useColorMode();
	const activeTheme: LoginThemeMode = colorMode === "light" ? "light" : "dark";

	const selectTheme = (theme: LoginThemeMode) => {
		applyLoginThemeMode(theme);
		setColorMode(theme);
	};

	const options: Array<{ key: LoginThemeMode; label: string; icon: ReactNode }> = [
		{ key: "dark", label: t("theme.dark"), icon: <Moon className="size-4" /> },
		{ key: "light", label: t("theme.light"), icon: <Sun className="size-4" /> },
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" aria-label={t("header.theme")} variant="ghost" size="icon" className="size-9 rounded-[10px] text-panel-text hover:bg-panel-elevated active:scale-95 transition-all">
					{activeTheme === "dark" ? (
						<Moon className="size-4" />
					) : (
						<Sun className="size-4" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="items-end min-w-40 rounded-[14px] border border-panel-border! bg-panel-surface text-panel-text shadow-xl backdrop-blur-md z-[9999] p-1.5">
				{options.map((option) => (
					<DropdownMenuItem key={option.key} onSelect={() => selectTheme(option.key)} className="rounded-[8px] cursor-pointer">
						{option.icon}
						<span className="flex-1">{option.label}</span>
						{activeTheme === option.key ? (
							<Check className="size-4 text-panel-accent" />
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export const Login = () => {
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [step, setStep] = useState<"credentials" | "otp" | "setup">("credentials");
	const [otp, setOTP] = useState("");
	const [setup, setSetup] = useState<TOTPSetup | null>(null);
	const [challengeLoading, setChallengeLoading] = useState(false);
	const [copiedSecret, setCopiedSecret] = useState(false);
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const dir = i18n.language === "fa" ? "rtl" : "ltr";

	const {
		register,
		formState: { errors, isSubmitting },
		handleSubmit,
		watch,
	} = useForm<LoginFormValues>({
		resolver: zodResolver(schema),
		defaultValues: { password: "", username: "" },
	});

	const usernameValue = watch("username") || "";
	const passwordValue = watch("password") || "";
	const canSubmit =
		Boolean(usernameValue.trim().length) &&
		Boolean(passwordValue.trim().length) &&
		!isSubmitting;

	useEffect(() => {
		void usernameValue;
		void passwordValue;
		setError((current) => (current ? "" : current));
	}, [usernameValue, passwordValue]);

	useEffect(() => {
		getSession()
			.then(async (session) => {
				if (session.state === "active") {
					navigate("/");
				} else if (session.state === "disabled") {
					navigate("/users");
				} else if (session.state === "pending_2fa") {
					setStep("otp");
				} else {
					setSetup(await start2FASetup());
					setStep("setup");
				}
			})
			.catch(() => undefined);
	}, [navigate]);

	const completeLogin = () => {
		clearClientSession();
		navigate("/");
	};

	const openRequiredSetup = async () => {
		setSetup(await start2FASetup());
		setStep("setup");
	};

	const login = async (values: LoginFormValues) => {
		setError("");
		try {
			const session = await createSession(values.username, values.password);
			if (session.state === "pending_2fa") {
				setStep("otp");
				setOTP("");
			} else if (session.state === "setup_required") {
				await openRequiredSetup();
			} else if (session.state === "disabled") {
				clearClientSession();
				navigate("/users");
			} else {
				completeLogin();
			}
		} catch (err: any) {
			setError(err.response?._data?.detail || "Login failed");
		}
	};

	const submitOTP = async () => {
		setError("");
		setChallengeLoading(true);
		try {
			await verify2FA(otp);
			completeLogin();
		} catch (err: any) {
			setError(err.response?._data?.detail || "Invalid authentication code");
		} finally {
			setChallengeLoading(false);
		}
	};

	const confirmSetup = async () => {
		setError("");
		setChallengeLoading(true);
		try {
			await confirm2FASetup(otp);
			completeLogin();
		} catch (err: any) {
			setError(err.response?._data?.detail || "Invalid authentication code");
		} finally {
			setChallengeLoading(false);
		}
	};

	const cancelChallenge = async () => {
		try {
			await logout();
		} finally {
			setStep("credentials");
			setOTP("");
			setSetup(null);
			setError("");
		}
	};

	const handleCopySecret = async () => {
		if (!setup?.secret) return;
		try {
			await navigator.clipboard.writeText(setup.secret);
			setCopiedSecret(true);
			setTimeout(() => setCopiedSecret(false), 2000);
		} catch {}
	};

	const handleInvalid = async (_errors: FieldErrors<LoginFormValues>) => {
		setError("");
	};

	const title =
		step === "credentials"
			? t("login.welcome")
			: step === "otp"
				? t("login.twoFactorTitle")
				: t("login.setupTwoFactorTitle");
	const subtitle =
		step === "credentials"
			? t("login.welcomeBack")
			: step === "otp"
				? t("login.twoFactorHint")
				: t("login.setupTwoFactorHint");

	return (
		<div className="flex min-h-[100dvh] w-full items-center justify-center bg-panel-main px-4 py-8 sm:px-6 sm:py-12">
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
				className="w-full max-w-[420px]"
			>
				<div className="rounded-[20px] border border-panel-border! bg-panel-surface p-6 sm:p-8 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.32)]">
					<div className="mb-6 flex items-center justify-between gap-3">
						<div className="flex min-w-0 items-center gap-3 text-panel-text">
							<span className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-[12px] border border-panel-border! bg-panel-elevated">
								<img
									alt={t("menu")}
									src={logoUrl}
									className="size-6 [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)]"
								/>
							</span>
							<div className="flex flex-col">
								<span className="truncate text-lg font-extrabold tracking-[-0.02em] leading-tight">Rebecca</span>
								<span className="text-[10px] font-medium text-panel-text-muted">Admin Panel</span>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-1.5">
							<Language triggerVariant="ghost" />
							<LoginThemeMenu />
						</div>
					</div>

					<div className="space-y-1 mb-6 text-start">
						<h1 className="text-lg font-bold text-panel-text tracking-[-0.01em]">{title}</h1>
						<p className="text-xs text-panel-text-muted leading-relaxed">{subtitle}</p>
					</div>

					<div>
						<AnimatePresence initial={false} mode="wait">
							{step === "credentials" ? (
								<motion.div
									key="credentials-step"
									initial={{ opacity: 0, x: -12 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: 12 }}
									transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
									className="w-full"
								>
									<form onSubmit={handleSubmit(login, handleInvalid)}>
										<div className="space-y-4">
											<LoginField
												id="login-username"
												autoComplete="username"
												dir={dir}
												errorMessage={
													errors.username?.message
														? t(errors.username.message as string)
														: undefined
												}
												icon={<User className="size-4" />}
												label={t("username")}
												placeholder={t("username")}
												registration={register("username")}
											/>
											<LoginField
												id="login-password"
												autoComplete="current-password"
												dir={dir}
												endElement={
													<button
														type="button"
														aria-label={
															showPassword
																? t("admins.hidePassword")
																: t("admins.showPassword")
														}
														onMouseDown={(event) => event.preventDefault()}
														onClick={() => setShowPassword((visible) => !visible)}
														className="inline-flex size-8 items-center justify-center rounded-[8px] text-panel-text-muted transition-colors hover:text-panel-text hover:bg-panel-elevated active:scale-90"
													>
														{showPassword ? (
															<EyeOff className="size-4" />
														) : (
															<Eye className="size-4" />
														)}
													</button>
												}
												errorMessage={
													errors.password?.message
														? t(errors.password.message as string)
														: undefined
												}
												icon={<Lock className="size-4" />}
												label={t("password")}
												placeholder={t("password")}
												registration={register("password")}
												type={showPassword ? "text" : "password"}
											/>

											{error ? (
												<div
													role="alert"
													className="rounded-[10px] border border-panel-danger/30 bg-panel-danger/10 px-3.5 py-2.5 text-xs text-panel-danger font-medium"
												>
													{error}
												</div>
											) : null}

											<Button type="submit" disabled={!canSubmit || isSubmitting} className="mt-2 h-11 w-full rounded-[10px] text-sm font-semibold active:scale-[0.98] transition-transform">
												<LogIn className="size-4" />
												{isSubmitting ? t("login.loading") : t("login")}
											</Button>
										</div>
									</form>
								</motion.div>
							) : (
								<motion.div
									key="otp-step"
									initial={{ opacity: 0, x: 12 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -12 }}
									transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
									className="w-full space-y-4"
								>
									{step === "setup" && setup ? (
										<div className="flex flex-col items-center gap-3 w-full">
											<div className="w-fit rounded-[14px] bg-white p-3 shadow-md">
												<QRCodeCanvas value={setup.uri} size={168} />
											</div>
											<div className="flex items-center justify-between w-full px-3 py-2 rounded-[10px] border border-panel-border! bg-panel-elevated">
												<p className="break-all font-mono text-xs font-semibold text-panel-text tracking-wider truncate">
													{setup.secret}
												</p>
												<button
													type="button"
													aria-label={copiedSecret ? t("copied") : t("copy")}
													onClick={handleCopySecret}
													className="inline-flex size-7 items-center justify-center rounded-[6px] text-panel-text-muted hover:text-panel-text hover:bg-panel-surface transition-colors shrink-0"
												>
													{copiedSecret ? (
														<CheckCheck className="size-3.5 text-green-500" />
													) : (
														<Copy className="size-3.5" />
													)}
												</button>
											</div>
										</div>
									) : null}

									<div className="space-y-1.5">
										<label
											htmlFor="login-otp"
											className="block text-xs font-semibold text-panel-text tracking-[0.01em]"
										>
											{t("login.authenticationCode")}
										</label>
										<div className="relative" dir="ltr">
											<span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-panel-text-muted">
												<ShieldCheck className="size-4" />
											</span>
											<input
												id="login-otp"
												inputMode="numeric"
												autoComplete="one-time-code"
												maxLength={6}
												value={otp}
												onChange={(event) =>
													setOTP(event.target.value.replace(/\D/g, ""))
												}
												className="h-11 w-full rounded-[10px] border border-panel-border! bg-panel-main ps-10 text-center font-mono text-lg font-bold tracking-[0.32em] text-panel-text outline-none transition-[border-color,box-shadow] md:hover:border-panel-border-strong focus-visible:border-panel-accent focus-visible:ring-1 focus-visible:ring-panel-accent"
											/>
										</div>
									</div>

									{error ? (
										<div
											role="alert"
											className="rounded-[10px] border border-panel-danger/30 bg-panel-danger/10 px-3.5 py-2.5 text-xs text-panel-danger font-medium"
										>
											{error}
										</div>
									) : null}

									<Button onClick={step === "otp" ? submitOTP : confirmSetup} disabled={otp.length !== 6 || challengeLoading} className="h-11 w-full rounded-[10px] text-sm font-semibold active:scale-[0.98] transition-transform">
										{t("continue")}
									</Button>
									<Button onClick={cancelChallenge} variant="ghost" className="h-10 w-full rounded-[10px] text-sm text-panel-text-muted hover:text-panel-text hover:bg-panel-elevated active:scale-[0.98] transition-transform">
										{t("back")}
									</Button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</motion.div>
		</div>
	);
};

export default Login;
