import { useEffect, useState } from "react";
import { Badge, Group } from "@mantine/core";

interface Props {
  cohortSize: number;
  fetchedAt: Date | null;
}

export function DataFreshness({ cohortSize, fetchedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  // Reset `now` whenever new data arrives so the badge starts at "0s ago".
  // Without this, the lazy init captures a timestamp before fetchedAt fires
  // and the badge briefly shows a negative age.
  useEffect(() => {
    if (fetchedAt) setNow(Date.now());
  }, [fetchedAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!fetchedAt) return null;

  const ageSec = Math.max(0, Math.floor((now - fetchedAt.getTime()) / 1000));
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
