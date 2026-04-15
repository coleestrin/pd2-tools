import { useEffect, useState } from "react";
import {
  Box,
  Group,
  Text,
  CloseButton,
  Button,
  Title,
  Anchor,
} from "@mantine/core";
import { IconStar } from "@tabler/icons-react";
import { GitHubIcon } from "../../icons";
import { SEASON_STORAGE_KEY_SUFFIX } from "../../../types";

const PAGEVIEW_KEY = `pd2tools_pageviews_${SEASON_STORAGE_KEY_SUFFIX}`;
const DISMISSED_KEY = `pd2tools_banner_dismissed_at_${SEASON_STORAGE_KEY_SUFFIX}`;
const PAGEVIEW_THRESHOLD = 7;
const REAPPEAR_DAYS = 90;

export function SupportBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if dismissed and if 90 days have passed
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(parseInt(dismissedAt, 10));
      const now = new Date();
      const daysSinceDismissed =
        (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDismissed < REAPPEAR_DAYS) {
        return;
      }
      // 90 days passed - reset pageview counter for fresh start
      localStorage.removeItem(DISMISSED_KEY);
      localStorage.setItem(PAGEVIEW_KEY, "0");
    }

    // Increment pageview count
    const currentViews = parseInt(
      localStorage.getItem(PAGEVIEW_KEY) || "0",
      10
    );
    const newViews = currentViews + 1;
    localStorage.setItem(PAGEVIEW_KEY, newViews.toString());

    // Show banner if threshold met
    if (newViews >= PAGEVIEW_THRESHOLD) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <Box
      py="sm"
      px="md"
      style={{
        background:
          "linear-gradient(135deg, #FCD34D 0%, #FBBF24 50%, #F59E0B 100%)",
        borderBottom: "1px solid rgba(251, 191, 36, 0.6)",
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="sm" align="center" wrap="nowrap" style={{ flex: 1 }}>
          <IconStar
            size={28}
            fill="#000"
            color="#000"
            style={{ flexShrink: 0 }}
          />
          <Box>
            <Title order={6} mb={4} c="black">
              Enjoying pd2.tools?
            </Title>
            <Text size="sm" c="black">
              If you wanted to show your support, starring the{" "}
              <Anchor
                href="https://github.com/coleestrin/pd2-tools"
                target="_blank"
                rel="noopener noreferrer"
                c="black"
                fw={600}
                underline="always"
              >
                pd2.tools GitHub repository
              </Anchor>{" "}
              would really help us out!
            </Text>
          </Box>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <Button
            component="a"
            href="https://github.com/coleestrin/pd2-tools"
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<GitHubIcon />}
            variant="white"
            color="dark"
            size="sm"
            style={{
              backgroundColor: "#fff",
              color: "#24292f",
              borderColor: "#d0d7de",
            }}
          >
            Star on GitHub
          </Button>
          <CloseButton
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            variant="transparent"
            c="black"
            size="lg"
          />
        </Group>
      </Group>
    </Box>
  );
}
