import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAi } from '../../stores/ai-store';
import { streamCompletion } from '../../api/ai-client';
import type { ProviderKey, ProviderConfig } from '../../stores/slices/ai-slice';
import type { RegionCode, CurriculumTrack, CurriculumLevel } from '../../types/ledger';
import { InputField } from '../ui/InputField';
import { SelectField } from '../ui/SelectField';
import { TextAreaField } from '../ui/TextAreaField';
import { Loader2, Save, Sparkles } from 'lucide-react';

const curriculumFormSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(500, 'Topic too long'),
  track: z.enum(['quality', 'compliance', 'finance', 'logistics']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  regionCode: z.enum([
    'VN-DKL', 'VN-LDG', 'VN-GLA', 'ET-SNNP', 'ET-ORO', 'UG-BUG', 'CO-HUI', 'PE-JUN',
  ]),
  generatedOutline: z.string().optional(),
  lessonContent: z.string().optional(),
  quizQuestions: z.string().optional(),
});

export type CurriculumFormValues = z.infer<typeof curriculumFormSchema>;

const trackOptions: { value: CurriculumTrack; label: string }[] = [
  { value: 'quality', label: 'Quality' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'finance', label: 'Finance' },
  { value: 'logistics', label: 'Logistics' },
];

const levelOptions: { value: CurriculumLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const regionOptions: { value: RegionCode; label: string }[] = [
  { value: 'VN-DKL', label: 'VN-DKL (Dak Lak, Vietnam)' },
  { value: 'VN-LDG', label: 'VN-LDG (Lam Dong, Vietnam)' },
  { value: 'VN-GLA', label: 'VN-GLA (Gia Lai, Vietnam)' },
  { value: 'ET-SNNP', label: 'ET-SNNP (Southern Nations, Ethiopia)' },
  { value: 'ET-ORO', label: 'ET-ORO (Oromia, Ethiopia)' },
  { value: 'UG-BUG', label: 'UG-BUG (Bugisu, Uganda)' },
  { value: 'CO-HUI', label: 'CO-HUI (Huila, Colombia)' },
  { value: 'PE-JUN', label: 'PE-JUN (Junín, Peru)' },
];

const emptyDefaults: CurriculumFormValues = {
  topic: '',
  track: 'quality',
  level: 'beginner',
  regionCode: 'VN-DKL',
  generatedOutline: '',
  lessonContent: '',
  quizQuestions: '',
};

export interface CurriculumFormProps {
  onSubmit: (data: CurriculumFormValues) => void | Promise<void>;
  defaultValues?: Partial<CurriculumFormValues>;
}

export const CurriculumForm: React.FC<CurriculumFormProps> = ({ onSubmit, defaultValues }) => {
  const { t } = useTranslation(['curriculum', 'common']);
  const ai = useAi();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    outline: string;
    lessonContent: string;
    quizQuestions: string;
  } | null>(null);

  const methods = useForm<CurriculumFormValues>({
    resolver: zodResolver(curriculumFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  const { handleSubmit, setValue } = methods;

  const handleGenerate = async () => {
    const topic = methods.getValues('topic');
    const track = methods.getValues('track');
    const level = methods.getValues('level');
    const region = methods.getValues('regionCode');

    if (!topic) {
      return;
    }

    setIsGenerating(true);

    // Build the AI prompt using the curriculum authoring patterns
    const systemPrompt = `You are a curriculum authoring assistant for the Auctum Ledger platform. Generate a module outline, lesson content, and quiz questions for a coffee education curriculum. Output each section as JSON enclosed in triple backticks, then a markdown lesson content section separated by a horizontal rule.`;

    const userPrompt = `Generate a complete curriculum module with the following parameters:
- Topic: ${topic}
- Track: ${track}
- Level: ${level}
- Region: ${region}

Please provide:
1. A module outline in JSON format (id, title, description, level, prerequisites, regionCode, track, lessons array)
2. Lesson content in markdown format (with Objective, Key Concepts, Practical Walkthrough, Knowledge Check sections)
3. Quiz questions in JSON array format (question, options array, correctAnswerIndex, explanation)

Map lessons to verification tiers: self_declared for beginner, agent_verified for intermediate, audit_verified for advanced.`;

    const providerEntries = Object.entries(ai.providers) as [ProviderKey, ProviderConfig][];
    const found = providerEntries.find(([, cfg]) => cfg.enabled);
    const providerKey = found ? found[0] : 'deepseek';
    const config = ai.providers[providerKey];

    let collectedText = '';

    try {
      if (!config.apiKey) {
        setGeneratedContent({
          outline: 'Please configure an AI provider API key in the agent settings.',
          lessonContent: '',
          quizQuestions: '',
        });
        return;
      }

      for await (const event of streamCompletion({
        provider: providerKey,
        model: config.model,
        apiKey: config.apiKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })) {
        if (event.chunk) {
          collectedText += event.chunk;
        }
        if (event.error) {
          collectedText += `\n\nError: ${event.error}`;
          break;
        }
        if (event.done) break;
      }

      // Parse the collected response into sections
      const outlineMatch = collectedText.match(/```json\s*([\s\S]*?)\s*```/);
      const lessonMatch = collectedText.match(/---\s*\n([\s\S]*?)(?:```json|\n\n##|\n\n###|\n\n1\.|$)/);
      const quizMatch = collectedText.match(/```json\s*([\s\S]*?)\s*```([\s\S]*?)\n\n```json\s*([\s\S]*?)\s*```/);

      setGeneratedContent({
        outline: outlineMatch ? outlineMatch[1].trim() : collectedText,
        lessonContent: lessonMatch ? lessonMatch[1].trim() : '',
        quizQuestions: quizMatch ? quizMatch[3].trim() : '',
      });

      // Populate form fields with generated content
      setValue('generatedOutline', outlineMatch ? outlineMatch[1].trim() : collectedText);
      setValue('lessonContent', lessonMatch ? lessonMatch[1].trim() : '');
      setValue('quizQuestions', quizMatch ? quizMatch[3].trim() : '');
    } catch (error) {
      setGeneratedContent({
        outline: `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lessonContent: '',
        quizQuestions: '',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFormSubmit = async (data: CurriculumFormValues) => {
    const finalOutline = data.generatedOutline || generatedContent?.outline || '';
    const finalLesson = data.lessonContent || generatedContent?.lessonContent || '';
    const finalQuiz = data.quizQuestions || generatedContent?.quizQuestions || '';

    const enrichedData: CurriculumFormValues = {
      ...data,
      generatedOutline: finalOutline,
      lessonContent: finalLesson,
      quizQuestions: finalQuiz,
    };

    await onSubmit(enrichedData);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <InputField
          name="topic"
          label={t('curriculum.authoring.topicLabel', 'Topic / Description')}
          placeholder={t('curriculum.authoring.topicPlaceholder', 'Describe the module you want to generate...')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SelectField
            name="track"
            label={t('curriculum.authoring.trackLabel', 'Track')}
            options={trackOptions}
          />
          <SelectField
            name="level"
            label={t('curriculum.authoring.levelLabel', 'Level')}
            options={levelOptions}
          />
          <SelectField
            name="regionCode"
            label={t('curriculum.authoring.regionLabel', 'Region')}
            options={regionOptions}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !methods.getValues('topic')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 disabled:opacity-50 text-white rounded-md text-sm font-semibold shadow-e1 transition-all focus-visible:ring-2 focus-visible:ring-teal"
            data-testid="generate-btn"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {t('curriculum.authoring.generateBtn', 'Generate with AI')}
          </button>
        </div>

        {generatedContent && (
          <div className="bg-gold/5 border border-gold/20 rounded-lg p-4 space-y-3" data-testid="generated-content">
            <h3 className="text-sm font-semibold text-ink font-sans">{t('curriculum.authoring.generated', 'AI-Generated Content')}</h3>
            <TextAreaField name="generatedOutline" label={t('curriculum.authoring.outlineLabel', 'Module Outline')} />
            <TextAreaField name="lessonContent" label={t('curriculum.authoring.contentLabel', 'Lesson Content')} />
            <TextAreaField name="quizQuestions" label={t('curriculum.authoring.quizLabel', 'Quiz Questions')} />
          </div>
        )}

        {!generatedContent && (
          <div className="space-y-3" data-testid="manual-edit-section">
            <TextAreaField name="generatedOutline" label={t('curriculum.authoring.outlineLabel', 'Module Outline')} />
            <TextAreaField name="lessonContent" label={t('curriculum.authoring.contentLabel', 'Lesson Content')} />
            <TextAreaField name="quizQuestions" label={t('curriculum.authoring.quizLabel', 'Quiz Questions')} />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="px-4 py-2 text-sm font-semibold text-muted hover:text-ink bg-surface border border-border rounded-md transition-colors"
            data-testid="cancel-btn"
          >
            {t('curriculum.authoring.cancelBtn', 'Cancel')}
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-leaf hover:bg-leaf/90 text-white rounded-md text-sm font-semibold shadow-e1 transition-all focus-visible:ring-2 focus-visible:ring-teal"
            data-testid="save-btn"
          >
            <Save size={16} />
            {t('curriculum.authoring.saveBtn', 'Save Module')}
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
