
export interface UpcomingEvent {
  date: string;
  time: string;
  event: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface DailyAnalysis {
  recap: string;
  todayOutlook: string;
}

export interface TechnicalAnalysis {
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  reasoning: string;
}

export interface SummaryData {
  fundamentalNews: string;
  upcomingEvents: UpcomingEvent[];
  dailyAnalysis: DailyAnalysis;
  technicalAnalysis: TechnicalAnalysis;
  correlatedSummary: string;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface TradingPair {
  name: string;
  symbol: string;
}