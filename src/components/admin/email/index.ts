// Email Campaign Management Components
export { default as EmailCampaigns } from './EmailCampaigns';
export { default as CampaignEditor } from './CampaignEditor';

// Subscriber Management Components
export { default as EmailSubscribers } from './EmailSubscribers';
export { default as SubscriberDetail } from './SubscriberDetail';
export { default as SubscriberImport } from './SubscriberImport';

// Segment Management Components
export { default as SegmentBuilder } from './SegmentBuilder';

// Template and Step Editors
export { default as EmailTemplateEditor } from './EmailTemplateEditor';
export { default as SequenceStepEditor } from './SequenceStepEditor';
export { default as TokenInserter, EMAIL_TOKENS } from './TokenInserter';

// Preview Components (Day 2)
export { default as TemplatePreview } from './TemplatePreview';

// Condition Builder (Day 2 - Enhanced)
export { default as ConditionBuilder, createDefaultBranchConfig } from './ConditionBuilder';

// Analytics Dashboard
export { default as EmailAnalytics } from './EmailAnalytics';

// A/B Testing (Day 3)
export { default as ABTestingPanel } from './ABTestingPanel';
export {
  confidenceInterval,
  calculateSignificance,
  minimumSampleSize
} from './ABTestingPanel';

// Send Time Optimizer (Day 3)
export { default as SendTimeOptimizer } from './SendTimeOptimizer';

// Enrollment Wizard (Day 3)
export { default as EnrollmentWizard } from './EnrollmentWizard';

// Error Recovery (Day 3)
export { default as ErrorRecovery } from './ErrorRecovery';

// Sequence Flow Tester (Day 3)
export { default as SequenceFlowTester } from './SequenceFlowTester';

// Type exports
export type { EmailSequence } from './EmailCampaigns';
export type { EmailTemplate } from './EmailTemplateEditor';
export type {
  StepType,
  DelayUnit,
  ConditionType,
  ConditionAction,
  SequenceStep
} from './SequenceStepEditor';
export type {
  Segment,
  SegmentCondition,
  SegmentConditionGroup
} from './SegmentBuilder';
export type {
  SampleData,
  PreviewMode
} from './TemplatePreview';
export type {
  ConditionCategory,
  EmailEngagementConditionType,
  TimeBasedConditionType,
  SubscriberAttributeConditionType,
  Condition,
  ConditionGroup,
  BranchConfig
} from './ConditionBuilder';
export type {
  ABTestStatus,
  TestType,
  WinningMetric,
  ABTest,
  ABTestStats,
  VariantStats,
  SignificanceResult
} from './ABTestingPanel';
