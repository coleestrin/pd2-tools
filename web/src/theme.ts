import { createTheme, type MantineColorsTuple } from "@mantine/core";

const dark: MantineColorsTuple = [
  "#C1C2C5",
  "#A6A7AB",
  "#909296",
  "#5C5F66",
  "#373A40",
  "#2C2E33",
  "#25262B",
  "#1A1B1E",
  "#141517",
  "#101113",
];

export const customDarkTheme = createTheme({
  colorScheme: "dark",
  colors: {
    dark,
  },
  primaryColor: "blue",
});

export const THEME_COLORS = {
  red: "var(--mantine-color-red-5)",
  blue: "var(--mantine-color-blue-5)",
  green: "var(--mantine-color-green-5)",
  orange: "var(--mantine-color-orange-5)",
  yellow: "var(--mantine-color-yellow-5)",
  cyan: "var(--mantine-color-cyan-5)",
  grape: "var(--mantine-color-grape-5)",
  violet: "var(--mantine-color-violet-5)",
  gray: "var(--mantine-color-gray-5)",
  white: "var(--mantine-color-white)",
} as const;
