import {
  Card,
  Group,
  Title,
  rem,
  Anchor,
  Avatar,
  Text,
  Loader,
  SimpleGrid,
  Button,
} from "@mantine/core";
import { Helmet } from "react-helmet";
import { useEffect, useState } from "react";
import { GitHubIcon, DiscordIcon } from "../components/icons";

interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export default function AboutPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(
        "https://api.github.com/repos/coleestrin/pd2-character-downloader/contributors"
      ),
      fetch("https://api.github.com/repos/coleestrin/pd2-tools/contributors"),
    ])
      .then(([res1, res2]) => Promise.all([res1.json(), res2.json()]))
      .then(([data1, data2]) => {
        // Combine contributors from both repos
        const contributorsMap = new Map<string, Contributor>();

        [...data1, ...data2].forEach((contributor: Contributor) => {
          if (contributorsMap.has(contributor.login)) {
            const existing = contributorsMap.get(contributor.login)!;
            existing.contributions += contributor.contributions;
          } else {
            contributorsMap.set(contributor.login, { ...contributor });
          }
        });

        // Sort by contributions
        const combined = Array.from(contributorsMap.values()).sort(
          (a, b) => b.contributions - a.contributions
        );

        setContributors(combined);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching contributors:", err);
        setError("Unable to load contributors");
        setLoading(false);
      });
  }, []);

  return (
    <>
      <div
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <Helmet>
          <title>About - pd2.tools</title>
          <meta
            name="description"
            content="Learn more about pd2.tools - tools, stats, and resources for Project Diablo 2 players."
          />
        </Helmet>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            padding: `${rem(32)} ${rem(16)}`,
          }}
        >
          <Card
            withBorder
            shadow="sm"
            style={{
              maxWidth: "900px",
              width: "100%",
              padding: rem(32),
            }}
          >
            <Title
              order={1}
              style={{ marginBottom: rem(20), fontSize: rem(32) }}
            >
              About pd2.tools
            </Title>
            <Text size="md" style={{ lineHeight: 1.8, marginBottom: rem(16) }}>
              pd2.tools is a platform providing tools, stats, and resources for
              Project Diablo 2 players. We are not affiliated with the official
              Project Diablo 2 team.
            </Text>
            <Text size="md" style={{ lineHeight: 1.8, marginBottom: rem(16) }}>
              Discover builds, track the economy, export characters, and
              more—all powered by live data from the PD2 API. Our goal is to
              make your PD2 experience easier and more fun.
            </Text>
            <Title
              order={3}
              style={{ marginBottom: rem(8), fontSize: rem(18) }}
            >
              Credits
            </Title>
            <Text size="md" style={{ lineHeight: 1.8, marginBottom: rem(24) }}>
              pd2.tools takes inspiration from{" "}
              <Anchor
                href="https://poe.ninja/"
                target="_blank"
                rel="noopener noreferrer"
                fw={600}
              >
                poe.ninja
              </Anchor>
              ,{" "}
              <Anchor
                href="https://garmoth.com/"
                target="_blank"
                rel="noopener noreferrer"
                fw={600}
              >
                Garmoth
              </Anchor>
              , and{" "}
              <Anchor
                href="https://www.lastepochtools.com/"
                target="_blank"
                rel="noopener noreferrer"
                fw={600}
              >
                Last Epoch Tools
              </Anchor>
              . We’re also grateful to the{" "}
              <Anchor
                href="https://www.projectdiablo2.com/"
                target="_blank"
                rel="noopener noreferrer"
                fw={600}
              >
                Project Diablo 2 team
              </Anchor>{" "}
              for making the data that powers the site accessible.
            </Text>
            <Text size="md" style={{ lineHeight: 1.8, marginBottom: rem(24) }}>
              Need to contact us? The best way is via our{" "}
              <Anchor
                href="https://discord.gg/invite/TVTExqWRhK"
                target="_blank"
                rel="noopener noreferrer"
                fw={600}
              >
                Discord server
              </Anchor>
              . You can also add or DM{" "}
              <Text component="span" fw={700}>
                lamptricker
              </Text>{" "}
              on Discord directly or email{" "}
              <Anchor href="mailto:admin@pd2.tools" fw={600}>
                admin@pd2.tools
              </Anchor>
              .
            </Text>

            <Group gap="md" style={{ marginBottom: rem(16), flexWrap: "wrap" }}>
              <Button
                component="a"
                href="https://github.com/coleestrin/pd2-tools"
                target="_blank"
                leftSection={<GitHubIcon size={18} />}
                size="md"
                variant="default"
                style={{
                  backgroundColor: "#fff",
                  color: "#24292f",
                  borderColor: "#d0d7de",
                  fontWeight: 600,
                }}
              >
                pd2-tools
              </Button>
              <Button
                component="a"
                href="https://github.com/coleestrin/pd2-character-downloader"
                target="_blank"
                leftSection={<GitHubIcon size={18} />}
                size="md"
                variant="default"
                style={{
                  backgroundColor: "#fff",
                  color: "#24292f",
                  borderColor: "#d0d7de",
                  fontWeight: 600,
                }}
              >
                pd2-character-downloader
              </Button>
              <Button
                component="a"
                href="https://github.com/coleestrin/pd2-cz-tracker"
                target="_blank"
                leftSection={<GitHubIcon size={18} />}
                size="md"
                variant="default"
                style={{
                  backgroundColor: "#fff",
                  color: "#24292f",
                  borderColor: "#d0d7de",
                  fontWeight: 600,
                }}
              >
                pd2-cz-tracker
              </Button>

              <Button
                component="a"
                href="https://discord.gg/invite/TVTExqWRhK"
                target="_blank"
                leftSection={<DiscordIcon size={18} />}
                size="md"
                variant="filled"
                style={{
                  backgroundColor: "#5865F2",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Discord
              </Button>
            </Group>

            <div
              style={{
                borderTop: "1px solid var(--mantine-color-dark-4)",
                paddingTop: rem(24),
                marginTop: rem(8),
              }}
            >
              <Title
                order={2}
                style={{ marginBottom: rem(16), fontSize: rem(24) }}
              >
                Contributors
              </Title>
              <Text
                size="sm"
                style={{
                  marginBottom: rem(20),
                  color: "var(--mantine-color-dimmed)",
                }}
              >
                Thank you to everyone who has contributed to making pd2.tools
                better!
              </Text>

              {loading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: rem(40),
                  }}
                >
                  <Loader size="lg" />
                </div>
              ) : error ? (
                <Text c="red" ta="center" style={{ padding: rem(20) }}>
                  {error}
                </Text>
              ) : (
                <SimpleGrid
                  cols={{ base: 2, xs: 3, sm: 4, md: 5 }}
                  spacing="lg"
                >
                  {contributors.map((contributor) => (
                    <a
                      key={contributor.login}
                      href={contributor.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          padding: rem(12),
                          borderRadius: rem(8),
                          transition: "background-color 0.2s ease",
                          cursor: "pointer",
                        }}
                        className="contributor-card"
                      >
                        <Avatar
                          src={contributor.avatar_url}
                          size="lg"
                          radius="xl"
                          style={{ marginBottom: rem(8) }}
                        />
                        <Text
                          fw={600}
                          size="sm"
                          style={{ marginBottom: rem(4) }}
                        >
                          {contributor.login}
                        </Text>
                        {/*<Badge size="xs" variant="light" color="blue">
													{contributor.contributions}
												</Badge>*/}
                      </div>
                    </a>
                  ))}
                </SimpleGrid>
              )}
            </div>
          </Card>
        </div>
      </div>
      <style>{`
				.contributor-card:hover {
					background-color: var(--mantine-color-dark-6);
				}
			`}</style>
    </>
  );
}
