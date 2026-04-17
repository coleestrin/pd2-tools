import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  Box,
  Card,
  Stack,
  Text,
  Button,
  useMantineTheme,
  Drawer,
  Burger,
  Group,
  Title,
  Skeleton,
  Select,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { economyAPI } from "../api";
import { ECONOMY_ITEMS_DATA } from "../data/economy-items";
import {
  CustomBreadcrumbs,
  Navigation,
  NAV_ITEMS,
  DEFAULT_CATEGORY,
} from "../components/economy/shared";
import { ItemsTable } from "../components/economy/ItemsTable";
import EconomyDisclaimer from "../components/economy/disclaimer";
import { CURRENT_SEASON, SEASON_OPTIONS } from "../types";

export default function Economy() {
  const { category: paramCategory } = useParams<{ category: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useMantineTheme();
  const economySeasonOptions = SEASON_OPTIONS.filter(
    (option) => option.value !== "11"
  );
  const rawSeason = searchParams.get("season");
  const season = rawSeason
    ? economySeasonOptions.some((option) => option.value === rawSeason)
      ? parseInt(rawSeason, 10)
      : CURRENT_SEASON
    : CURRENT_SEASON;

  const { isPending, data } = useQuery({
    queryKey: ["economyItems", season],
    queryFn: () => economyAPI.getItems(season),
  });

  const flatNavItems = useMemo(() => NAV_ITEMS.flatMap((s) => s.items), []);

  const [activeCategory, setActiveCategory] = useState(() => {
    const foundItem = flatNavItems.find((i) => i.value === paramCategory);
    return foundItem ? paramCategory : DEFAULT_CATEGORY;
  });
  const [drawerOpened, setDrawerOpened] = useState(false);

  useEffect(() => {
    const targetItem = flatNavItems.find((i) => i.value === paramCategory);

    if (targetItem) {
      if (activeCategory !== targetItem.value) {
        setActiveCategory(targetItem.value);
      }
    } else {
      const defaultItem = flatNavItems.find(
        (i) => i.value === DEFAULT_CATEGORY
      );
      if (defaultItem && activeCategory !== defaultItem.value) {
        setActiveCategory(defaultItem.value);
      }
    }
  }, [paramCategory, activeCategory, location.pathname, flatNavItems]);

  const currentCategoryInfo = useMemo(() => {
    return (
      flatNavItems.find((i) => i.value === activeCategory) ||
      flatNavItems.find((i) => i.value === DEFAULT_CATEGORY)
    );
  }, [activeCategory, flatNavItems]);

  const currentCategoryLabel = currentCategoryInfo
    ? currentCategoryInfo.label
    : "";
  const currentCategoryPath = currentCategoryInfo
    ? currentCategoryInfo.path
    : "/";
  const seasonSearch = season !== CURRENT_SEASON ? `?season=${season}` : "";

  // Create reverse lookup map from itemNameInternal to item data
  const itemDataByInternalName = useMemo(() => {
    const map: Record<
      string,
      (typeof ECONOMY_ITEMS_DATA)[string] & { order: number }
    > = {};
    Object.values(ECONOMY_ITEMS_DATA).forEach((itemData, index) => {
      map[itemData.itemNameInternal] = { ...itemData, order: index };
    });
    return map;
  }, []);

  const filteredItems = useMemo(() => {
    if (!data?.items || !currentCategoryInfo?.label) {
      return [];
    }

    return data.items
      .filter((item) => {
        const itemData = itemDataByInternalName[item.item_name];
        return itemData && itemData.category === currentCategoryInfo.label;
      })
      .map((item) => {
        const itemData = itemDataByInternalName[item.item_name];
        if (!itemData) return null;
        return {
          item_name: itemData.displayName,
          price_data: item.price_data.filter((pData) => pData?.price),
          category: itemData.category,
          wiki_link: itemData.wikiLink || "",
          icon_url: itemData.iconUrl,
          order: itemData.order,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.order - b.order);
  }, [data, currentCategoryInfo, itemDataByInternalName]);

  return (
    <>
      <Helmet>
        <title>{`${currentCategoryLabel || "Economy"} - Economy - pd2.tools`}</title>
        <meta
          name="description"
          content={`Track the price and supply of ${currentCategoryLabel || "items"} in Project Diablo 2`}
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
            search={seasonSearch}
          />
        </Drawer>

        <Group align="stretch" gap="lg" wrap="nowrap">
          <Box visibleFrom="sm" style={{ width: "220px", minWidth: "200px" }}>
            <Navigation
              activeCategory={activeCategory}
              navItems={NAV_ITEMS}
              search={seasonSearch}
            />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Stack>
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <CustomBreadcrumbs separator=">">
                  <a
                    href={`/economy/${DEFAULT_CATEGORY}${seasonSearch}`}
                    style={{ textDecoration: "none", color: "#4dabf7" }}
                  >
                    <Text size="sm">Economy</Text>
                  </a>
                  <a
                    href={`${currentCategoryPath}${seasonSearch}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Text size="sm">{currentCategoryLabel}</Text>
                  </a>
                </CustomBreadcrumbs>
                <Select
                  value={season.toString()}
                  onChange={(value) => {
                    const nextParams = new URLSearchParams(searchParams);
                    const nextSeason = parseInt(
                      value || CURRENT_SEASON.toString(),
                      10
                    );

                    if (nextSeason !== CURRENT_SEASON) {
                      nextParams.set("season", nextSeason.toString());
                    } else {
                      nextParams.delete("season");
                    }

                    setSearchParams(nextParams, { replace: true });
                  }}
                  data={economySeasonOptions}
                  w={120}
                />
              </Group>
              <Title order={2} style={{ marginTop: "-8px" }}>
                {currentCategoryLabel}
              </Title>
              <Skeleton
                visible={isPending}
                animate={true}
                style={{ height: "1000px" }}
              >
                <ItemsTable
                  items={filteredItems}
                  isPending={isPending}
                  category={currentCategoryLabel}
                  search={seasonSearch}
                />
              </Skeleton>
            </Stack>
          </Box>
        </Group>
      </Card>
    </>
  );
}
