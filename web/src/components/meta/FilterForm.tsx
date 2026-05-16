import { useMemo, useState } from "react";
import {
  Stack,
  Group,
  Tabs,
  Button,
  Pill,
  Slider,
  ScrollArea,
  NumberInput,
  TextInput,
  Text,
  Box,
  Paper,
  Flex,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { BUILD_PRESETS, PRESET_MIN_LEVEL, isPresetActive } from "../../lib/buildPresets";
import type { UiState } from "../../lib/url-state";
import skillClassificationRaw from "../../data/skill-classification.json";
import { useMetaData } from "../../hooks/useMetaData";

function skillIconUrl(name: string): string {
  return `/icons/${name.replaceAll(" ", "_")}.png`;
}

function SkillIcon({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <img
      src={skillIconUrl(name)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    />
  );
}

function SectionLabel({
  children,
  ta,
}: {
  children: React.ReactNode;
  ta?: "left" | "center" | "right";
}) {
  return (
    <Text
      size="xs"
      fw={700}
      c="dimmed"
      tt="uppercase"
      ta={ta}
      style={{ letterSpacing: "0.08em" }}
    >
      {children}
    </Text>
  );
}

const SKILLS_BY_CLASS = skillClassificationRaw as Record<string, Record<string, string>>;

const CLASSES = [
  "Amazon",
  "Assassin",
  "Barbarian",
  "Druid",
  "Necromancer",
  "Paladin",
  "Sorceress",
];

const CLASS_SHORT: Record<string, string> = {
  Amazon: "Ama",
  Assassin: "Assa",
  Barbarian: "Barb",
  Druid: "Druid",
  Necromancer: "Necro",
  Paladin: "Pala",
  Sorceress: "Sorc",
};
const CLASS_INITIAL: Record<string, string> = {
  Amazon: "A",
  Assassin: "A",
  Barbarian: "B",
  Druid: "D",
  Necromancer: "N",
  Paladin: "P",
  Sorceress: "S",
};

interface Props {
  initial: UiState;
  onSubmit: (s: UiState) => void;
}

export function FilterForm({ initial, onSubmit }: Props) {
  const [s, setS] = useState<UiState>(initial);

  const isNarrow = useMediaQuery("(max-width: 576px)");
  const isMedium = useMediaQuery("(max-width: 992px)");
  const classLabel = (c: string) =>
    isNarrow ? CLASS_INITIAL[c] : isMedium ? CLASS_SHORT[c] : c;

  const classOnlyMeta = useMetaData({
    gameMode: s.filter.gameMode,
    className: s.filter.className ?? "",
    minLevel: 80,
    skills: [],
  });

  const selectedSkillNames = useMemo(
    () => new Set(s.skills.map((sk) => sk.name)),
    [s.skills],
  );
  const skillRows = useMemo<{ name: string; pct: number }[]>(() => {
    if (!s.filter.className) return [];
    const classMap = SKILLS_BY_CLASS[s.filter.className];
    if (!classMap) return [];
    const usage = classOnlyMeta.data?.skillUsage ?? [];
    const usagePct = new Map<string, number>();
    for (const u of usage) usagePct.set(u.name, u.pctAtTwenty);
    const rows = Object.keys(classMap).map((name) => ({
      name,
      pct: usagePct.get(name) ?? 0,
    }));
    rows.sort((a, b) => {
      const aSel = selectedSkillNames.has(a.name);
      const bSel = selectedSkillNames.has(b.name);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return b.pct - a.pct;
    });
    return rows;
  }, [s.filter.className, classOnlyMeta.data, selectedSkillNames]);

  function toggleSkill(name: string) {
    if (selectedSkillNames.has(name)) {
      setS({ ...s, skills: s.skills.filter((sk) => sk.name !== name) });
    } else {
      setS({ ...s, skills: [...s.skills, { name, minLevel: 20 }] });
    }
  }

  function setSkillLevel(name: string, level: number) {
    setS({
      ...s,
      skills: s.skills.map((sk) =>
        sk.name === name ? { ...sk, minLevel: level } : sk,
      ),
    });
  }

  return (
    <Box
      p="lg"
      mb="lg"
      mx="auto"
      maw={1050}
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-sm)",
      }}
    >
      <Stack gap="md">
        <Tabs
          value={s.mode}
          onChange={(v) => v && setS({ ...s, mode: v as "guide" | "diff" })}
        >
          <Tabs.List justify="center">
            <Tabs.Tab value="guide" style={{ fontSize: 15, fontWeight: 600, padding: "10px 20px" }}>Build a guide</Tabs.Tab>
            <Tabs.Tab value="diff" style={{ fontSize: 15, fontWeight: 600, padding: "10px 20px" }}>Diff my character</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {s.mode === "diff" && (
          <TextInput
            placeholder="Character name or account name"
            value={s.diffName}
            onChange={(e) => setS({ ...s, diffName: e.currentTarget.value })}
            size="md"
          />
        )}

        <Stack gap={6}>
          <SectionLabel ta="center">Game mode</SectionLabel>
          <Group gap="sm" wrap="wrap" justify="center">
            {(["hardcore", "softcore"] as const).map((gm) => (
              <Button
                key={gm}
                size="md"
                fw={700}
                variant={s.filter.gameMode === gm ? "filled" : "default"}
                onClick={() =>
                  setS({ ...s, filter: { ...s.filter, gameMode: gm } })
                }
              >
                {gm.charAt(0).toUpperCase() + gm.slice(1)}
              </Button>
            ))}
          </Group>
        </Stack>

        <Stack gap={6}>
          <SectionLabel ta="center">Class</SectionLabel>
          <Group gap="xs" wrap="nowrap" justify="center">
            {CLASSES.map((c) => (
              <Button
                key={c}
                size="sm"
                fw={700}
                variant={s.filter.className === c ? "filled" : "default"}
                aria-label={c}
                title={c}
                onClick={() =>
                  setS({
                    ...s,
                    filter: { ...s.filter, className: c },
                    // Skills are class-scoped — drop selection when switching class.
            skills: [],
                  })
                }
              >
                {classLabel(c)}
              </Button>
            ))}
          </Group>
        </Stack>

        {s.filter.className && BUILD_PRESETS[s.filter.className] && (
          <Stack gap={6}>
            <SectionLabel ta="center">Build preset</SectionLabel>
            <Group gap="xs" wrap="wrap" justify="center">
              {BUILD_PRESETS[s.filter.className].map((preset) => {
                const active = isPresetActive(
                  s.skills.map((sk) => sk.name),
                  preset,
                );
                return (
                  <Button
                    key={preset.name}
                    size="xs"
                    fw={600}
                    variant={active ? "filled" : "default"}
                    onClick={() =>
                      setS({
                        ...s,
                        skills: preset.skills.map((name) => ({
                          name,
                          minLevel: PRESET_MIN_LEVEL,
                        })),
                      })
                    }
                  >
                    {preset.name}
                  </Button>
                );
              })}
            </Group>
          </Stack>
        )}

        <Stack gap={6}>
          <Group justify="space-between" align="baseline">
            <SectionLabel>Min character level</SectionLabel>
            <Text size="lg" fw={700} style={{ fontVariantNumeric: "tabular-nums" }}>
              {s.filter.minLevel ?? 80}
            </Text>
          </Group>
          <Slider
            min={80}
            max={99}
            value={s.filter.minLevel ?? 80}
            onChange={(v) =>
              setS({ ...s, filter: { ...s.filter, minLevel: v } })
            }
            label={(v) => `Level ${v}`}
            marks={[
              { value: 80, label: "80" },
              { value: 90, label: "90" },
              { value: 99, label: "99" },
            ]}
            mb="lg"
          />
        </Stack>

        <Stack gap={6}>
          <Group justify="center" align="center" gap={6}>
            <SectionLabel>Skills</SectionLabel>
            <Tooltip label="% of end-game (lvl 80+) characters of this class with 20+ hard points in the skill (same threshold pd2.tools/builds uses).">
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconInfoCircle size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {s.skills.length > 0 && (
            <Group gap="sm" wrap="wrap" justify="center">
              {s.skills.map((sk) => (
                <Group key={sk.name} gap={6} align="center">
                  <Pill
                    withRemoveButton
                    onRemove={() => toggleSkill(sk.name)}
                    size="lg"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                  >
                    <SkillIcon name={sk.name} size={24} />
                    {sk.name}
                  </Pill>
                  <Text size="md" fw={600} component="span">
                    ≥
                  </Text>
                  <NumberInput
                    value={sk.minLevel}
                    onChange={(v) =>
                      setSkillLevel(sk.name, typeof v === "number" ? v : 1)
                    }
                    min={1}
                    max={30}
                    hideControls
                    size="md"
                    styles={{ input: { width: 56, textAlign: "center", fontWeight: 600 } }}
                  />
                </Group>
              ))}
            </Group>
          )}

          {skillRows.length > 0 ? (
            <ScrollArea h={220} type="auto" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
              <Stack gap={0}>
                {skillRows.map((sk, idx) => {
                  const isSelected = selectedSkillNames.has(sk.name);
                  return (
                    <Paper
                      key={sk.name}
                      withBorder
                      radius={0}
                      py={4}
                      px="md"
                      onClick={() => toggleSkill(sk.name)}
                      style={{
                        cursor: "pointer",
                        borderLeft: "none",
                        borderRight: "none",
                        borderBottom: "none",
                        borderTop: idx === 0 ? "none" : undefined,
                        position: "relative",
                        overflow: "hidden",
                        backgroundColor: isSelected
                          ? "rgba(34, 139, 34, 0.55)"
                          : undefined,
                      }}
                    >
                      {!isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: `${Math.min(sk.pct, 100)}%`,
                            backgroundColor: "rgba(168, 85, 247, 0.35)",
                            zIndex: 0,
                          }}
                        />
                      )}
                      <Flex
                        justify="space-between"
                        align="center"
                        style={{ position: "relative", zIndex: 1 }}
                      >
                        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
                          <SkillIcon name={sk.name} size={28} />
                          <Text size="sm" fw={500} lineClamp={1}>
                            {sk.name}
                          </Text>
                        </Flex>
                        <Text
                          size="sm"
                          fw={700}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {sk.pct.toFixed(1)}%
                        </Text>
                      </Flex>
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea>
          ) : (
            s.filter.className ? (
              <Text c="dimmed" size="sm">
                {classOnlyMeta.isLoading
                  ? "Loading skills…"
                  : `No skills for ${s.filter.className} in the prereq data.`}
              </Text>
            ) : (
              <Text c="dimmed" size="sm">
                Select a class to choose skills.
              </Text>
            )
          )}
        </Stack>

        <Button onClick={() => onSubmit(s)} size="lg" fw={700} fullWidth>
          Generate
        </Button>
      </Stack>
    </Box>
  );
}
