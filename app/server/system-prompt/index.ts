import { basePrompt } from './base';
import { domainsPrompt } from './domains';
import { deliverablesPrompt } from './deliverables';
import { curriculumPrompt } from './curriculum';

export function buildSystemPrompt(): string {
  return [basePrompt, domainsPrompt, deliverablesPrompt, curriculumPrompt].join('\n\n');
}
