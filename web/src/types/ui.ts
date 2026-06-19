import type { ReactNode } from "react";
import type {
  CharacterAttributes,
  CharacterStats,
  RealStats,
  Skill,
  MercenaryInfo,
  CharacterSnapshotListItem,
} from "./character";
import type { DamageCalculation } from "./damage";
import type { EconomyItem, PriceData } from "./economy";
import type { SkillsView, PlayerToggle } from "./constants";

// Character page components
export interface CharacterHeaderProps {
  characterName: string;
  className: string;
  level: number;
  lastUpdated?: string;
  isMobile: boolean;
  prevCharacter?: string | null;
  nextCharacter?: string | null;
  accountName?: string;
  isHardcore?: boolean;
  season?: number;
  snapshots?: CharacterSnapshotListItem[];
  selectedSnapshot: string | null;
  onSnapshotChange: (value: string | null) => void;
}

export interface EquipmentSectionProps {
  playerItems?: unknown[];
  mercenary?: MercenaryInfo;
  playerToggle: PlayerToggle;
  onPlayerToggleChange: (value: PlayerToggle) => void;
}

export interface StatsSectionProps {
  attributes: CharacterAttributes;
  stats: CharacterStats;
  realStats: RealStats;
}

export interface SkillsSectionProps {
  skills: Skill[];
  hasCta: boolean;
  skillsView: SkillsView;
  onSkillsViewChange: (value: SkillsView) => void;
}

export interface DamageCalculatorSectionProps {
  damageCalculation?: DamageCalculation;
  variant?: "full" | "compact";
  fullCalculatorUrl?: string;
  onOpenFullCalculator?: () => void;
}

// Economy components
export interface ItemsTableProps {
  items: EconomyItem[];
  isPending: boolean;
  category: string;
  search?: string;
}

export interface SortableTableHeaderProps {
  children: ReactNode;
  sorted: "asc" | "desc" | null;
  onSort: () => void;
}

export interface SparklineChartProps {
  data: PriceData[];
  width?: number;
  height?: number;
}

export interface CustomBreadcrumbsProps {
  category: string;
}

export interface NavigationProps {
  currentCategory: string;
}

// Builds components
export interface TransformedCharacterRow {
  name: string;
  level: number;
  class: string;
  life: number;
  items: string[];
  skills: string[];
  lastUpdated?: number;
}

// Shared components
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}
