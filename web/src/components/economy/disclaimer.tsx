import { Alert, Anchor, Box, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { CURRENT_SEASON } from "../../types";

export default function EconomyDisclaimer() {
  return (
    <Box
      w={{ base: "95%", sm: "90%", lg: "75%" }}
      maw="1300px"
      mx="auto"
      mt="md"
    >
      <Alert
        color="yellow"
        variant="light"
        icon={<IconAlertTriangle size="1rem" />}
        mb="md"
      >
        <Stack gap={4}>
          <Text fw={700}>
            Season {CURRENT_SEASON} data won&apos;t be ready until a few days
            after season start when the market stabilizes more.
          </Text>
          <Text size="sm">
            In the meantime you can use spreadsheets maintained by other
            community members, such as{" "}
            <Anchor
              href="https://docs.google.com/spreadsheets/d/1jfT0jGD3-CkuIjl8cAOgkTHUc4jEh9L2ni7QlbzinWw/htmlview#"
              target="_blank"
              rel="noopener noreferrer"
            >
              Lucky Luciano&apos;s List
            </Anchor>
            ,{" "}
            <Anchor
              href="https://docs.google.com/spreadsheets/d/1-vKTxRlgTxat3_INgrwa3YVMC3A3yJSMZw3uvD8YBoo/edit?gid=1661381827#gid=1661381827"
              target="_blank"
              rel="noopener noreferrer"
            >
              BetweenWalls List
            </Anchor>
            , or{" "}
            <Anchor
              href="https://pd2trader.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              PD2 Trader
            </Anchor>
            .
          </Text>
          <Text size="sm">
            Prices may be inaccurate, especially for items with a low amount of
            listings. Use your own discretion when determining item values.
            Only available for softcore.
          </Text>
        </Stack>
      </Alert>
    </Box>
  );
}
