export type Difficulty = 'main' | 'advanced' | 'mixed';
export type QuestionTag = 'tick' | 'circle' | 'cross' | 'unvisited';

export interface QuestionData {
  number: number;
  tag: QuestionTag;
  timeSpent: number; // cumulative time spent on this question in seconds
  visits: number;
}

export interface SessionConfig {
  subject: string;
  totalQuestions: number;
  durationMinutes: number;
  difficulty: Difficulty;
  stealthMode: boolean;
}

export interface SessionState {
  config: SessionConfig;
  status: 'config' | 'running' | 'paused' | 'completed';
  activeQuestionIndex: number; // 0-based index
  questions: QuestionData[];
  elapsedSeconds: number; // cumulative total time elapsed in seconds
}

export interface SavedSession {
  id: string;
  date: string; // ISO string or readable date
  config: SessionConfig;
  elapsedSeconds: number;
  questions: QuestionData[];
  metrics: {
    ticksCount: number;
    circlesCount: number;
    crossesCount: number;
    unvisitedCount: number;
    totalTimeTicks: number;
    totalTimeCircles: number;
    totalTimeCrosses: number;
    totalTimeUnvisited: number;
  };
}
