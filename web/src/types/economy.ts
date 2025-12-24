// Price data point for charts/history
export interface PriceData {
  price: number;
  date?: string;
  numListings: number;
}

// Economy item with price history
export interface EconomyItem {
  item_name: string;
  price_data: PriceData[];
  category: string;
  wiki_link?: string;
  icon_url: string;
  last_7d_pct?: string;
}

export interface EconomyListing {
  id?: number;
  bumpedTs: number;
  itemName: string;
  username: string;
  priceStr: string;
  numericalPrice: number | null;
  quantity: number;
  dataDate: string;
  ingestionDate: string;
  season: number;
}

export interface EconomyItemSummary {
  itemName: string;
  totalListings: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  lastSeen: string;
}

export interface EconomyItemWithPriceData {
  item_name: string;
  price_data: PriceData[];
}

export interface EconomyOverviewResponse {
  items: EconomyItemWithPriceData[];
  totalListings: number;
  lastUpdated: string;
}

export interface EconomyItemDetailResponse {
  allListings: EconomyListing[];
  dataByIngestionDate: Array<{
    trueDate: string;
    price: number;
    numListings: number;
  }>;
}

export interface ListingsCountResponse {
  total: number;
  bySeason: Record<string, number>;
}

