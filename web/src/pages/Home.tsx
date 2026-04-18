import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import {
  Anchor,
  Button,
  Card,
  Container,
  Skeleton,
  Text,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import {
  IconAlarm,
  IconArrowRight,
  IconChartBar,
  IconDownload,
  IconSearch,
  IconTrendingUp,
  IconTrophy,
} from "@tabler/icons-react";
import CountUp from "react-countup";
import { apiClient, charactersAPI, economyAPI } from "../api";
import {
  getBrightBorderColor,
  getDarkBackgroundColor,
} from "../components/builds/shared/item-colors";
import {
  ItemTooltip,
  type ItemData,
} from "../components/builds/shared/ItemHelpers";
import { API_ENDPOINTS } from "../config/api";
import { ECONOMY_ITEMS_DATA } from "../data/economy-items";
import {
  DEFAULT_VIEW_SEASON,
  type HomeStats,
} from "../types";
import classes from "./Home.module.css";

const CACHE_KEY = "pd2tools_home_stats";
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const FIXED_EXPORT_COUNT = 38926;
const RECENT_CHARACTER_LIMIT = 5;
const HERO_SLIDE_INTERVAL_MS = 6500;
const MARKET_ITEM_LIMIT = 5;
const TOP_ITEM_LIMIT = 5;
const LEADERBOARD_LIMIT = 8;
const RECENT_SKELETON_HEIGHT = 48;
const MARKET_SKELETON_HEIGHT = 44;
const CLASS_META_SKELETON_COUNT = 7;
const CLASS_META_SKELETON_HEIGHT = 40;
const LEADERBOARD_SKELETON_HEIGHT = 36;
const LEADERBOARD_SEASON = DEFAULT_VIEW_SEASON;
const HERO_SLIDES = [
  {
    eyebrow: "Recent Activity",
    title: "Recently Updated Characters",
    copy: "Recently updated tracked characters from the current ladder sample.",
  },
  {
    eyebrow: "Economy · SC",
    title: "Market Prices",
    copy: "Tracked listings plus the busiest current items on the market.",
  },
  {
    eyebrow: "Class Meta · SC",
    title: "Softcore Class Spread",
    copy: "Full class spread across the sampled softcore ladder.",
  },
  {
    eyebrow: "Item Meta · SC",
    title: "Most Used Items",
    copy: "Most equipped items across the tracked softcore ladder sample.",
  },
  {
    eyebrow: "Leaderboard · SC",
    title: "Level 99 Accounts",
    copy: `Softcore account leaderboard for Season ${LEADERBOARD_SEASON}.`,
  },
] as const;

interface CachedHomeStats extends HomeStats {
  timestamp: number;
}

interface ToolCard {
  name: string;
  description: string;
  path: string;
  buttonLabel: string;
  icon: React.ElementType;
}

interface ClassMetaItem {
  className: string;
  count: number;
  share: number;
}

interface HomeSliderResponse {
  recentCharacters: Array<{
    name: string;
    className: string;
    level: number;
    mode: "Softcore" | "Hardcore";
    lastUpdated: number;
  }>;
  softcoreClasses: ClassMetaItem[];
  marketSnapshot: Array<{
    itemName: string;
    price: number;
    listings: number;
  }>;
  leaderboard: Array<{
    accountName: string;
    count: number;
  }>;
}

const ECONOMY_ITEM_DETAILS_BY_INTERNAL_NAME = Object.entries(
  ECONOMY_ITEMS_DATA
).reduce<Record<string, { displayName: string; iconUrl: string; href: string }>>(
  (acc, [slug, item]) => {
    acc[item.itemNameInternal] = {
      displayName: item.displayName,
      iconUrl: item.iconUrl,
      href: `/economy/item/${slug}`,
    };
    return acc;
  },
  {}
);

function getEconomyIconPath(iconUrl?: string) {
  if (!iconUrl) {
    return "/economy_icons/mask.png";
  }

  return iconUrl.startsWith("/") ? iconUrl : `/${iconUrl}`;
}

function handleEconomyIconError(
  event: React.SyntheticEvent<HTMLImageElement, Event>
) {
  if (event.currentTarget.dataset.fallbackApplied === "true") {
    return;
  }

  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = "/economy_icons/mask.png";
}

const ECONOMY_FALLBACK_ICON_PATH = "/economy_icons/mask.png";

function getEconomyItemDetails(itemName: string) {
  return ECONOMY_ITEM_DETAILS_BY_INTERNAL_NAME[itemName];
}

const ECONOMY_ICON_BY_INTERNAL_NAME = Object.values(ECONOMY_ITEMS_DATA).reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.itemNameInternal] = getEconomyIconPath(item.iconUrl);
  return acc;
}, {});

function getCachedHomeStats(): CachedHomeStats | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function setCachedHomeStats(stats: HomeStats) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...stats, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

const tools: ToolCard[] = [
  {
    name: "Build Viewer",
    description:
      "Filter the ladder by class, items, and skills to check the meta, see how other players gear similar builds, or find inspiration for new builds.",
    path: "/builds",
    buttonLabel: "Browse Builds",
    icon: IconSearch,
  },
  {
    name: "Economy",
    description: "Track the price and supply of items over time.",
    path: "/economy/currency",
    buttonLabel: "Track Economy",
    icon: IconTrendingUp,
  },
  {
    name: "Character Exporter",
    description:
      "Copy any multiplayer character to a single player save file for build testing or boss practice offline.",
    path: "/tools/character-export",
    buttonLabel: "Export Character",
    icon: IconDownload,
  },
  {
    name: "Corrupted Zone Tracker",
    description:
      "Track upcoming corrupted zones and get notifications for your favorite zones.",
    path: "/tools/corrupted-zone-tracker",
    buttonLabel: "Track Zones",
    icon: IconAlarm,
  },
  {
    name: "Statistics",
    description: "View various Project Diablo 2 statistics.",
    path: "/statistics",
    buttonLabel: "View Statistics",
    icon: IconChartBar,
  },
  {
    name: "Leaderboard",
    description:
      "Track top players, items, and achievements across Project Diablo 2.",
    path: "/leaderboard",
    buttonLabel: "View Leaderboard",
    icon: IconTrophy,
  },
];

function renderAnimatedNumber(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return <CountUp end={value} duration={0.9} separator="," />;
}

function formatPrice(price: number) {
  const formatted = price >= 10 ? price.toFixed(1) : price.toFixed(2);
  return `${formatted.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")} HR`;
}

function formatRelativeAge(timestamp: number, now: number) {
  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Home() {
  const cached = getCachedHomeStats();
  const [stats, setStats] = useState<HomeStats | null>(
    cached
      ? {
          totalCharacters: cached.totalCharacters,
          totalExports: FIXED_EXPORT_COUNT,
          totalEconomyItems: cached.totalEconomyItems,
          totalListings: cached.totalListings,
        }
      : null
  );
  const [loading, setLoading] = useState(!cached);
  const [relativeTimeNow, setRelativeTimeNow] = useState(Date.now());
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  useEffect(() => {
    async function fetchStats() {
      const cachedStats = getCachedHomeStats();
      const now = Date.now();

      if (cachedStats && now - cachedStats.timestamp < CACHE_DURATION_MS) {
        setStats({
          totalCharacters: cachedStats.totalCharacters,
          totalExports: FIXED_EXPORT_COUNT,
          totalEconomyItems: cachedStats.totalEconomyItems,
          totalListings: cachedStats.totalListings,
        });
        setLoading(false);
        return;
      }

      try {
        const [charactersData, economyOverview] = await Promise.allSettled([
          charactersAPI.getCharacterCounts(),
          economyAPI.getItems(),
        ]);

        const totalCharacters =
          charactersData.status === "fulfilled"
            ? (charactersData.value.hardcore || 0) +
              (charactersData.value.softcore || 0)
            : 0;

        const totalEconomyItems =
          economyOverview.status === "fulfilled" &&
          economyOverview.value?.items &&
          Array.isArray(economyOverview.value.items)
            ? economyOverview.value.items.length
            : 0;

        const totalListings =
          economyOverview.status === "fulfilled"
            ? economyOverview.value.totalListings || 0
            : 0;

        const newStats = {
          totalCharacters,
          totalExports: FIXED_EXPORT_COUNT,
          totalEconomyItems,
          totalListings,
        };

        setCachedHomeStats(newStats);
        setStats(newStats);
      } catch (err) {
        console.error("Failed to fetch home page stats:", err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRelativeTimeNow(Date.now());
    }, 15_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, HERO_SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  const homeSliderQuery = useQuery({
    queryKey: ["home-slider", DEFAULT_VIEW_SEASON, LEADERBOARD_SEASON],
    queryFn: async () => {
      const [response, topItems, itemCatalog] = await Promise.all([
        apiClient.get<HomeSliderResponse>(API_ENDPOINTS.homeSlider, {
          season: DEFAULT_VIEW_SEASON,
          leaderboardSeason: LEADERBOARD_SEASON,
        }),
        charactersAPI.getItemUsage("softcore", {
          season: DEFAULT_VIEW_SEASON,
          levelRange: { min: 80, max: 99 },
        }),
        fetch("/items.json").then((res) => res.json() as Promise<ItemData[]>),
      ]);

      const itemDataByName = new Map(
        itemCatalog.map((item) => [item.gearId.name, item])
      );

      return {
        recentCharacters: response.recentCharacters.map((character) => ({
          ...character,
          href: `/builds/character/${encodeURIComponent(character.name)}`,
        })),
        softcoreClasses: response.softcoreClasses,
        marketSnapshot: response.marketSnapshot.map((item) => {
          const itemDetails = getEconomyItemDetails(item.itemName);

          return {
            itemName: itemDetails?.displayName || item.itemName,
            price: item.price,
            listings: item.listings,
            iconUrl:
              ECONOMY_ICON_BY_INTERNAL_NAME[item.itemName] ||
              getEconomyIconPath(itemDetails?.iconUrl) ||
              ECONOMY_FALLBACK_ICON_PATH,
            href:
              itemDetails?.href ||
              `/economy/item/${item.itemName
                .toLowerCase()
                .replaceAll(" ", "-")
                .replaceAll("'", "")}`,
          };
        }),
        topItems: topItems.slice(0, TOP_ITEM_LIMIT).map((item) => ({
          itemName: item.item,
          itemType: item.itemType,
          pct: item.pct,
          numOccurrences: item.numOccurrences,
          href: `/builds?items=${encodeURIComponent(item.item)}&minLevel=80&maxLevel=99`,
          itemData: itemDataByName.get(item.item),
        })),
        leaderboard: response.leaderboard.map((entry) => ({
          account_name: entry.accountName,
          count: entry.count,
        })),
      };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const activityStats = [
    {
      label: "Characters Tracked",
      value: stats?.totalCharacters ?? 0,
    },
    {
      label: "Characters Exported",
      value: stats?.totalExports ?? 0,
    },
    {
      label: "Economy Items Tracked",
      value: stats?.totalEconomyItems ?? 0,
    },
    {
      label: "Item Listings Tracked",
      value: stats?.totalListings ?? 0,
    },
  ];

  return (
    <>
      <Helmet>
        <title>pd2.tools</title>
        <meta
          name="description"
          content="Track Project Diablo 2 builds, economy, corrupted zones, and ladder tools in one clean toolkit."
        />
      </Helmet>

      <div className={classes.page}>
        <Container size="xl" className={classes.container}>
          <section className={classes.heroSection}>
            <div className={classes.heroGrid}>
              <div className={classes.heroCopy}>
                <Text className={classes.eyebrow}>Project Diablo 2 Tools</Text>
                <Title order={1} className={classes.heroTitle}>
                  Track builds. Follow the meta. Watch the economy.
                </Title>
                <Text className={classes.heroDescription}>
                  pd2.tools brings Project Diablo 2 builds, item prices, and
                  game information into one place.
                </Text>

                <div className={classes.heroActions}>
                  <Button
                    component="a"
                    href="/builds"
                    className={classes.primaryButton}
                    rightSection={<IconArrowRight size={16} />}
                  >
                    Browse Builds
                  </Button>
                  <Button
                    component="a"
                    href="/economy/currency"
                    variant="default"
                    className={classes.secondaryButton}
                    rightSection={<IconArrowRight size={16} />}
                  >
                    Track Economy
                  </Button>
                </div>
              </div>

              <div className={classes.heroVisual}>
                <Card className={classes.activityPanel}>
                  <div className={classes.activityPanelTopRow}>
                    <Text className={classes.activityEyebrow}>
                      {HERO_SLIDES[activeHeroSlide].eyebrow}
                    </Text>
                    <div className={classes.activitySlideIndicators}>
                      {HERO_SLIDES.map((slide, index) => (
                        <button
                          key={slide.eyebrow}
                          type="button"
                          className={`${classes.activitySlideIndicator} ${
                            index === activeHeroSlide
                              ? classes.activitySlideIndicatorActive
                              : ""
                          }`}
                          aria-label={`Show ${slide.title}`}
                          onClick={() => setActiveHeroSlide(index)}
                        />
                      ))}
                    </div>
                  </div>
                  <Title order={3} className={classes.activityPanelTitle}>
                    {HERO_SLIDES[activeHeroSlide].title}
                  </Title>

                  <div className={classes.activitySlidesViewport}>
                    {activeHeroSlide === 0 ? (
                      <div
                        key="recent-activity-slide"
                        className={`${classes.activitySlideBody} ${classes.activitySlideBodyTight}`}
                      >
                        <div className={classes.activityFeed}>
                          {homeSliderQuery.isPending
                            ? Array.from({ length: RECENT_CHARACTER_LIMIT }).map(
                                (_, index) => (
                                  <Skeleton
                                    key={`recent-character-skeleton-${index}`}
                                    height={RECENT_SKELETON_HEIGHT}
                                    radius="sm"
                                    className={classes.activityFeedSkeleton}
                                  />
                                )
                              )
                            : null}

                          {!homeSliderQuery.isPending &&
                          homeSliderQuery.data?.recentCharacters.length ? (
                            homeSliderQuery.data.recentCharacters.map(
                              (character) => (
                                <Anchor
                                  key={`${character.mode}-${character.name}`}
                                  href={character.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={classes.activityFeedRow}
                                >
                                  <img
                                    src={`/${character.className}.webp`}
                                    alt=""
                                    aria-hidden="true"
                                    className={classes.activityFeedClassImage}
                                  />

                                  <div className={classes.activityFeedMain}>
                                    <Text className={classes.activityFeedName}>
                                      {character.name}
                                    </Text>
                                    <Text className={classes.activityFeedMeta}>
                                      Level {character.level}{" "}
                                      {character.className} · {character.mode}
                                    </Text>
                                  </div>

                                  <Text className={classes.activityFeedTime}>
                                    {formatRelativeAge(
                                      character.lastUpdated,
                                      relativeTimeNow
                                    )}
                                  </Text>
                                </Anchor>
                              )
                            )
                          ) : null}

                          {!homeSliderQuery.isPending &&
                          !homeSliderQuery.data?.recentCharacters.length ? (
                            <div className={classes.activityFeedEmpty}>
                              <Text className={classes.activityFeedEmptyTitle}>
                                No recent profile updates yet
                              </Text>
                              <Text className={classes.activityFeedEmptyCopy}>
                                Check back shortly or open the builds page to
                                browse the current ladder.
                              </Text>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {activeHeroSlide === 1 ? (
                      <div
                        key="economy-slide"
                        className={classes.activitySlideBody}
                      >
                        <div className={classes.marketList}>
                          {homeSliderQuery.isPending
                            ? Array.from({ length: MARKET_ITEM_LIMIT }).map(
                                (_, index) => (
                                  <Skeleton
                                    key={`market-skeleton-${index}`}
                                    height={MARKET_SKELETON_HEIGHT}
                                    radius="sm"
                                    className={classes.activityFeedSkeleton}
                                  />
                                )
                              )
                            : null}

                          {!homeSliderQuery.isPending &&
                          homeSliderQuery.data?.marketSnapshot.length ? (
                            homeSliderQuery.data.marketSnapshot.map((item) => (
                              <Anchor
                                key={item.itemName}
                                href={item.href}
                                target="_blank"
                                rel="noreferrer"
                                className={classes.marketRow}
                              >
                                <img
                                  src={item.iconUrl}
                                  alt=""
                                  aria-hidden="true"
                                  className={classes.marketItemImage}
                                  onError={handleEconomyIconError}
                                />
                                <div className={classes.marketRowMain}>
                                  <Text className={classes.marketItemName}>
                                    {item.itemName}
                                  </Text>
                                  <Text className={classes.marketItemMeta}>
                                    {item.listings >= 100
                                      ? "100+ listings"
                                      : `${item.listings} listings`}
                                  </Text>
                                </div>
                                <Text className={classes.marketPrice}>
                                  {formatPrice(item.price)}
                                </Text>
                              </Anchor>
                            ))
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {activeHeroSlide === 2 ? (
                      <div
                        key="class-meta-slide"
                        className={`${classes.activitySlideBody} ${classes.activitySlideBodyCompact}`}
                      >
                        <div className={classes.classMetaList}>
                          {homeSliderQuery.isPending
                            ? Array.from({
                                length: CLASS_META_SKELETON_COUNT,
                              }).map((_, index) => (
                                <Skeleton
                                  key={`class-meta-skeleton-${index}`}
                                  height={CLASS_META_SKELETON_HEIGHT}
                                  radius="sm"
                                  className={classes.activityFeedSkeleton}
                                />
                              ))
                            : null}

                          {!homeSliderQuery.isPending &&
                          homeSliderQuery.data?.softcoreClasses.length ? (
                            homeSliderQuery.data.softcoreClasses.map(
                              (item) => (
                                <div
                                  key={item.className}
                                  className={classes.classMetaRow}
                                >
                                  <img
                                    src={`/${item.className}.webp`}
                                    alt=""
                                    aria-hidden="true"
                                    className={classes.classMetaImage}
                                  />
                                  <div className={classes.classMetaMain}>
                                    <div className={classes.classMetaHeader}>
                                      <Text className={classes.classMetaName}>
                                        {item.className}
                                      </Text>
                                      <Text className={classes.classMetaShare}>
                                        {Math.round(item.share * 100)}%
                                      </Text>
                                    </div>
                                    <div className={classes.classMetaBar}>
                                      <div
                                        className={classes.classMetaBarFill}
                                        style={{
                                          width: `${Math.max(
                                            10,
                                            item.share * 100
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )
                            )
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {activeHeroSlide === 3 ? (
                      <div
                        key="item-meta-slide"
                        className={classes.activitySlideBody}
                      >
                        <div className={classes.marketList}>
                          {homeSliderQuery.isPending
                            ? Array.from({ length: TOP_ITEM_LIMIT }).map(
                                (_, index) => (
                                  <Skeleton
                                    key={`top-item-skeleton-${index}`}
                                    height={MARKET_SKELETON_HEIGHT}
                                    radius="sm"
                                    className={classes.activityFeedSkeleton}
                                  />
                                )
                              )
                            : null}

                          {!homeSliderQuery.isPending &&
                          homeSliderQuery.data?.topItems.length ? (
                            homeSliderQuery.data.topItems.map((item) => {
                              const itemData = item.itemData;
                              const imageUrl = itemData?.imageUrl;
                              const borderColor = getBrightBorderColor(
                                item.itemType
                              );
                              const backgroundColor = getDarkBackgroundColor(
                                item.itemType
                              );

                              return (
                                <ItemTooltip
                                  key={`${item.itemName}-${item.itemType}`}
                                  itemData={itemData}
                                  itemType={item.itemType}
                                  itemName={item.itemName}
                                >
                                  <Anchor
                                    href={item.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={classes.marketRow}
                                  >
                                    <div
                                      className={classes.homeItemIconFrame}
                                      style={{
                                        borderColor: imageUrl
                                          ? borderColor
                                          : "transparent",
                                        backgroundColor: imageUrl
                                          ? backgroundColor
                                          : "transparent",
                                      }}
                                    >
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt=""
                                          aria-hidden="true"
                                          className={classes.marketItemImage}
                                        />
                                      ) : null}
                                    </div>
                                    <div className={classes.marketRowMain}>
                                      <Text className={classes.marketItemName}>
                                        {item.itemName}
                                      </Text>
                                      <Text className={classes.marketItemMeta}>
                                        {item.itemType} ·{" "}
                                        {item.numOccurrences.toLocaleString()}{" "}
                                        equips
                                      </Text>
                                    </div>
                                    <Text className={classes.marketPrice}>
                                      {item.pct.toFixed(1)}%
                                    </Text>
                                  </Anchor>
                                </ItemTooltip>
                              );
                            })
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {activeHeroSlide === 4 ? (
                      <div
                        key="leaderboard-slide"
                        className={`${classes.activitySlideBody} ${classes.activitySlideBodyCompact}`}
                      >
                        <div className={classes.leaderboardList}>
                          {homeSliderQuery.isPending
                            ? Array.from({ length: LEADERBOARD_LIMIT }).map(
                                (_, index) => (
                                  <Skeleton
                                    key={`leaderboard-skeleton-${index}`}
                                    height={LEADERBOARD_SKELETON_HEIGHT}
                                    radius="sm"
                                    className={classes.activityFeedSkeleton}
                                  />
                                )
                              )
                            : null}

                          {!homeSliderQuery.isPending &&
                          homeSliderQuery.data?.leaderboard.length ? (
                            homeSliderQuery.data.leaderboard.map((entry, index) => (
                              <div
                                key={`${entry.account_name}-${index}`}
                                className={classes.leaderboardRow}
                              >
                                <Text className={classes.leaderboardRank}>
                                  {index + 1}
                                </Text>
                                <Anchor
                                  href={`/builds/account/${encodeURIComponent(
                                    entry.account_name
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={classes.leaderboardLink}
                                >
                                  <Text className={classes.leaderboardName}>
                                    {entry.account_name}
                                  </Text>
                                </Anchor>
                                <Text className={classes.leaderboardValue}>
                                  <span>{entry.count}x </span>
                                  <span
                                    className={classes.leaderboardValueLevel}
                                  >
                                    99
                                  </span>
                                </Text>
                              </div>
                            ))
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            </div>
          </section>

          <section className={classes.activitySection}>
            <div className={classes.activityStrip}>
              {activityStats.map((item) => (
                <div key={item.label} className={classes.activityItem}>
                  <Text className={classes.activityLabel}>{item.label}</Text>
                  {loading ? (
                    <Skeleton
                      height={38}
                      width={140}
                      mt="sm"
                      radius="xl"
                      className={classes.activitySkeleton}
                    />
                  ) : (
                    <Title order={2} className={classes.activityValue}>
                      {renderAnimatedNumber(item.value)}
                    </Title>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className={classes.section}>
            <div className={classes.utilityGrid}>
              {tools.map((tool) => {
                const Icon = tool.icon;

                return (
                  <Card key={tool.name} className={classes.utilityCard}>
                    <div className={classes.utilityHeader}>
                      <div className={classes.utilityIcon}>
                        <Icon size={18} stroke={1.8} />
                      </div>
                      <Title order={3} className={classes.utilityTitle}>
                        {tool.name}
                      </Title>
                    </div>
                    <Text className={classes.utilityDescription}>
                      {tool.description}
                    </Text>
                    <Anchor href={tool.path} className={classes.utilityLink}>
                      {tool.buttonLabel}
                    </Anchor>
                  </Card>
                );
              })}
            </div>
          </section>

        </Container>
      </div>
    </>
  );
}
