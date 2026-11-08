import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export const ExpandedDetails = ({ children }: { children: ReactNode }) => (
	<Box className="rb-resource-details" data-density="compact">
		{children}
	</Box>
);

export const ExpandedHeading = ({
	title,
	first,
}: {
	title: ReactNode;
	first?: boolean;
}) => (
	<Text
		gridColumn="1 / -1"
		fontSize="xs"
		fontWeight="semibold"
		color="panel.textSecondary"
		pt={first ? 0 : 3}
		pb={1}
	>
		{title}
	</Text>
);

export const ExpandedMeta = ({
	label,
	value,
}: {
	label: ReactNode;
	value: ReactNode;
}) => (
	<Box className="rb-resource-meta" minW={0}>
		<Text as="span" color="panel.textMuted">
			{label}
		</Text>
		<Box className="rb-resource-meta-value" color="panel.text">
			{value}
		</Box>
	</Box>
);
