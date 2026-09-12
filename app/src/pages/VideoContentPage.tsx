import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import {
  FileVideoCamera,
  Video,
  Check,
  RefreshCw,
  Copy,
  CheckCircle,
} from 'lucide-react';
import {
  generateVideo,
  getVideoStatus,
  getVideoTemplates,
  type VideoGenerationConfig,
  type VideoContentType,
  type VideoPlatform,
  type VideoTemplate,
} from '../api/video-api';
import { CAMPAIGN_TOKENS } from '../api/marketing-data';
import type { CampaignToken } from '../types/marketing';

const VIDEO_TYPES: { value: VideoContentType; label: string; description: string }[] = [
  { value: 'anchor_explainer', label: 'Anchor Explainers', description: '90–120s episodes for YouTube/LinkedIn' },
  { value: 'social_cutdown', label: 'Social Cutdowns', description: '20–45s verticals for TikTok/Instagram' },
];

const VIDEO_PLATFORMS: { value: VideoPlatform; label: string; aspectRatio: string }[] = [
  { value: 'youtube', label: 'YouTube', aspectRatio: '16:9' },
  { value: 'linkedin', label: 'LinkedIn', aspectRatio: '16:9' },
  { value: 'tiktok', label: 'TikTok', aspectRatio: '9:16' },
  { value: 'instagram_reels', label: 'Instagram Reels', aspectRatio: '9:16' },
  { value: 'x_twitter', label: 'X / Twitter', aspectRatio: '16:9' },
  { value: 'email', label: 'Email/CRM', aspectRatio: '16:9' },
];

interface VideoFormValues {
  type: VideoContentType;
  platform: VideoPlatform;
  templateId: string;
  title: string;
  description: string;
  hook: string;
  cta: string;
  tokens: string[];
}

type VideoJobState = {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: Awaited<ReturnType<typeof getVideoStatus>>;
};

export const VideoContentPage: React.FC = () => {
  const { t } = useTranslation(['common']);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VideoFormValues>({
    defaultValues: {
      type: 'anchor_explainer',
      platform: 'youtube',
      templateId: '',
      title: '',
      description: '',
      hook: '',
      cta: '',
      tokens: [],
    },
  });

  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [tokenOptions, setTokenOptions] = useState<CampaignToken[]>([]);
  const [jobState, setJobState] = useState<VideoJobState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load templates and tokens
  useEffect(() => {
    setTemplates(getVideoTemplates());
    setTokenOptions(CAMPAIGN_TOKENS);
  }, []);

  // Watch form values for reactive features
  const watchedType = watch('type');
  const watchedPlatform = watch('platform');
  const watchedTemplateId = watch('templateId');

  // Filter templates by selected platform
  const filteredTemplates = templates.filter(
    (t) => t.platform === watchedPlatform && t.format === watchedType,
  );

  // Get matching template for prefill
  const selectedTemplate = filteredTemplates.find((t) => t.id === watchedTemplateId);

  const onSubmit = async (data: VideoFormValues) => {
    setIsGenerating(true);
    try {
      const config: VideoGenerationConfig = {
        type: data.type,
        platform: data.platform,
        templateId: data.templateId,
        title: data.title,
        description: data.description,
        hook: data.hook,
        cta: data.cta,
        tokens: data.tokens,
      };

      const result = await generateVideo(config);
      setJobState({ jobId: result.jobId, status: result.status });

      // Poll for completion
      if (result.status === 'processing') {
        const pollInterval = setInterval(async () => {
          const status = await getVideoStatus(result.jobId);
          if (status.status === 'completed' || status.status === 'failed') {
            setJobState((prev) => prev ? {
              ...prev,
              status: status.status,
              result: status,
            } : null);
            clearInterval(pollInterval);
            setIsGenerating(false);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Generation failed:', error);
      setJobState((prev) => prev ? { ...prev, status: 'failed', result: { jobId: prev.jobId, status: 'failed', error: String(error) } } : null);
      setIsGenerating(false);
    }
  };

  const toggleToken = (token: string) => {
    const current = watch('tokens');
    const newTokens = current.includes(token)
      ? current.filter((t) => t !== token)
      : [...current, token];
    setValue('tokens', newTokens);
  };

  const copyTokens = () => {
    const tokens = watch('tokens').join(' ');
    navigator.clipboard.writeText(tokens);
  };

  if (jobState?.status === 'completed' && jobState.result?.asset) {
    return (
      <div className="space-y-6 p-6">
        <header>
          <h1 className="font-display text-3xl text-ink flex items-center gap-2">
            <Video className="size-6 text-teal" />
            {t('videoContent:title', 'Video Content')}
          </h1>
          <p className="text-sm text-muted mt-1">
            {t('videoContent:subtitle', 'Create branded custom videos for your marketing campaigns')}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
              <CheckCircle className="size-5 text-teal" />
              {t('videoContent:success', 'Video Generated Successfully')}
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted mb-2">
                  <span className="font-medium">Title:</span> {jobState.result?.asset?.title}
                </p>
                <p className="text-sm text-muted">
                  <span className="font-medium">Duration:</span> {jobState.result?.asset?.durationSeconds}s
                </p>
              </div>
              <a
                href={jobState.result?.asset?.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img
                  src={jobState.result?.asset?.thumbnailUrl}
                  alt="Video thumbnail"
                  className="w-full rounded-md shadow-e2"
                />
              </a>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (jobState.result?.asset?.videoUrl) {
                      navigator.clipboard.writeText(jobState.result.asset.videoUrl);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border bg-recessed text-ink hover:bg-recessed-50 transition-colors"
                >
                  <Copy className="size-4" />
                  Copy Link
                </button>
                <button
                  type="button"
                  onClick={() => setJobState(null)}
                  className="px-4 py-2 text-sm rounded-md bg-navy text-white hover:bg-navy-800 transition-colors"
                >
                  {t('common:buttons.new', 'New Video')}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-ink mb-2">Generated Assets</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-muted">Video URL</span>
                  <code className="text-xs bg-recessed px-2 py-1 rounded">{jobState.result?.asset?.videoUrl}</code>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted">Thumbnail</span>
                  <code className="text-xs bg-recessed px-2 py-1 rounded">{jobState.result?.asset?.thumbnailUrl}</code>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted">Captions (SRT)</span>
                  <code className="text-xs bg-recessed px-2 py-1 rounded">{jobState.result?.asset?.captionUrl}</code>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl text-ink flex items-center gap-2">
          <FileVideoCamera className="size-6 text-teal" />
          {t('videoContent:title', 'Video Content')}
        </h1>
        <p className="text-sm text-muted mt-1">
          {t('videoContent:subtitle', 'Create branded custom videos for your marketing campaigns')}
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-ink">Video Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    {t('videoContent:videoType', 'Video Type')}
                  </label>
                  <select
                    {...register('type')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink focus:border-teal focus:ring-1 focus:ring-teal"
                  >
                    {VIDEO_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`videoContent:type.${opt.value}`, opt.label)}: {opt.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    {t('videoContent:platform', 'Platform')}
                  </label>
                  <select
                    {...register('platform')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink focus:border-teal focus:ring-1 focus:ring-teal"
                  >
                    {VIDEO_PLATFORMS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`videoContent:platform.${opt.value}`, opt.label)} ({opt.aspectRatio})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-ink">Template Selection</h2>
              
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  {t('videoContent:template', 'Choose Template')}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {filteredTemplates.length === 0 ? (
                    <p className="text-sm text-muted py-4">
                      {t('videoContent:noTemplates', 'No templates available for this platform/type combination.')}
                    </p>
                  ) : (
                    filteredTemplates.map((template) => (
                      <label
                        key={template.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          watchedTemplateId === template.id
                            ? 'border-teal bg-teal/5'
                            : 'border-border hover:border-teal/50'
                        }`}
                      >
                        <input
                          type="radio"
                          {...register('templateId', { required: true })}
                          value={template.id}
                          checked={watchedTemplateId === template.id}
                          className="sr-only"
                          onChange={() => setValue('templateId', template.id, { shouldValidate: true })}
                        />
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-ink">{template.name}</h3>
                            <p className="text-sm text-muted mt-1">{template.description}</p>
                            <p className="text-xs text-muted mt-2">
                              {t('videoContent:duration', 'Duration')}: {template.durationSeconds}s | Aspect: {template.aspectRatio}
                            </p>
                          </div>
                          <div className={`w-4 h-4 rounded-full mr-2 ${
                            watchedTemplateId === template.id
                              ? 'bg-teal'
                              : 'border border-muted'
                          }`} />
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-ink">{t('videoContent:branding', 'Branding')}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    {t('videoContent:titleLabel', 'Video Title')}
                  </label>
                  <input
                    type="text"
                    {...register('title', { required: true })}
                    placeholder={t('videoContent:titlePlaceholder', 'My Branded Video')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink placeholder:text-muted focus:border-teal focus:ring-1 focus:ring-teal"
                  />
                  {errors.title && (
                    <p className="text-xs text-cherry mt-1">{t('videoContent:titleRequired', 'Title is required')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    {t('videoContent:descriptionLabel', 'Description')}
                  </label>
                  <input
                    type="text"
                    {...register('description')}
                    placeholder={t('videoContent:descriptionPlaceholder', 'Brief video description...')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink placeholder:text-muted focus:border-teal focus:ring-1 focus:ring-teal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    {t('videoContent:hookLabel', 'Hook Text')}
                  </label>
                  <input
                    type="text"
                    {...register('hook')}
                    placeholder={t('videoContent:hookPlaceholder', 'First 3 seconds matter...')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink placeholder:text-muted focus:border-teal focus:ring-1 focus:ring-teal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    {t('videoContent:ctaLabel', 'Call to Action')}
                  </label>
                  <input
                    type="text"
                    {...register('cta')}
                    placeholder={t('videoContent:ctaPlaceholder', 'Watch now / Learn more')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink placeholder:text-muted focus:border-teal focus:ring-1 focus:ring-teal"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-ink">{t('videoContent:tokens', 'Brand Tokens')}</h2>
                <button
                  type="button"
                  onClick={copyTokens}
                  className="flex items-center gap-1.5 text-sm text-teal hover:text-teal-300"
                >
                  <Copy className="size-4" />
                  {t('videoContent:copyTokens', 'Copy all selected')}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {tokenOptions.map((token) => {
                  const isSelected = watch('tokens').includes(token.token);
                  return (
                    <label
                      key={token.token}
                      className={`border rounded-md px-3 py-2 cursor-pointer text-sm flex justify-between items-center transition-all ${
                        isSelected
                          ? 'border-teal bg-teal/5'
                          : 'border-border hover:border-teal/50'
                      }`}
                    >
                      <span className={isSelected ? 'text-ink' : 'text-muted'}>
                        {token.token}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleToken(token.token)}
                        className="w-4 h-4 rounded border-border text-teal focus:ring-teal"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-ink mb-3">{t('videoContent:preview', 'Token Preview')}</h3>
              
              {selectedTemplate && (
                <div className="text-sm text-muted">
                  <p className="font-medium text-ink mb-2">{selectedTemplate.name}</p>
                  <div className="space-y-1">
                    <p>
                      <span className="text-ink">{t('videoContent:titleLabel', 'Title')}:</span> {watch('title') || '...'}
                    </p>
                    <p>
                      <span className="text-ink">{t('videoContent:hookLabel', 'Hook')}:</span> {watch('hook') || '...'}
                    </p>
                    <p>
                      <span className="text-ink">{t('videoContent:ctaLabel', 'CTA')}:</span> {watch('cta') || '...'}
                    </p>
                  </div>
                </div>
              )}

              {watch('tokens').length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted mb-1">{t('videoContent:selectedTokens', 'Selected tokens:')}</p>
                  <div className="flex flex-wrap gap-1">
                    {watch('tokens').map((token) => (
                      <span
                        key={token}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-recessed text-muted rounded"
                      >
                        {token}
                        <button
                          type="button"
                          onClick={() => toggleToken(token)}
                          className="hover:text-ink"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isGenerating || !watchedTemplateId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  {t('common:buttons.processing', 'Generating...')}
                </>
              ) : (
                <Check className="size-4" />
              )}
              {t('videoContent:generateBtn', 'Generate Video')}
            </button>
          </div>
        </div>
      </form>

      {isGenerating && jobState && (
        <div className="fixed inset-0 bg-navy/50 flex items-center justify-center z-modal">
          <div className="bg-surface p-6 rounded-lg shadow-e3 w-full max-w-sm">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-teal flex items-center justify-center mb-4">
                <RefreshCw className="size-6 animate-spin text-white" />
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">
                {t('videoContent:processing', 'Generating your video...')}
              </h3>
              <p className="text-sm text-muted">
                {t('videoContent:processingDesc', 'This may take a few moments.')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};