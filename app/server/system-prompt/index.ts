import { basePrompt } from './base.js';
import { domainsPrompt } from './domains.js';
import { deliverablesPrompt } from './deliverables.js';
import { curriculumPrompt } from './curriculum.js';

export function buildSystemPrompt(): string {
  return [basePrompt, domainsPrompt, deliverablesPrompt, curriculumPrompt].join('\n\n');
}
