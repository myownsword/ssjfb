export interface Season {
  id: string;
  name: string;
  createdAt: number;
  isArchived: boolean;
  archivedAt?: number;
}

export interface Team {
  id: string;
  seasonId: string;
  name: string;
  isWithdrawn: boolean;
  withdrawnAt?: number;
  createdAt: number;
}

export interface Fixture {
  id: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  matchDate: number;
  round: number;
  createdAt: number;
}

export interface MatchResult {
  id: string;
  fixtureId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  isHomeForfeit: boolean;
  isAwayForfeit: boolean;
  createdAt: number;
}

export interface RankingSnapshot {
  id: string;
  seasonId: string;
  teamId: string;
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  forfeits: number;
  timestamp: number;
  matchResultId?: string;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  rank: number;
  previousRank?: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  forfeits: number;
  isWithdrawn: boolean;
}

export interface MatchImpact {
  matchResultId: string;
  opponentId: string;
  opponentName: string;
  homeScore: number;
  awayScore: number;
  isHome: boolean;
  pointsChange: number;
  pointsAfter: number;
  rankAfter: number;
  matchDate: number;
}

export interface Database {
  seasons: Season[];
  teams: Team[];
  fixtures: Fixture[];
  matchResults: MatchResult[];
  rankingSnapshots: RankingSnapshot[];
}
