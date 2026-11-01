import { Star } from "lucide-react";
import { type FC, memo, useEffect, useState } from "react";

export const GitHubStars: FC = memo(() => {
	const [stars, setStars] = useState<number | null>(() => {
		try {
			const cached = localStorage.getItem("rb_github_stars");
			return cached ? Number(cached) : null;
		} catch {
			return null;
		}
	});

	useEffect(() => {
		fetch("https://api.github.com/repos/rebeccapanel/Rebecca")
			.then((res) => res.json())
			.then((data) => {
				if (typeof data.stargazers_count === "number") {
					setStars(data.stargazers_count);
					try {
						localStorage.setItem(
							"rb_github_stars",
							String(data.stargazers_count),
						);
					} catch {}
				}
			})
			.catch(() => {});
	}, []);

	const handleClick = () => {
		window.open(
			"https://github.com/rebeccapanel/Rebecca",
			"_blank",
			"noopener,noreferrer",
		);
	};

	const formattedStars =
		stars !== null
			? stars >= 1000
				? `${(stars / 1000).toFixed(1)}k`
				: String(stars)
			: null;

	return (
		<button
			type="button"
			onClick={handleClick}
			className="h-[34px] px-2 sm:px-2.5 rounded-[12px] bg-panel-surface border border-panel-border! text-panel-text inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs md:hover:bg-panel-elevated md:hover:border-panel-border-strong! active:scale-[0.98] transition-all"
			aria-label="GitHub Repository Stars"
		>
			<span className="w-4 h-4 grid place-items-center text-panel-text shrink-0">
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="currentColor"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<path
						fillRule="evenodd"
						clipRule="evenodd"
						d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
					/>
				</svg>
			</span>

			<span className="w-px h-3 bg-panel-border shrink-0" />

			<span className="flex items-center justify-center gap-1 shrink-0 h-4">
				<Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />
				{formattedStars ? (
					<span
						dir="ltr"
						style={{ unicodeBidi: "isolate" }}
						className="text-xs font-semibold leading-none text-panel-text tabular-nums inline-flex items-center"
					>
						{formattedStars}
					</span>
				) : null}
			</span>
		</button>
	);
});
