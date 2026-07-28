import { z } from 'zod';
import { ruleCreateSchema } from '../api/schemas';
import type { RuleAction } from '../types/api';

export type RuleActionFormValue = z.input<typeof ruleCreateSchema>['actions'][number];

export function toRuleActions(actions: RuleActionFormValue[]): RuleAction[] {
  return actions.map((action) => ({
    actionType: action.actionType,
    templateId: action.templateId,
    channel: action.channel,
    payload: action.payload,
    delayMinutes: action.delayMinutes ?? 0,
  }));
}

export function fromRuleActions(actions: RuleAction[]): RuleActionFormValue[] {
  return actions.map((action) => ({
    actionType: action.actionType,
    templateId: action.templateId,
    channel: action.channel,
    payload: action.payload,
    delayMinutes: action.delayMinutes ?? 0,
  }));
}
