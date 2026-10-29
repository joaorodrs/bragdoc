export type EvidenceEntry = {
  id: string;
  text: string;
  occurredAt: string;
};

export type JournalEntry = EvidenceEntry & {
  createdAt: string;
  updatedAt: string;
  localDate?: string;
};

export type AchievementFields = {
  contextProblem: string;
  myAction: string;
  resultImpact: string;
  competencies: string;
  periodStart: string;
  periodEnd: string;
};

export type Achievement = AchievementFields & {
  id: string;
  source: 'manual' | 'ai';
  evidence: JournalEntry[];
  createdAt: string;
  updatedAt: string;
};

export type AchievementSuggestion = AchievementFields & {
  id: string;
  status: 'pending' | 'accepted' | 'discarded';
  evidence: JournalEntry[];
  createdAt: string;
};

export const emptyAchievement: AchievementFields = {
  contextProblem: '',
  myAction: '',
  resultImpact: '',
  competencies: '',
  periodStart: '',
  periodEnd: '',
};
