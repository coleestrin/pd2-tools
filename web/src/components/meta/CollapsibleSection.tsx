import { useState, type ReactNode } from "react";
import {
  Collapse,
  Group,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";

interface Props {
  title: string;
  /** Optional dim subtitle shown next to the title in the header bar. */
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Click-to-fold section: title bar with rotating chevron + bottom border.
 * Mirrors the pd2-aggregator Section component so the two tools feel the same.
 */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Stack gap="sm">
      <UnstyledButton
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "4px 0",
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="md" align="baseline" wrap="nowrap" style={{ minWidth: 0 }}>
            <Title order={4}>{title}</Title>
            {subtitle && (
              <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                {subtitle}
              </Text>
            )}
          </Group>
          <IconChevronDown
            size={20}
            stroke={2}
            style={{
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 150ms",
              color: "var(--mantine-color-dimmed)",
              flexShrink: 0,
            }}
            aria-hidden
          />
        </Group>
      </UnstyledButton>
      <Collapse in={open}>{children}</Collapse>
    </Stack>
  );
}
