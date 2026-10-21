import { Anchor, Box, Button, Card, Center, Text, rem } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { Outlet } from "react-router-dom";

export default function EconomyArchived() {
  return (
    <Box pos="relative">
      <Box
        {...{ inert: "" }}
        aria-hidden="true"
        style={{
          filter: "blur(4px)",
          opacity: 0.45,
          pointerEvents: "none",
        }}
      >
        <Outlet />
      </Box>

      <Center
        pos="absolute"
        top={0}
        left={0}
        right={0}
        h="min(100%, calc(100vh - 120px))"
        mih={320}
        p={rem(24)}
      >
        <Card withBorder shadow="md" padding="lg" maw={rem(520)} w="100%">
          <Text component="h1" fw={700} size="lg" mb="xs">
            Economy Tracker Archived
          </Text>
          <Text size="sm" mb="md">
            The pd2.tools economy tracker is no longer maintained. For price
            checks, we recommend PD2 Trader or community spreadsheets such as{" "}
            <Anchor
              href="https://docs.google.com/spreadsheets/d/1jfT0jGD3-CkuIjl8cAOgkTHUc4jEh9L2ni7QlbzinWw/htmlview#"
              target="_blank"
              rel="noopener noreferrer"
            >
              Lucky Luciano&apos;s List
            </Anchor>{" "}
            and{" "}
            <Anchor
              href="https://docs.google.com/spreadsheets/d/1-vKTxRlgTxat3_INgrwa3YVMC3A3yJSMZw3uvD8YBoo/edit?gid=1661381827#gid=1661381827"
              target="_blank"
              rel="noopener noreferrer"
            >
              BetweenWalls List
            </Anchor>
            .
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            <strong>A note from LAMP:</strong>
            <br />
            I&apos;m deprecating the economy tracker because I think generating
            accurate prices is tricky, particularly as the season progresses and
            listing volume constantly declines. I currently don&apos;t have the
            time to focus on this feature, so I&apos;d rather show no price than
            potentially mislead people with an inaccurate one. PD2 Trader is
            dedicated to price tracking, so I highly recommend them! Thank you for
            your understanding.
          </Text>
          <Button
            component="a"
            href="https://pd2trader.com/"
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<IconExternalLink size="1rem" />}
          >
            Open PD2 Trader
          </Button>
        </Card>
      </Center>
    </Box>
  );
}
