import { IconAlarm, IconChevronDown, IconDownload } from "@tabler/icons-react";
import { GitHubStarsButton } from "../GitHubStarsButton";
import { DiscordOnlineButton } from "../DiscordOnlineButton";
import {
  Burger,
  Drawer,
  Group,
  rem,
  Stack,
  Title,
  Tooltip,
  UnstyledButton,
  Menu,
  Box,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import classes from "./HeaderSearch.module.css";
import { useLocation } from "react-router-dom";
import { useNavbarStats, useTerrorZone } from "../../../hooks";
import { SupportBanner } from "../Banner";
const links = [
  { link: "/builds", label: "Builds" },
  { link: "/meta", label: "Meta" },
  { link: "/economy/currency", label: "Economy" },
  {
    label: "Tools",
    subLinks: [
      {
        link: "/tools/character-export",
        label: (
          <span style={{ display: "flex", alignItems: "center" }}>
            <IconDownload
              style={{
                width: rem(16),
                height: rem(16),
                marginRight: rem(12),
              }}
            />
            Character Exporter
          </span>
        ),
      },
      {
        link: "/tools/corrupted-zone-tracker",
        label: (
          <span style={{ display: "flex", alignItems: "center" }}>
            <IconAlarm
              style={{
                width: rem(16),
                height: rem(16),
                marginRight: rem(12),
              }}
            />
            Corrupted Zones
          </span>
        ),
      },
    ],
  },
  { link: "/statistics", label: "Statistics" },
  { link: "/leaderboard", label: "Leaderboard" },
];

export function HeaderSearch() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();

  const {
    players: playersCount,
    serverOnline: isServerOnline,
    characters: charactersCount,
  } = useNavbarStats();
  const { currentZoneDisplay, nextFiveZones } = useTerrorZone();

  const terrorZoneTooltipContent = (
    <Stack gap="xs">
      {nextFiveZones.length > 0 ? (
        nextFiveZones.map((zoneInfo, index) => (
          <Group
            key={`${zoneInfo.zone}-${index}`}
            justify="space-between"
            wrap="nowrap"
          >
            <Text
              size="xs"
              style={{
                maxWidth: "180px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {zoneInfo.zone}
            </Text>
            <Text size="xs" style={{ flexShrink: 0, marginLeft: rem(8) }}>
              {zoneInfo.minutesUntil}
            </Text>
          </Group>
        ))
      ) : (
        <Text size="xs">Loading next zones...</Text>
      )}
    </Stack>
  );

  const items = links.map((link) => {
    const isActive =
      location.pathname === link.link ||
      (link.subLinks &&
        link.subLinks.some((sl) => location.pathname === sl.link));

    if (link.subLinks) {
      return (
        <Menu
          key={link.label as string}
          shadow="md"
          width={200}
          trigger="hover"
          openDelay={0}
          closeDelay={100}
        >
          <Menu.Target>
            <span
              className={`${classes.link} ${isActive ? classes.active : ""}`}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              {link.label}
              <IconChevronDown
                style={{ width: rem(15), height: rem(15), marginLeft: rem(5) }}
              />
            </span>
          </Menu.Target>
          <Menu.Dropdown>
            {link.subLinks.map((subLink) => {
              const isSubActive = location.pathname === subLink.link;
              const subLinkLabelKey =
                typeof subLink.label === "string"
                  ? subLink.label
                  : subLink.link;
              return (
                <Menu.Item
                  key={subLinkLabelKey}
                  component="a"
                  href={subLink.link}
                  className={isSubActive ? classes.activeDropdownItem : ""}
                >
                  {subLink.label}
                </Menu.Item>
              );
            })}
          </Menu.Dropdown>
        </Menu>
      );
    }

    return (
      <a
        key={link.label as string}
        href={link.link!}
        className={
          isActive ? `${classes.link} ${classes.active}` : classes.link
        }
      >
        {link.label}
      </a>
    );
  });

  const mobileItems = links.flatMap((link) => {
    const isActive =
      location.pathname === link.link ||
      (link.subLinks &&
        link.subLinks.some((sl) => location.pathname === sl.link));

    if (link.subLinks) {
      return [
        <UnstyledButton
          key={`mobile-${link.label as string}-header`}
          className={`${classes.mobileLink} ${classes.mobileDropdownHeader}`}
          style={{ fontWeight: "bold", color: "var(--mantine-color-dimmed)" }}
          onClick={(e) => e.preventDefault()}
        >
          {link.label}
        </UnstyledButton>,
        ...link.subLinks.map((subLink) => {
          const isSubActive = location.pathname === subLink.link;
          const subLinkLabelKey =
            typeof subLink.label === "string" ? subLink.label : subLink.link;
          return (
            <UnstyledButton
              key={`mobile-${subLinkLabelKey}`}
              component="a"
              href={subLink.link}
              className={
                isSubActive
                  ? `${classes.mobileLink} ${classes.activeMobileLink}`
                  : classes.mobileLink
              }
              style={{ paddingLeft: rem(20) }}
              onClick={close}
            >
              {subLink.label}
            </UnstyledButton>
          );
        }),
      ];
    }

    return (
      <UnstyledButton
        key={`mobile-${link.label as string}`}
        component="a"
        href={link.link!}
        className={
          isActive
            ? `${classes.mobileLink} ${classes.activeMobileLink}`
            : classes.mobileLink
        }
        onClick={close}
      >
        {link.label}
      </UnstyledButton>
    );
  });

  return (
    <>
      <SupportBanner />
      <Box
        visibleFrom="md"
        style={{
          backgroundColor: "#121212",
          color: "white",
          padding: `${rem(2)} ${rem(16)}`,
          height: "28px",
          display: "flex",
          alignItems: "center",
          borderBottom: `${rem(1)} solid #373A40`,
        }}
      >
        <Group
          justify="space-around"
          align="center"
          style={{ height: "100%", width: "100%" }}
        >
          <a
            href={"/statistics"}
            style={{ textDecoration: "none", color: "white" }}
          >
            <Group gap={0} align="center">
              <Text size="sm" c="white">
                Players in Game:{" "}
                <span style={{ fontWeight: 700 }}>
                  {playersCount !== null ? playersCount.toLocaleString() : "——"}
                </span>
              </Text>
              <span
                style={{
                  width: rem(8),
                  height: rem(8),
                  backgroundColor:
                    isServerOnline === null
                      ? "#adb5bd"
                      : isServerOnline
                        ? "#40C057"
                        : "#fa5252",
                  borderRadius: "50%",
                  display: "inline-block",
                  marginLeft: rem(6),
                }}
              ></span>
            </Group>
          </a>

          <Group gap={0} align="center" style={{ marginLeft: rem(18) }}>
            <Text size="sm" c="white">
              Server:{" "}
              <span
                style={{
                  fontWeight: 700,
                  color: isServerOnline === false ? "#fa5252" : "#40C057",
                }}
              >
                {isServerOnline === false ? "OFFLINE" : "ONLINE"}
              </span>
            </Text>
          </Group>

          <a
            href={"/tools/corrupted-zone-tracker"}
            style={{ textDecoration: "none", color: "white" }}
          >
            <Tooltip
              label={terrorZoneTooltipContent}
              withArrow
              position="bottom"
              transitionProps={{ transition: "pop", duration: 200 }}
              openDelay={200}
            >
              <Group gap={5} align="center" style={{ cursor: "default" }}>
                <Text size="sm" c="white">
                  Corrupted Zone:{" "}
                  <span style={{ fontWeight: 700, color: "#AE3EC9" }}>
                    {currentZoneDisplay.zone.length > 37
                      ? `${currentZoneDisplay.zone.slice(0, 37)}...`
                      : currentZoneDisplay.zone}
                  </span>{" "}
                  <span style={{ fontWeight: 400, color: "#A0A0A0" }}>
                    ({currentZoneDisplay.min})
                  </span>
                </Text>
              </Group>
            </Tooltip>
          </a>

          <Group gap={0} align="center">
            <Text size="sm" c="white">
              Characters Tracked:{" "}
              <span style={{ fontWeight: 700, color: "#FD7E14" }}>
                {charactersCount !== null
                  ? charactersCount.toLocaleString()
                  : "——"}
              </span>
            </Text>
          </Group>
        </Group>
      </Box>

      <header className={classes.header}>
        <div className={classes.inner}>
          <Group
            justify="space-between"
            style={{ width: "100%", position: "relative" }}
          >
            <Group>
              <a
                style={{ textDecoration: "none", color: "rgb(193, 194, 197)" }}
                key={"HomeTitle"}
                href={"/"}
              >
                <Title order={3}>pd2.tools</Title>
              </a>
            </Group>

            <Group
              gap={5}
              className={classes.links}
              visibleFrom="sm"
              justify="center"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              {items}
            </Group>

            <Group gap="xs">
              <Group gap="xs" visibleFrom="sm">
                <GitHubStarsButton username="coleestrin" repo="pd2-tools" />
                <DiscordOnlineButton
                  guildId="1311407302149931128"
                  inviteLink="https://discord.gg/TVTExqWRhK"
                />
              </Group>
              <Burger
                opened={opened}
                onClick={toggle}
                size="sm"
                hiddenFrom="sm"
              />
            </Group>
          </Group>
        </div>
      </header>

      <Drawer
        opened={opened}
        onClose={close}
        size="100%"
        padding="md"
        title={
          <Title order={4} c="dimmed" style={{ marginBottom: rem(10) }}>
            MENU
          </Title>
        }
        className={classes.drawer}
      >
        <Stack align="stretch" gap="sm" style={{ flexGrow: 1 }}>
          {mobileItems}
          <GitHubStarsButton
            username="coleestrin"
            repo="pd2-tools"
            mobile
            onClick={close}
          />
          <DiscordOnlineButton
            guildId="1311407302149931128"
            inviteLink="https://discord.gg/TVTExqWRhK"
            mobile
            onClick={close}
          />
        </Stack>
      </Drawer>
    </>
  );
}
