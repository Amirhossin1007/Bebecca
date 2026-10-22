import { Star } from "lucide-react";
import { cn } from "lib/cn";
import { type FC, useEffect, useState } from "react";

export const GitHubStars: FC = () => {
	const [stars, setStars] = useState<number | null>(null);

	useEffect(() => {
		fetch("https://api.github.com/repos/rebeccapanel/Rebecca")
			.then((res) => res.json())
			.then((data) => {
				if (data.stargazers_count) {
					setStars(data.stargazers_count);
				}
			})
			.catch(() => {
				// Silently fail if API is unavailable
			});
	}, []);

	const handleClick = () => {
		window.open(
			"https://github.com/rebeccapanel/Rebecca",
			"_blank",
			"noopener,noreferrer",
		);
	};

	return (
		<button type="button" onClick={handleClick} aria-label="GitHub Stars" className="h-[34px] px-2.5 rounded-full bg-transparent text-panel-text-secondary inline-flex items-center gap-2 cursor-pointer [transition:background_0.15s_ease,_color_0.15s_ease,_transform_0.15s_ease] hover:bg-panel-elevated hover:text-panel-text hover:[transform:translateY(-1px)] active:[transform:translateY(0)] focus-visible:shadow-[0_0_0_2px_var(--rb-panel-accent)] focus-visible:outline-none">
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
			>
				<title>GitHub</title>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
				/>
			</svg>
			<Star style={{ width: "13px", height: "13px", color: "#f5b301" }} />
			<p className={cn("text-[0.75rem] font-semibold [font-variant-numeric:tabular-nums] leading-[1]", stars !== null ? "text-panel-text" : "text-panel-text-muted")}>
				{stars !== null
					? stars > 1000
						? `${(stars / 1000).toFixed(1)}k`
						: stars
					: "..."}
			</p>
		</button>
	);
};
