import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Grid,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { charactersAPI } from "../../api";
import { diffCharacter, type CharacterDiff } from "../../lib/diff";
import type { IMetaResponse, Slot } from "../../types";
import { ItemTooltip, type ItemData } from "../builds/shared/ItemHelpers";

interface Props {
  characterName: string;
  meta: IMetaResponse;
  className: string;
  gameMode?: string;
}

const SLOT_ORDER: Slot[] = [
  "weapon",
  "offhand",
  "helm",
  "armor",
  "gloves",
  "belt",
  "boots",
  "amulet",
  "ring",
];

export function DiffView({ characterName, meta, gameMode = "softcore" }: Props) {
  const [diff, setDiff] = useState<CharacterDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [itemsData, setItemsData] = useState<Map<string, ItemData>>(new Map());

  useEffect(() => {
    fetch("/items.json")
      .then((r) => r.json())
      .then((items: ItemData[]) => {
        const m = new Map<string, ItemData>();
        for (const it of items) m.set(it.gearId.name, it);
        setItemsData(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!characterName) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiff(null);

    charactersAPI
      .getCharacter(characterName, gameMode)
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          setError(`Character "${characterName}" not found.`);
          return;
        }
        const result = diffCharacter(raw, meta);
        if (!result) {
          setError(`Character "${characterName}" has no data.`);
          return;
        }
        setDiff(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [characterName, meta, gameMode]);

  if (!characterName) return null;

  if (loading) {
    return (
      <Group justify="center" mt="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Looking up {characterName}…
        </Text>
      </Group>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Character not found" mt="md">
        {error}
      </Alert>
    );
  }

  if (!diff) return null;

  return (
    <Stack gap="md" mt="md">
      {/* Header */}
      <Paper withBorder p="sm" radius="sm">
        <Text size="sm">
          <Text component="span" c="dimmed" size="xs" fw={700} tt="uppercase" style={{ letterSpacing: "0.1em" }}>
            Diffing{" "}
          </Text>
          <Text component="span" fw={700}>
            {diff.characterName}
          </Text>
          <Text component="span" c="dimmed" size="sm">
            {" "}({diff.accountName})
          </Text>
          {", "}
          <Text component="span" fw={600}>
            L{diff.characterLevel}
          </Text>{" "}
          <Text component="span">{diff.className}</Text>
        </Text>
      </Paper>

      {/* Mercenary */}
      <Paper withBorder p="sm" radius="sm">
        <Group gap="xs">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: "0.1em" }}>
            Mercenary
          </Text>
          {diff.mercTypeMatchesPool === null ? (
            <Text size="sm" c="dimmed" fs="italic">
              No merc data
            </Text>
          ) : diff.mercTypeMatchesPool ? (
            <Group gap="xs">
              <Badge color="green" variant="light">match</Badge>
              <Text size="sm">{diff.userMercType}</Text>
              <Text size="xs" c="dimmed">(pool top: {diff.poolMercType})</Text>
            </Group>
          ) : (
            <Group gap="xs">
              <Badge color="red" variant="light">mismatch</Badge>
              <Text size="sm">{diff.userMercType ?? "(none)"}</Text>
              <Text size="xs" c="dimmed">pool top: {diff.poolMercType}</Text>
            </Group>
          )}
        </Group>
      </Paper>

      {/* Per-slot rows */}
      {SLOT_ORDER.map((slot) => {
        const s = diff.slots[slot];
        if (!s) return null;
        return (
          <Paper key={slot} withBorder p="sm" radius="sm">
            <Title order={6} mb="xs" tt="capitalize">
              {slot}
            </Title>

            <Grid gutter="sm" mb={s.poolTopAffixMods.length > 0 ? "xs" : 0}>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: "0.08em" }}>
                  Pool top
                </Text>
                <Text size="sm" fw={500}>
                  {s.poolTopItemName ? (
                    <ItemTooltip
                      itemData={itemsData.get(s.poolTopItemName)}
                      itemType={s.poolTopItemType ?? "Unique"}
                      itemName={s.poolTopItemName}
                    >
                      <span>{s.poolTopItemName}</span>
                    </ItemTooltip>
                  ) : (
                    <Text component="span" c="dimmed" fs="italic">
                      -
                    </Text>
                  )}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: "0.08em" }}>
                  You wear
                </Text>
                {s.userItemName ? (
                  <Group gap={6}>
                    <Text
                      size="sm"
                      fw={s.userMatchesPoolTop ? 700 : 400}
                      c={s.userMatchesPoolTop ? "green" : undefined}
                    >
                      <ItemTooltip
                        itemData={itemsData.get(s.userItemName)}
                        itemType={s.userItemQuality ?? "Unique"}
                        itemName={s.userItemName}
                      >
                        <span>{s.userItemName}</span>
                      </ItemTooltip>
                    </Text>
                    {s.userItemQuality && !s.userMatchesPoolTop && (
                      <Text size="xs" c="dimmed">
                        ({s.userItemQuality})
                      </Text>
                    )}
                    {s.userMatchesPoolTop && (
                      <Badge color="green" size="xs" variant="light">
                        match
                      </Badge>
                    )}
                  </Group>
                ) : (
                  <Text size="sm" c="dimmed" fs="italic">
                    (empty)
                  </Text>
                )}
              </Grid.Col>
            </Grid>

            {s.poolTopAffixMods.length > 0 && (
              <Box mt="xs" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
                <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: "0.08em" }} mb={4}>
                  Top {s.poolTopAffixMods.length} affix mods in pool
                </Text>
                <Stack gap={2}>
                  {s.poolTopAffixMods.map((m) => (
                    <Group key={m.modName} gap="xs">
                      <Text
                        size="xs"
                        c={m.userHas ? "green" : "red"}
                        fw={600}
                      >
                        {m.userHas ? "✓" : "✗"}
                      </Text>
                      <Text size="xs">{m.displayLabel}</Text>
                      <Text size="xs" c="dimmed">
                        ({(m.pct * 100).toFixed(0)}% of pool)
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Box>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
