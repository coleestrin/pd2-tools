import { useEffect, useState } from "react";
import { Badge, Group } from "@mantine/core";

interface Props {
  cohortSize: number;
  fetchedAt: Date | null;
}

/**
 * Shows cohort size and how long ago the data was fetched. Ticks every 30s.
 */
export function DataFreshness({ cohortSize, fetchedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!fetchedAt) return null;

  const ageSec = Math.floor((now - fetchedAt.getTime()) / 1000);
  const ageLabel =
    ageSec < 60 ? `${ageSec}s ago` : `${Math.floor(ageSec / 60)}m ago`;

  return (
    <Group gap="xs">
      <Badge color="blue" variant="light">
        Cohort: {cohortSize.toLocaleString()}
      </Badge>
      <Badge color="gray" variant="light">
        Fetched: {ageLabel}
      </Badge>
    </Group>
  );
}
