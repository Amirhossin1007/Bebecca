import type { ReactNode } from "react";

export type StableCellRender<TContext> = (context: TContext) => ReactNode;

export const createStableCellRegistry = <TContext>() => {
	const renders = new Map<string, StableCellRender<TContext>>();
	const cells = new Map<string, StableCellRender<TContext>>();
	return (id: string, render: StableCellRender<TContext>) => {
		renders.set(id, render);
		let cell = cells.get(id);
		if (!cell) {
			cell = (context: TContext) => renders.get(id)?.(context) ?? null;
			cells.set(id, cell);
		}
		return cell;
	};
};
