/**
 * P-P-P (Problem-Pain-Priority) Prospect Research Components
 * 
 * Admin-only interface for scoring and researching prospects
 * using the P-P-P framework.
 */

export { default as IntelligenceResearcher } from './IntelligenceResearcher';
export { default as ProspectCard } from './ProspectCard';
export { default as PPPScoreForm } from './PPPScoreForm';
export { default as ResearchNotes } from './ResearchNotes';
export { default as PriorityQueue } from './PriorityQueue';

// Re-export types (rename to avoid conflicts)
export type {
  PPPScores,
  PPPProspect,
  PPPScoreFormData,
  ResearchNotes as PPPResearchNotesData,
  ResearchLogEntry,
  PPPSortField,
  PPPSortOrder,
  PPPFilters,
} from '../../../../types/ppp';
