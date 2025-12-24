import { Alert, Container, rem } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

export default function EconomyDisclaimer() {
  return (
    <Container style={{ maxWidth: "75%" }}>
      <Alert
      color="yellow"
      variant="light"
      icon={<IconAlertTriangle size="1rem" />}
      mb="md"
      mx={rem(20)}
      >
      Prices may be inaccurate, especially for items with a low amount of
      listings. Use your own discretion when determining item values. Only
      available for softcore.
      </Alert>
    </Container>
  );
}

