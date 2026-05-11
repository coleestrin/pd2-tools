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
import { IconX, IconInfoCircle } from "@tabler/icons-react";
import { BUILD_PRESETS, PRESET_MIN_LEVEL, isPresetActive } from "../../lib/buildPresets";
import type { UiState } from "../../lib/url-state";
import skillPrereqsRaw from "../../data/skill-prereqs.json";
import { useMetaData } from "../../hooks/useMetaData";

// PD2 wiki icon helper — same pattern as the PD2 FilterForm.
function skillIconUrl(name: string): string {
  const slug = name.replace(/ /g, "_");
  return `https://wiki.projectdiablo2.com/wiki/Special:FilePath/${encodeURIComponent(slug)}.png`;
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

// Section label — uppercase tracking matches the PD2 standalone vibe.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      size="xs"
      fw={700}
      c="dimmed"
      tt="uppercase"
      style={{ letterSpacing: "0.08em" }}
    >
      {children}
    </Text>
  );
}

type SkillPrereqEntry = { prereqs: string[]; receivesBonusesFrom: string[] };
type SkillPrereqsMap = Record<string, Record<string, SkillPrereqEntry>>;

const SKILL_PREREQS = skillPrereqsRaw as SkillPrereqsMap;

const CLASSES = [
  "Amazon",
  "Assassin",
  "Barbarian",
  "Druid",
  "Necromancer",
  "Paladin",
  "Sorceress",
];

interface Props {
  initial: UiState;
  onSubmit: (s: UiState) => void;
}

export function FilterForm({ initial, onSubmit }: Props) {
  const [s, setS] = useState<UiState>(initial);

  // Fetch class-only baseline skill usage so we can show "X% of all <Class>s
  // who use this skill in their build" next to each entry. minLevel=80 keeps
  // the cohort to end-game characters (matches the convention pd2.tools/builds
  // uses); 15-min Redis cache shared with the main fetch. The hook itself
  // guards on empty className so this is safe when no class is picked.
  const classOnlyMeta = useMetaData({
    gameMode: s.filter.gameMode,
    className: s.filter.className ?? "",
    minLevel: 80,
    skills: [],
  });

  // Merge: source of truth for "which skills are pickable" = prereq JSON.
  // Source of truth for "% of cohort with this as a focus skill" =
  // classOnlyMeta.skillUsage[].pctAtTwenty — characters with >= 20 hard
  // points (matches pd2.tools/builds' threshold; same numbers /builds shows).
  // Skills not in the response get pct=0.
  const skillRows = useMemo<{ name: string; pct: number }[]>(() => {
    if (!s.filter.className) return [];
    const classMap = SKILL_PREREQS[s.filter.className];
    if (!classMap) return [];
    const usage = classOnlyMeta.data?.skillUsage ?? [];
    const usagePct = new Map<string, number>();
    for (const u of usage) usagePct.set(u.name, u.pctAtTwenty);
    const rows = Object.keys(classMap).map((name) => ({
      name,
      pct: usagePct.get(name) ?? 0,
    }));
    rows.sort((a, b) => b.pct - a.pct);
    return rows;
  }, [s.filter.className, classOnlyMeta.data]);

  const selectedSkillNames = useMemo(
    () => new Set(s.skills.map((sk) => sk.name)),
    [s.skills],
  );

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
    <Box p="md" mb="lg" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-sm)" }}>
      <Stack gap="md">
        {/* Mode toggle */}
        <Tabs
          value={s.mode}
          onChange={(v) => v && setS({ ...s, mode: v as "guide" | "diff" })}
        >
          <Tabs.List>
            <Tabs.Tab value="guide" style={{ fontSize: 15, fontWeight: 600, padding: "10px 16px" }}>Build a guide</Tabs.Tab>
            <Tabs.Tab value="diff" style={{ fontSize: 15, fontWeight: 600, padding: "10px 16px" }}>Diff my character</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Diff character name — only visible in diff mode */}
        {s.mode === "diff" && (
          <TextInput
            placeholder="Character name or account name"
            value={s.diffName}
            onChange={(e) => setS({ ...s, diffName: e.currentTarget.value })}
            size="md"
          />
        )}

        {/* Game mode pills */}
        <Stack gap={6}>
          <SectionLabel>Game mode</SectionLabel>
          <Group gap="xs" wrap="wrap">
            {(["hardcore", "softcore"] as const).map((gm) => (
              <Button
                key={gm}
                size="md"
                fw={600}
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

        {/* Class selector */}
        <Stack gap={6}>
          <SectionLabel>Class</SectionLabel>
          <Group gap="xs" wrap="wrap">
            {CLASSES.map((c) => (
              <Button
                key={c}
                size="md"
                fw={600}
                variant={s.filter.className === c ? "filled" : "default"}
                onClick={() =>
                  setS({
                    ...s,
                    filter: { ...s.filter, className: c },
                    skills: [], // reset skills when switching class
                  })
                }
              >
                {c}
              </Button>
            ))}
          </Group>
        </Stack>

        {/* Build presets — conditional on class having presets */}
        {s.filter.className && BUILD_PRESETS[s.filter.className] && (
          <Stack gap={6}>
            <SectionLabel>Build preset</SectionLabel>
            <Group gap="xs" wrap="wrap">
              {BUILD_PRESETS[s.filter.className].map((preset) => {
                const active = isPresetActive(
                  s.skills.map((sk) => sk.name),
                  preset,
                );
                return (
                  <Button
                    key={preset.name}
                    size="sm"
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

        {/* Min character level slider */}
        <Stack gap={6}>
          <Group justify="space-between" align="baseline">
            <SectionLabel>Min character level</SectionLabel>
            <Text size="lg" fw={700} style={{ fontVariantNumeric: "tabular-nums" }}>
              {s.filter.minLevel ?? 80}
            </Text>
          </Group>
          <Slider
            min={1}
            max={99}
            value={s.filter.minLevel ?? 80}
            onChange={(v) =>
              setS({ ...s, filter: { ...s.filter, minLevel: v } })
            }
            label={(v) => `Level ${v}`}
            marks={[
              { value: 1, label: "1" },
              { value: 50, label: "50" },
              { value: 99, label: "99" },
            ]}
            mb="lg"
          />
        </Stack>

        {/* Skill picker */}
        <Stack gap={6}>
          <Group justify="space-between" align="center">
            <SectionLabel>Skills</SectionLabel>
            <Tooltip label="% of end-game (lvl 80+) characters of this class with 20+ hard points in the skill (same threshold pd2.tools/builds uses).">
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconInfoCircle size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Selected skill chips with level input */}
          {s.skills.length > 0 && (
            <Group gap="sm" wrap="wrap">
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

          {/* Scrollable available skill list — pd2.tools /builds SkillCard
              style: each row a top-bordered Paper so stacked rows form
              dividers, with a percentage fill bar behind the content. */}
          {skillRows.length > 0 ? (
            <ScrollArea h={460} type="auto" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
              <Stack gap={0}>
                {skillRows.map((sk, idx) => {
                  const isSelected = selectedSkillNames.has(sk.name);
                  return (
                    <Paper
                      key={sk.name}
                      withBorder
                      radius={0}
                      py="sm"
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
                          ? "rgba(0, 255, 0, 0.18)"
                          : undefined,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          bottom: 0,
                          width: `${Math.min(sk.pct, 100)}%`,
                          backgroundColor: isSelected
                            ? "rgba(0, 255, 0, 0.2)"
                            : "rgba(168, 85, 247, 0.35)",
                          zIndex: 0,
                        }}
                      />
                      <Flex
                        justify="space-between"
                        align="center"
                        style={{ position: "relative", zIndex: 1 }}
                      >
                        <Flex align="center" gap={12} style={{ minWidth: 0 }}>
                          <SkillIcon name={sk.name} size={32} />
                          <Text size="md" fw={500} lineClamp={1}>
                            {sk.name}
                          </Text>
                        </Flex>
                        {isSelected ? (
                          <ActionIcon
                            size="md"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSkill(sk.name);
                            }}
                          >
                            <IconX size={18} />
                          </ActionIcon>
                        ) : (
                          <Text
                            size="md"
                            fw={700}
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {sk.pct.toFixed(1)}%
                          </Text>
                        )}
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
          Generate guide
        </Button>
      </Stack>
    </Box>
  );
}
