import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  Box,
  Card,
  Group,
  Stack,
  Text,
  Title,
  Button,
  useMantineTheme,
  Drawer,
  Burger,
  Center,
  Skeleton,
} from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { MantineReactTable, useMantineReactTable } from "mantine-react-table";
import { useState } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { economyAPI } from "../api";
import { ECONOMY_ITEMS_DATA } from "../data/economy-items";
import {
  CustomBreadcrumbs,
  Navigation,
  NAV_ITEMS,
} from "../components/economy/shared";
import EconomyDisclaimer from "../components/economy/disclaimer";

function formatItemNameFromUrl(urlName: string | undefined): string {
  if (!urlName) return "";
  return urlName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ItemDetail() {
  const { itemNameURL } = useParams<{ itemNameURL: string }>();
  const theme = useMantineTheme();
  const [drawerOpened, setDrawerOpened] = useState(false);

  const { isPending, data } = useQuery({
    queryKey: [itemNameURL],
    queryFn: () => {
      const itemData = itemNameURL ? ECONOMY_ITEMS_DATA[itemNameURL] : null;
      if (!itemData) return Promise.reject(new Error("Item not found"));
      return economyAPI.getItem(itemData.itemNameInternal);
    },
    enabled: !!itemNameURL,
  });

  const itemDisplayName = useMemo(
    () => formatItemNameFromUrl(itemNameURL),
    [itemNameURL]
  );
  const currentItemData = useMemo(() => {
    if (!itemNameURL) return null;
    return ECONOMY_ITEMS_DATA[itemNameURL];
  }, [itemNameURL]);

  const [activeCategory, setActiveCategory] = useState(
    currentItemData?.categoryValue || "currency"
  );

  useMemo(() => {
    if (currentItemData) {
      setActiveCategory(currentItemData.categoryValue);
    }
  }, [currentItemData]);

  const columns = useMemo(
    () => [
      { accessorKey: "dataDate", header: "Date", size: 150 },
      { accessorKey: "priceStr", header: "Price String", size: 100 },
      {
        accessorKey: "numericalPrice",
        header: "Price (HR)",
        size: 100,
        Cell: ({ cell }: { cell: { getValue: () => number | null } }) =>
          cell.getValue()
            ? parseFloat(String(cell.getValue())) + " HR"
            : "Unknown",
      },
      { accessorKey: "username", header: "Seller Username", size: 150 },
      { accessorKey: "quantity", header: "Quantity", size: 150 },
    ],
    []
  );

  const table = useMantineReactTable({
    columns,
    data: data?.allListings || [],
    enableRowVirtualization: false,
    enableTopToolbar: false,
    enableBottomToolbar: true,
    initialState: { density: "xs", pagination: { pageIndex: 0, pageSize: 10 } },
    paginationDisplayMode: "default",
    enableColumnActions: false,
    mantineTableProps: {
      highlightOnHover: true,
      striped: "odd",
      withColumnBorders: false,
      withRowBorders: true,
      withTableBorder: false,
    },
    mantinePaginationProps: {
      showRowsPerPage: false,
    },
  });

  if (!currentItemData) {
    return (
      <>
        <Helmet>
          <title>Item Not Found - pd2.tools</title>
        </Helmet>
        <Center style={{ height: "calc(100vh - 120px)" }}>
          <Stack align="center">
            <Title order={2}>Item Not Found</Title>
            <Text>The item "{itemDisplayName}" could not be found.</Text>
            <a href="/economy/currency">
              <Button>Go to Economy Home</Button>
            </a>
          </Stack>
        </Center>
      </>
    );
  }

  const chartData =
    data?.dataByIngestionDate?.map((item) => ({
      date: item.trueDate,
      Price: item.price,
      Listings: item.numListings,
    })) || [];

  return (
    <>
      <Helmet>
        <title>{`${currentItemData.displayName} - Economy - pd2.tools`}</title>
        <meta
          name="description"
          content={`View the price and price history of ${currentItemData.displayName} on Project Diablo 2`}
        />
      </Helmet>
      <EconomyDisclaimer />
      <Box
        hiddenFrom="sm"
        style={{
          width: "95%",
          maxWidth: "1300px",
          margin: `${theme.spacing.md} auto 0 auto`,
        }}
      >
        <Button
          leftSection={<Burger opened={drawerOpened} size="sm" />}
          onClick={() => setDrawerOpened((o) => !o)}
          variant="filled"
          aria-label="Toggle categories menu"
          fullWidth
        >
          Categories
        </Button>
      </Box>

      <Card
        withBorder
        styles={{
          root: {
            width: "95%",
            maxWidth: "1300px",
            margin: `${theme.spacing.md} auto`,
            minHeight: "1000px",
            padding: theme.spacing.sm,
            [`@media (min-width: ${theme.breakpoints.sm})`]: {
              width: "90%",
              padding: theme.spacing.md,
            },
            [`@media (min-width: ${theme.breakpoints.lg})`]: {
              width: "75%",
              padding: theme.spacing.lg,
            },
          },
        }}
      >
        <Drawer
          opened={drawerOpened}
          onClose={() => setDrawerOpened(false)}
          title="Categories"
          padding="md"
          size="280px"
        >
          <Navigation
            activeCategory={activeCategory}
            navItems={NAV_ITEMS}
            closeDrawer={() => setDrawerOpened(false)}
            currentItemCategoryValue={currentItemData.categoryValue}
          />
        </Drawer>

        <Group align="stretch" gap="lg" wrap="nowrap">
          <Box visibleFrom="sm" style={{ width: "220px", minWidth: "200px" }}>
            <Navigation
              activeCategory={activeCategory}
              navItems={NAV_ITEMS}
              currentItemCategoryValue={currentItemData.categoryValue}
            />
          </Box>

          <Box style={{ flex: 1, minWidth: 0 }}>
            <Stack gap="lg">
              <CustomBreadcrumbs separator=">">
                <a
                  href="/economy/currency"
                  style={{ textDecoration: "none", color: "#4dabf7" }}
                >
                  <Text size="sm">Economy</Text>
                </a>
                <a
                  href={currentItemData.categoryPath}
                  style={{ textDecoration: "none", color: "#4dabf7" }}
                >
                  <Text size="sm">{currentItemData.category}</Text>
                </a>
                <Text size="sm">{currentItemData.displayName}</Text>
              </CustomBreadcrumbs>

              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm">
                  <img
                    src={currentItemData.iconUrl}
                    alt={currentItemData.displayName}
                    width={32}
                    height={32}
                    style={{ objectFit: "contain" }}
                  />
                  <Title order={2}>{currentItemData.displayName}</Title>
                </Group>
                <Button
                  component="a"
                  href={`https://www.projectdiablo2.com/market?name=${encodeURIComponent(currentItemData.displayName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="light"
                  visibleFrom="sm"
                  rightSection={<IconExternalLink size={16} />}
                >
                  Trade Now
                </Button>
              </Group>

              <Skeleton visible={isPending}>
                <Card withBorder shadow="sm" padding="lg">
                  <Text fw={500} mb="md">
                    Historical Price & Listings
                  </Text>
                  <LineChart
                    h={300}
                    data={chartData}
                    dataKey="date"
                    series={[
                      {
                        name: "Price",
                        color: "blue.6",
                        stroke: "#339af0",
                        strokeWidth: 1,
                        dot: false,
                      },
                      {
                        name: "Listings",
                        color: "gray.5",
                        stroke: "#339af0",
                        strokeWidth: 1,
                        dot: false,
                        yAxisId: "right",
                      },
                    ]}
                    curveType="monotone"
                    withRightYAxis
                    yAxisProps={{
                      tickFormatter: (value: number) => `${value} HR`,
                    }}
                    withDots={false}
                    tickLine="none"
                    gridAxis="none"
                    rightYAxisProps={{
                      tickFormatter: (value: number) => `${value}`,
                    }}
                    xAxisProps={{
                      padding: { left: 20, right: 20 },
                    }}
                    tooltipProps={{
                      formatter: (value: number, name: string) => [
                        `${value}${name === "Price" ? " HR" : ""}`,
                      ],
                    }}
                    connectNulls
                  />
                </Card>
              </Skeleton>

              <Skeleton visible={isPending}>
                <Card withBorder shadow="sm" padding="lg">
                  <Text fw={500} mb="md">
                    Recent Listings
                  </Text>
                  <MantineReactTable table={table} />
                </Card>
              </Skeleton>
            </Stack>
          </Box>
        </Group>
      </Card>
    </>
  );
}

