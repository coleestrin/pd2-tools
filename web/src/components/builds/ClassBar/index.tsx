import React, { useRef, useState } from "react";
import {
  Card,
  Select,
  Button,
  Flex,
  Text,
  SimpleGrid,
  TextInput,
  ActionIcon,
  Modal,
  RangeSlider,
  Tooltip,
  Alert,
} from "@mantine/core";
import {
  IconX,
  IconSettings,
  IconInfoCircle,
  IconUserPlus,
} from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import Cookies from "js-cookie";
import debounce from "lodash/debounce";
import { accountsAPI } from "../../../api";
import type { BuildsComponentProps } from "../types";
import {
  CURRENT_SEASON,
  DEFAULT_VIEW_SEASON,
  LEVEL_RANGE_COOKIE_KEY,
  SEASON_OPTIONS,
} from "../../../types";

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  minLevel: number;
  maxLevel: number;
  onLevelChange: (min: number, max: number) => void;
}

function SettingsModal({
  opened,
  onClose,
  minLevel,
  maxLevel,
  onLevelChange,
}: SettingsModalProps) {
  const debouncedChange = useRef(
    debounce((value: [number, number]) => {
      onLevelChange(value[0], value[1]);
      Cookies.set(
        LEVEL_RANGE_COOKIE_KEY,
        JSON.stringify({ min: value[0], max: value[1] }),
        { expires: 365 }
      );
    }, 500)
  ).current;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Settings"
      size="sm"
      styles={{
        title: { fontWeight: 600 },
        body: { paddingTop: 5 },
        content: { minHeight: "200px" },
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <Text fw={700} size="sm" style={{ lineHeight: 1 }}>
            Character Level Range
          </Text>
          <Tooltip
            label="Inclusive level range (from-to) (default 80-99)"
            position="right"
          >
            <div
              style={{
                marginLeft: "5px",
                cursor: "help",
                display: "flex",
                alignItems: "center",
              }}
            >
              <IconInfoCircle size={16} />
            </div>
          </Tooltip>
        </div>
        <RangeSlider
          min={80}
          max={99}
          minRange={0}
          defaultValue={[minLevel, maxLevel]}
          onChangeEnd={debouncedChange}
          marks={[
            { value: 80, label: "80" },
            { value: 90, label: "90" },
            { value: 99, label: "99" },
          ]}
        />
      </div>
    </Modal>
  );
}

interface AccountQueueModalProps {
  opened: boolean;
  onClose: () => void;
}

function AccountQueueModal({ opened, onClose }: AccountQueueModalProps) {
  const queueDisabled = CURRENT_SEASON !== DEFAULT_VIEW_SEASON;
  const [accountName, setAccountName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [queuedAccountName, setQueuedAccountName] = useState<string | null>(
    null
  );
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsLoading(true);
    setQueuedAccountName(null);
    setEstimatedTime(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await accountsAPI.queueAccount(accountName);

      // Format estimated time
      const estimatedMinutes = Math.ceil(response.estimatedSeconds / 60);
      const timeString =
        estimatedMinutes > 1
          ? `${estimatedMinutes} minutes`
          : `${response.estimatedSeconds} seconds`;

      setQueuedAccountName(response.accountName);
      setEstimatedTime(timeString);
      setSuccessMessage(response.message);
      setAccountName("");
    } catch (error: any) {
      setErrorMessage(
        error.data?.error || error.message || "Failed to queue account"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAccountName("");
    setQueuedAccountName(null);
    setEstimatedTime(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Add Account to Scrape Queue"
      size="md"
      styles={{
        title: { fontWeight: 600 },
        body: { paddingTop: 10 },
      }}
    >
      <div>
        <Text size="sm" mb="md" c="dimmed">
          Enter an <strong>account name</strong> (not character name) to add it
          to pd2.tools. All ladder characters level 80+ on this account will be
          added to the website.
        </Text>

        <TextInput
          label="Account Name (NOT character name)"
          placeholder="Enter account name"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          disabled={isLoading || queueDisabled}
          mb="md"
        />

        {queuedAccountName && estimatedTime && successMessage && (
          <Alert color="green" mb="md">
            <Text size="sm" mb="xs">
              {successMessage}. Characters will be processed in approximately{" "}
              <strong>{estimatedTime}</strong>.
            </Text>
            <Text size="sm">
              After that time, check your characters at:{" "}
              <a
                href={`/builds/account/${queuedAccountName}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", fontWeight: 600 }}
              >
                /builds/account/{queuedAccountName}
              </a>
            </Text>
          </Alert>
        )}

        {errorMessage && (
          <Alert color="red" mb="md">
            {errorMessage}
          </Alert>
        )}

        <Flex gap="sm" justify="flex-end">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!accountName.trim() || isLoading || queueDisabled}
            loading={isLoading}
          >
            Add to Queue
          </Button>
        </Flex>
      </div>
    </Modal>
  );
}

export default function ClassBar({
  data,
  filters,
  updateFilters,
}: BuildsComponentProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [searchInput, setSearchInput] = useState(filters.searchQuery);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [accountQueueOpened, setAccountQueueOpened] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

  const handleGameModeChange = (value: string | null) => {
    if (value) {
      updateFilters({ gameMode: value.toLowerCase() });
    }
  };

  const handleSeasonChange = (value: string | null) => {
    if (value) {
      updateFilters({ season: parseInt(value, 10) });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      updateFilters({ searchQuery: value });
    }, 300);
  };

  const handleSearchClear = () => {
    setSearchInput("");
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    updateFilters({ searchQuery: "" });
  };

  const handleResetFilters = () => {
    setSearchInput("");
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    updateFilters({
      classFilter: [],
      itemFilter: [],
      skillFilter: [],
      mercTypeFilter: [],
      mercItemFilter: [],
      searchQuery: "",
    });
  };

  return (
    <SimpleGrid cols={1} spacing="md">
      <Card
        withBorder
        w="100%"
        h="75px"
        py="xs"
        px="sm"
        style={{
          boxShadow:
            "0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.2)",
        }}
      >
        <Flex
          gap="sm"
          justify="space-between"
          align="center"
          direction="row"
          h="100%"
        >
          <Flex direction="column" style={{ width: "33%" }}>
            <Text size="xs" fw={500} mb={4}>
              Season
            </Text>
            <Select
              placeholder="Select Season"
              data={SEASON_OPTIONS}
              value={filters.season.toString()}
              onChange={handleSeasonChange}
              style={{ width: "100%" }}
            />
          </Flex>

          <Flex direction="column" style={{ width: "33%" }}>
            <Text size="xs" fw={500} mb={4}>
              Game Mode
            </Text>
            <Select
              placeholder="Select Game Mode"
              data={[
                { value: "softcore", label: "Softcore" },
                { value: "hardcore", label: "Hardcore" },
              ]}
              value={filters.gameMode}
              onChange={handleGameModeChange}
              style={{ width: "100%" }}
            />
          </Flex>

          <Flex direction="column" style={{ width: "33%" }}>
            <Text size="xs" fw={500} mb={4}>
              Time Machine
            </Text>
            <Select
              placeholder="Select Snapshot"
              data={[{ value: "Latest Snapshot", label: "Latest Snapshot" }]}
              defaultValue="Latest Snapshot"
              style={{ width: "100%" }}
            />
          </Flex>
        </Flex>
      </Card>

      <div style={{ display: isMobile ? "block" : "flex", gap: "16px" }}>
        <Card
          withBorder
          style={{
            width: isMobile ? "100%" : "185px",
            height: "60px",
            boxShadow:
              "0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)",
            marginBottom: isMobile ? "16px" : "0",
          }}
        >
          <Flex justify="center" align="center" h="100%">
            <TextInput
              placeholder="Search filters..."
              rightSection={
                searchInput ? (
                  <ActionIcon
                    variant="transparent"
                    color="gray"
                    onClick={handleSearchClear}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                ) : null
              }
              value={searchInput}
              onChange={handleSearchChange}
              style={{ width: "100%" }}
            />
          </Flex>
        </Card>
        <Card
          withBorder
          style={{
            flex: isMobile ? "none" : 1,
            width: isMobile ? "100%" : "auto",
            height: "60px",
            boxShadow:
              "0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.2)",
          }}
        >
          <Flex align="center" justify="space-between" h="100%">
            {!isMobile && (
              <Text>
                Found{" "}
                <Text span fw={700}>
                  {data.breakdown.total?.toLocaleString()}
                </Text>{" "}
                characters
              </Text>
            )}
            <Flex gap="md" style={{ marginLeft: isMobile ? "0" : "auto" }}>
              <Button
                variant="outline"
                onClick={() => setSettingsOpened(true)}
                leftSection={<IconSettings size={16} />}
              >
                Settings
              </Button>
              {!isMobile && (
                <Button
                  variant="outline"
                  onClick={() => setAccountQueueOpened(true)}
                  leftSection={<IconUserPlus size={16} />}
                >
                  Add Account
                </Button>
              )}
              <Button
                variant="outline"
                color="red"
                onClick={handleResetFilters}
              >
                Reset All Filters
              </Button>
            </Flex>
          </Flex>
        </Card>
      </div>
      <SettingsModal
        opened={settingsOpened}
        onClose={() => setSettingsOpened(false)}
        minLevel={filters.minLevel}
        maxLevel={filters.maxLevel}
        onLevelChange={(min, max) =>
          updateFilters({ minLevel: min, maxLevel: max })
        }
      />
      <AccountQueueModal
        opened={accountQueueOpened}
        onClose={() => setAccountQueueOpened(false)}
      />
    </SimpleGrid>
  );
}
