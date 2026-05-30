export interface AdminAnalytics {
  users: {
    total: number;
    byTier: {
      BASIC: number;
      SPECIFIED: number;
      ACTIVE_CLIENT: number;
    };
    activeCoaches: number;
  };
  engagement: {
    workoutsCompletedLast7Days: number;
  };
  revenue: {
    estimatedMrrCents: number;
    activeClientCount: number;
    pricePerClientCents: number;
  };
  generatedAt: string;
}
