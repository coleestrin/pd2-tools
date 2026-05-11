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
  Title,
  Text,
  Box,
} from "@mantine/core";
import { BUILD_PRESETS, PRESET_MIN_LEVEL, isPresetActive } from "../../lib/buildPresets";
import type { UiState } from "../../lib/url-state";
import skillPrereqsRaw from "../../data/skill-prereqs.json";

// PD2 wiki icon helper — same pattern as the PD2 FilterForm.
function skillIconUrl(name: string): string {
  const slug = name.replace(/ /g, "_");
  return `https://wiki.projectdiablo2.com/wiki/Special:FilePath/${encodeURIComponent(slug)}.png`;
}

function SkillIcon({ name }: { name: string }) {
  return (
    <img
      src={skillIconUrl(name)}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
      style={{
        width: 20,
        height: 20,
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    />
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

  // Derive the available skill names from the static prereq data.
  // Order: keys as they appear in the JSON (alphabetical from the scraper).
  const skillNames = useMemo<string[]>(() => {
    if (!s.filter.className) return [];
    const classMap = SKILL_PREREQS[s.filter.className];
    return classMap ? Object.keys(classMap) : [];
  }, [s.filter.className]);

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
      <Stack gap="lg">
        {/* Mode toggle */}
        <Tabs
          value={s.mode}
          onChange={(v) => v && setS({ ...s, mode: v as "guide" | "diff" })}
        >
          <Tabs.List>
            <Tabs.Tab value="guide">Build a guide</Tabs.Tab>
            <Tabs.Tab value="diff">Diff my character</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Diff character name — only visible in diff mode */}
        {s.mode === "diff" && (
          <TextInput
            placeholder="Character name or account name"
            value={s.diffName}
            onChange={(e) => setS({ ...s, diffName: e.currentTarget.value })}
          />
        )}

        {/* Game mode pills */}
        <Stack gap="xs">
          <Title order={6}>Game mode</Title>
          <Group gap="xs" wrap="wrap">
            {(["hardcore", "softcore"] as const).map((gm) => (
              <Button
                key={gm}
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
        <Stack gap="xs">
          <Title order={6}>Class</Title>
          <Group gap="xs" wrap="wrap">
            {CLASSES.map((c) => (
              <Button
                key={c}
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
          <Stack gap="xs">
            <Title order={6}>Build preset</Title>
            <Group gap="xs" wrap="wrap">
              {BUILD_PRESETS[s.filter.className].map((preset) => {
                const active = isPresetActive(
                  s.skills.map((sk) => sk.name),
                  preset,
                );
                return (
                  <Button
                    key={preset.name}
                    size="xs"
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
        <Stack gap="xs">
          <Title order={6}>
            Min character level:{" "}
            <Text span fw={700} component="span">
              {s.filter.minLevel ?? 80}
            </Text>
          </Title>
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
        <Stack gap="xs">
          <Title order={6}>Skills</Title>

          {/* Selected skill chips with level input */}
          {s.skills.length > 0 && (
            <Group gap="xs" wrap="wrap">
              {s.skills.map((sk) => (
                <Group key={sk.name} gap={4} align="center">
                  <Pill
                    withRemoveButton
                    onRemove={() => toggleSkill(sk.name)}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <SkillIcon name={sk.name} />
                    {sk.name}
                  </Pill>
                  <Text size="sm" component="span">
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
                    style={{ width: 56 }}
                  />
                </Group>
              ))}
            </Group>
          )}

          {/* Scrollable available skill list */}
          {skillNames.length > 0 ? (
            <ScrollArea h={240} type="auto">
              <Stack gap={2}>
                {skillNames.map((name) => (
                  <Button
                    key={name}
                    variant={selectedSkillNames.has(name) ? "filled" : "subtle"}
                    justify="flex-start"
                    leftSection={<SkillIcon name={name} />}
                    onClick={() => toggleSkill(name)}
                    fullWidth
                  >
                    {name}
                  </Button>
                ))}
              </Stack>
            </ScrollArea>
          ) : (
            s.filter.className ? (
              <Text c="dimmed" size="sm">
                No skills for {s.filter.className} in the prereq data.
              </Text>
            ) : (
              <Text c="dimmed" size="sm">
                Select a class to choose skills.
              </Text>
            )
          )}
        </Stack>

        <Button onClick={() => onSubmit(s)} size="lg">
          Generate guide
        </Button>
      </Stack>
    </Box>
  );
}
