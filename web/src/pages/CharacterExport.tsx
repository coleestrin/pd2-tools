import { Helmet } from "react-helmet";
import { useMutation } from "@tanstack/react-query";
import {
  Card,
  Text,
  TextInput,
  Button,
  Container,
  rem,
  Anchor,
  Accordion,
  Image,
  Center,
  Box,
} from "@mantine/core";
import { IconAlertTriangle, IconDownload } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { useState } from "react";
import { charactersAPI } from "../api";

const MAINTAINED_EXPORTER_URL =
  "https://exiledagain.github.io/bug-free-eureka/export.html";
const ARCHIVED_EXPORTER_REPO_URL =
  "https://github.com/coleestrin/pd2-character-downloader";

const faq = [
  {
    value: "How does this tool work?",
    description:
      "The tool copies all of a characters items, skills, stats and mercenary from the armory. It then generates a save file with all of these stats and items.",
  },
  {
    value: "Do the exported characters work on PlugY?",
    description:
      "Yes, the save files work on both normal singleplayer (no PlugY) and singleplayer with PlugY.",
  },
  {
    value: "Can I export non-ladder characters?",
    description:
      "Yes, you can export any character with an armory, both non-ladder and ladder.",
  },
  {
    value: "What is included in character's the inventory and stash?",
    description: (
      <>
        The inventory includes full rejuvenation potions, a cube, and a Horadric
        Almanac and Navigator.
        <br />
        <br />
        The stash has everything needed for testing builds or bosses, see the
        image below.
        <br />
        <br />
        <Center>
          <Image src={"../export-stash.png"} w={"60%"} h={"60%"} />
        </Center>
      </>
    ),
  },
  {
    value: "I get an error when exporting a character, why?",
    description: (
      <>
        1) You did not enter the characters name correctly.
        <br />
        <br />
        2) The characters armory is bugged, you can determine this by going to{" "}
        <Anchor
          href="https://projectdiablo2.com/character/CHARACTER_NAME_HERE"
          target="_blank"
          rel="noopener noreferrer"
        >
          projectdiablo2.com/character/CHARACTER_NAME_HERE
        </Anchor>{" "}
        and seeing if there is an error when you open the page, or if the life
        or mana are blank with no value.
        <br />
        <br />
        3) The server is down.
        <br />
        <br />
        If you can't seem to export a character and you believe you should be
        able to, then you can post the character name in the #bug-report channel
        on{" "}
        <Anchor
          href="https://discord.com/invite/TVTExqWRhK"
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord
        </Anchor>{" "}
        and I can pinpoint the error.
      </>
    ),
  },
];

export default function CharacterExport() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [characterName, setCharacterName] = useState("");
  const [error, setError] = useState("");

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (name: string) => {
      const base64Data = await charactersAPI.exportCharacter(name);

      // Validate the Base64 string
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
        throw new Error("Invalid Base64 data received");
      }

      return base64Data;
    },
    onError: (err: Error) => {
      console.error("Character export failed:", err);
      setError(
        err.message.includes("HTTP error")
          ? "Character not found or server error"
          : err.message.includes("Invalid Base64")
            ? "Invalid file data received"
            : "An unexpected error occurred"
      );
    },
    onSuccess: (base64Data) => handleDownload(base64Data),
  });

  const handleDownload = (base64Data: string) => {
    try {
      // Convert Base64 to binary
      const binaryString = atob(base64Data);
      const byteArray = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
      }

      // Create Blob and trigger download
      const blob = new Blob([byteArray], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${characterName}.d2s`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setError("");
    } catch (err) {
      console.error("Failed to download file:", err);
      setError("Failed to create get file. Please try again.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!characterName.trim()) {
      setError("Please enter a valid character name");
      return;
    }
    mutateAsync(characterName.trim());
  };

  return (
    <>
      <Helmet>
        <title>Character Exporter - pd2.tools</title>
        <meta
          name="description"
          content="Convert any Project Diablo 2 multiplayer character to single player to learn bosses or try out new builds"
        />
      </Helmet>

      <Container size={rem(900)} px={isMobile ? rem(20) : rem(40)} mb={rem(20)}>
        <Box pos="relative">
          <Box
            style={{
              filter: "blur(4px)",
              opacity: 0.45,
              pointerEvents: "none",
            }}
          >
            <Center>
              <Accordion variant="contained" mb={"md"} maw={rem(600)} w={"100%"}>
                <Accordion.Item value="disclaimer">
                  <Accordion.Control
                    icon={<IconAlertTriangle size="1rem" color="orange" />}
                    styles={(theme) => ({
                      control: {
                        backgroundColor:
                          theme.colorScheme === "dark"
                            ? theme.colors.dark[5]
                            : theme.colors.gray[1],
                        "&:hover": {
                          backgroundColor:
                            theme.colorScheme === "dark"
                              ? theme.colors.dark[5]
                              : theme.colors.gray[1],
                        },
                      },
                      chevron: {},
                    })}
                  >
                    <Text fw={500}>Disclaimer</Text>
                  </Accordion.Control>
                  <Accordion.Panel />
                </Accordion.Item>
              </Accordion>
            </Center>

            <Card
              shadow="sm"
              padding="md"
              mx="auto"
              maw={rem(600)}
              withBorder
              mb={"md"}
            >
              <Text size="lg" fw={600} align="center" mb={rem(4)}>
                Character Export Instructions
              </Text>
              <Text size="sm" c="dimmed" align="center" mb="md">
                1. Enter your character name below
                <br />
                2. Click export button
                <br />
                3. Move file to your Diablo II save folder (Ex. C:/Program Files
                (x86)/Diablo II/Save)
              </Text>

              <form onSubmit={handleSubmit}>
                <TextInput
                  value={characterName}
                  onChange={(e) => setCharacterName(e.currentTarget.value)}
                  placeholder="Enter a PD2 character name"
                  label="Character name"
                  required
                  mb="md"
                  error={error}
                />

                <Button
                  fullWidth
                  type="submit"
                  leftSection={<IconDownload size="1rem" />}
                  variant="light"
                  loading={isPending}
                  disabled={isPending}
                >
                  Export .d2s File
                </Button>
              </form>
            </Card>

            <Card shadow="sm" padding="md" mx="auto" maw={rem(600)} withBorder>
              <Text size="lg" fw={600} align="center" mb={rem(12)}>
                Frequently Asked Questions
              </Text>
              <Accordion variant="separated">
                {faq.map((item) => (
                  <Accordion.Item key={item.value} value={item.value}>
                    <Accordion.Control style={{ border: `1px solid #373a40` }}>
                      {item.value}
                    </Accordion.Control>
                    <Accordion.Panel>{item.description}</Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card>
          </Box>

          <Center
            style={{
              position: "absolute",
              inset: 0,
              padding: rem(24),
            }}
          >
            <Card
              withBorder
              shadow="md"
              padding="lg"
              maw={rem(520)}
              w="100%"
            >
              <Text fw={700} size="lg" mb="xs">
                Character Exporter Archived
              </Text>
              <Text size="sm" mb="md">
                The pd2.tools character exporter is no longer maintained. For
                working character downloads, use Dominis&apos;s character
                exporter.
              </Text>
              <Text size="xs" c="dimmed" mb="md">
                Interested in the original exporter code? The archived
                pd2.tools exporter source is still{" "}
                <Anchor
                  href={ARCHIVED_EXPORTER_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  available on GitHub
                </Anchor>
                .
              </Text>
              <Button
                component="a"
                href={MAINTAINED_EXPORTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconDownload size="1rem" />}
              >
                Open Dominis&apos;s Exporter
              </Button>
            </Card>
          </Center>
        </Box>
      </Container>
    </>
  );
}
