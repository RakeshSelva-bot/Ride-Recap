export type Stop = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
};

export type Activity = {
  type: string;
  startTime: Date;
  endTime: Date;
  distanceMeters?: number;
};

export type PathSegment = {
  startTime: Date;
  endTime: Date;
  points: { lat: number; lng: number }[];
};

export type Transaction = {
  datetime: Date;
  amount: number;
  merchant: string;
  raw: Record<string, string>;
};

export type MatchedStop = {
  stop: Stop;
  transactions: Transaction[];
  totalAmount: number;
};

export type Recap = {
  stops: MatchedStop[];
  unmatchedTransactions: Transaction[];
  totals: {
    stopCount: number;
    transactionCount: number;
    matchedCount: number;
    totalSpent: number;
    matchedSpent: number;
    distanceMeters: number;
  };
};
