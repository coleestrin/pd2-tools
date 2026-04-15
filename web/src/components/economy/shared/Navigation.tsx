import { Box, Tabs, Text } from "@mantine/core";

export interface NavigationItem {
  label: string;
  value: string;
  path: string;
  iconUrl: string;
}

export interface NavigationSection {
  header: string;
  items: NavigationItem[];
}

interface NavigationProps {
  activeCategory: string;
  navItems: NavigationSection[];
  closeDrawer?: () => void;
  currentItemCategoryValue?: string;
  search?: string;
}

export function Navigation({
  activeCategory,
  navItems,
  closeDrawer,
  currentItemCategoryValue,
  search = "",
}: NavigationProps) {
  return (
    <Tabs
      color="gray"
      variant="pills"
      orientation="vertical"
      value={currentItemCategoryValue || activeCategory}
      styles={{
        root: { height: "100%" },
        list: {
          width: "100%",
          paddingRight: closeDrawer ? 0 : "1rem",
          borderRight: closeDrawer ? "none" : "2px solid #2C2E33",
          height: "100%",
        },
        tab: { width: "100%" },
      }}
    >
      <Tabs.List>
        {navItems.map((section, index) => (
          <Box
            key={section.header + index}
            mb={index < navItems.length - 1 ? "xs" : 0}
          >
            <Text
              size="sm"
              fw={700}
              c="dimmed"
              mb="xs"
              pl={closeDrawer ? "xs" : 0}
            >
              {section.header}
            </Text>
            {section.items.map((item) => (
              <Tabs.Tab
                key={item.value}
                value={item.value}
                leftSection={
                  <img
                    src={item.iconUrl}
                    alt={item.label}
                    width={32.5}
                    height={32.5}
                    style={{ objectFit: "contain" }}
                  />
                }
                component="a"
                href={`${item.path}${search}`}
                onClick={closeDrawer}
              >
                {item.label}
              </Tabs.Tab>
            ))}
          </Box>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
