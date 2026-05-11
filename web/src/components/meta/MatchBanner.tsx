import { Title } from "@mantine/core";

interface Props {
  cohortSize: number;
  className: string;
}

/**
 * Single-line header: "N Paladin characters match this filter".
 */
export function MatchBanner({ cohortSize, className }: Props) {
  return (
    <Title order={4}>
      {cohortSize.toLocaleString()} {className} character
      {cohortSize === 1 ? "" : "s"} match this filter
    </Title>
  );
}
