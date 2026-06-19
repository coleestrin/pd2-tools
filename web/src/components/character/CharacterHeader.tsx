import {
  Button,
  Card,
  Image,
  Text,
  Title,
  Badge,
  Group,
  Anchor,
  Select,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
} from "@tabler/icons-react";
import { useSearchParams } from "react-router-dom";
import RelativeTime from "@yaireo/relative-time";
import RefreshButton from "./RefreshButton";
import type { CharacterHeaderProps } from "../../types";

const relativeTime = new RelativeTime();

export function CharacterHeader({
  characterName,
  className,
  level,
  lastUpdated,
  isMobile,
  prevCharacter,
  nextCharacter,
  accountName,
  isHardcore,
  season,
  snapshots = [],
  selectedSnapshot,
  onSnapshotChange,
}: CharacterHeaderProps) {
  const [searchParams] = useSearchParams();

  // Build URL params string (excluding nav) for back to search
  const getBackToSearchUrl = () => {
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key !== "nav") params.set(key, value);
    });
    const queryString = params.toString();
    return queryString ? `/builds?${queryString}` : "/builds";
  };

  // Build character URL with same params for prev/next navigation
  const getCharacterUrl = (charName: string) => {
    const queryString = searchParams.toString();
    return queryString
      ? `/builds/character/${encodeURIComponent(charName)}?${queryString}`
      : `/builds/character/${encodeURIComponent(charName)}`;
  };

  const handleNavClick = (targetName: string) => {
    const navId = searchParams.get("nav");
    if (!navId) return;

    const ctx = sessionStorage.getItem(`characterNavContext_${navId}`);
    if (ctx) {
      const parsed = JSON.parse(ctx);
      const newIndex = parsed.list.indexOf(targetName);
      if (newIndex !== -1) {
        parsed.currentIndex = newIndex;
        sessionStorage.setItem(
          `characterNavContext_${navId}`,
          JSON.stringify(parsed)
        );
      }
    }
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <a href={getBackToSearchUrl()} style={{ textDecoration: "none" }}>
          <Button variant="default" size="sm">
            Back to search
          </Button>
        </a>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginLeft: isMobile ? "0" : "16px",
          }}
        >
          <Button
            component="a"
            href={prevCharacter ? getCharacterUrl(prevCharacter) : undefined}
            onClick={() => prevCharacter && handleNavClick(prevCharacter)}
            variant="default"
            size="sm"
            disabled={!prevCharacter}
            leftSection={<IconChevronLeft size={16} />}
          >
            Previous
          </Button>

          <Button
            component="a"
            href={nextCharacter ? getCharacterUrl(nextCharacter) : undefined}
            onClick={() => nextCharacter && handleNavClick(nextCharacter)}
            variant="default"
            size="sm"
            disabled={!nextCharacter}
            rightSection={<IconChevronRight size={16} />}
          >
            Next
          </Button>
        </div>

        {!isMobile && snapshots.length > 0 && (
          <Select
            placeholder="View snapshot"
            value={selectedSnapshot}
            onChange={onSnapshotChange}
            data={[
              {
                value: "",
                label: "Latest snapshot",
              },
              ...snapshots.map((snapshot) => ({
                value: String(snapshot.snapshot_id),
                label: `${new Date(snapshot.snapshot_timestamp).toLocaleString()} - Level ${snapshot.level}`,
              })),
            ]}
            style={{ marginLeft: "auto", width: "250px" }}
            size="sm"
          />
        )}
      </div>

      <Card h="100px" w="100%" radius="md" shadow="md" p="md">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <Image src={`/${className}.webp`} width={64} height={64} />
            <div style={{ marginLeft: "16px" }}>
              <Title order={1}>{characterName}</Title>
              <Text size="md">
                Level {level} {className}
              </Text>
            </div>
          </div>
          {!isMobile && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: "0",
                  right: "0",
                  textAlign: "right",
                  marginTop: "6px",
                  marginRight: "6px",
                }}
              >
                <Group gap="xs" justify="flex-end">
                  {isHardcore !== undefined && (
                    <Badge
                      color={isHardcore ? "red" : "blue"}
                      variant="filled"
                      size="sm"
                    >
                      {isHardcore ? "Hardcore" : "Softcore"}
                    </Badge>
                  )}
                  {season && (
                    <Badge color="grape" variant="filled" size="sm">
                      Season {season}
                    </Badge>
                  )}
                </Group>
                {accountName && (
                  <Anchor
                    href={`/builds/account/${accountName}`}
                    size="xs"
                    target="_blank"
                    style={{ display: "block", marginTop: "4px" }}
                  >
                    Account: {accountName}
                  </Anchor>
                )}
                <Anchor
                  href={`https://projectdiablo2.com/character/${characterName}`}
                  target="_blank"
                  rel="noreferrer"
                  size="xs"
                  c="blue"
                  style={{ display: "block", marginTop: "4px" }}
                >
                  PD2 Armory{" "}
                  <IconExternalLink
                    size={12}
                    style={{
                      display: "inline",
                      position: "relative",
                      top: "2px",
                    }}
                  />
                </Anchor>
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0",
                  right: "0",
                  textAlign: "right",
                  marginBottom: "4px",
                  marginRight: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Text size="xs">
                  Last updated:{" "}
                  {lastUpdated
                    ? relativeTime.from(new Date(lastUpdated))
                    : "Unknown"}
                </Text>
                {!selectedSnapshot && (
                  <RefreshButton characterName={characterName} />
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </>
  );
}
