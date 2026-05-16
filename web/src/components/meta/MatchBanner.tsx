import { Title } from "@mantine/core";

interface Props {
  cohortSize: number;
  className: string;
}

export function MatchBanner({ cohortSize, className }: Props) {
  return (
    <Title order={4}>
      {cohortSize.toLocaleString()} {className} character
      {cohortSize === 1 ? "" : "s"} match this filter
    </Title>
  );
}
