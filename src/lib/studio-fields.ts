export interface RepeaterField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'checkbox' | 'textarea' | 'select';
  value?: string;
  placeholder?: string;
  required?: boolean;
  options?: readonly string[];
}
export interface RepeaterGroup {
  name: string;
  title: string;
  singular: string;
  note?: string;
  mode?: 'list';
  fields: readonly RepeaterField[];
}
export const guideStructureGroups: RepeaterGroup[] = [
  { name: 'takeaways', title: 'What the reader will learn', singular: 'takeaway', mode: 'list', note: 'Optional short outcomes. Put the decisions readers need to make first.', fields: [{ key: 'value', label: 'Takeaway', required: true }] },
  { name: 'prerequisites', title: 'Before you start', singular: 'requirement', mode: 'list', note: 'Tools, playback requirements or source assumptions readers need to know.', fields: [{ key: 'value', label: 'Requirement', type: 'textarea', required: true }] },
  { name: 'presets', title: 'Preset choices and commands', singular: 'preset', note: 'Optional. Explain the goal and tradeoff in plain language. Keep exact commands separate from the guide body.', fields: [
    { key: 'title', label: 'Reader-friendly name', required: true, placeholder: 'Balanced HEVC' },
    { key: 'label', label: 'Original preset name / version', placeholder: 'Compression Apex · v1.0' },
    { key: 'codec', label: 'Codec', placeholder: 'x265 / HEVC 10-bit' },
    { key: 'goal', label: 'Use this when…', required: true },
    { key: 'tradeoff', label: 'Tradeoff', required: true, type: 'textarea' },
    { key: 'compatibility', label: 'Playback requirements', type: 'textarea' },
    { key: 'language', label: 'Command shell', type: 'select', options: ['Command Prompt', 'PowerShell', 'Bash', 'Plain text'], value: 'Command Prompt' },
    { key: 'command', label: 'Exact command', type: 'textarea', required: true },
    { key: 'notes', label: 'Command notes', type: 'textarea' },
    { key: 'recommended', label: 'Mark as the starting point', type: 'checkbox' },
  ] },
];
