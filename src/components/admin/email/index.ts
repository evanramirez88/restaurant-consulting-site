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
