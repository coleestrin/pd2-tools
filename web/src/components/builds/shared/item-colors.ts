export const getItemTypeBaseColor = (type: string): string => {
  switch (type) {
    case "Unique":
      return "#c17d3a";
    case "Set":
      return "#1eed0e";
    case "Runeword":
      return "#FACC15";
    default:
      return "#6b7280";
  }
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

export const getBrightBorderColor = (type: string): string => {
  const baseColor = getItemTypeBaseColor(type);
  const { r, g, b } = hexToRgb(baseColor);

  if (type === "Runeword") {
    const darken = (val: number) => Math.floor(val * 0.85);
    return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
  }

  const brighten = (val: number) => Math.min(255, Math.floor(val * 1.3));
  return `rgb(${brighten(r)}, ${brighten(g)}, ${brighten(b)})`;
};

export const getDarkBackgroundColor = (type: string): string => {
  const baseColor = getItemTypeBaseColor(type);
  const { r, g, b } = hexToRgb(baseColor);
  return `rgba(${r}, ${g}, ${b}, 0.18)`;
};
