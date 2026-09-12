// app/src/api/video-api.ts
// Mock API for video generation - replace with real endpoint when backend is available.

import { CAMPAIGN_TOKENS } from '../api/marketing-data';

export type VideoContentType = 'anchor_explainer' | 'social_cutdown';
export type VideoPlatform = 'youtube' | 'linkedin' | 'tiktok' | 'instagram_reels' | 'x_twitter' | 'email';

export type VideoGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface VideoGenerationConfig {
  type: VideoContentType;
  platform: VideoPlatform;
  templateId: string;
  title: string;
  description: string;
  hook: string;
  cta: string;
  tokens: string[];
}

export interface VideoJob {
  id: string;
  status: VideoGenerationStatus;
  config: VideoGenerationConfig;
  createdAt: string;
}

export interface VideoAsset {
  id: string;
  title: string;
  durationSeconds: number;
  aspectRatio: string;
  thumbnailUrl: string;
  videoUrl: string;
  captionUrl: string;
  createdAt: string;
}

export interface VideoJobResult {
  jobId: string;
  status: VideoGenerationStatus;
  asset?: VideoAsset;
  error?: string;
}

export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  durationSeconds: number;
  aspectRatio: string;
  format: VideoContentType;
  platform: VideoPlatform;
  tokenExamples: string[];
}

const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: 'anchor-verified-ep1',
    name: 'The 86-Point Problem',
    description: 'Prove the cup score is real with the blind-wager format',
    durationSeconds: 95,
    aspectRatio: '16:9',
    format: 'anchor_explainer',
    platform: 'youtube',
    tokenExamples: ['{sca_cup_score}', '{origin}', '{process_method}', '{elevation_masl}'],
  },
  {
    id: 'anchor-verified-ep2',
    name: 'Anatomy of a Lot',
    description: 'Walk one lot from cherry to warehouse, field by field',
    durationSeconds: 120,
    aspectRatio: '16:9',
    format: 'anchor_explainer',
    platform: 'youtube',
    tokenExamples: ['{origin}', '{varietal}', '{process_method}', '{lot_size_bags}'],
  },
  {
    id: 'anchor-verified-ep3',
    name: 'Sample to Contract in 9 Days',
    description: 'Dramatize the full COF-001 to COF-005 journey',
    durationSeconds: 90,
    aspectRatio: '16:9',
    format: 'anchor_explainer',
    platform: 'linkedin',
    tokenExamples: ['{first_order_lbs}', '{days_since_order}', '{referral_url}'],
  },
  {
    id: 'spine-score-reveal',
    name: 'Score Reveal',
    description: 'Roaster guesses, then reveal the Q-grader score',
    durationSeconds: 35,
    aspectRatio: '9:16',
    format: 'social_cutdown',
    platform: 'tiktok',
    tokenExamples: ['{sca_cup_score}', '{origin}', '{process_method}'],
  },
  {
    id: 'spine-origin-fact',
    name: 'Sixty-Second Origin',
    description: 'One origin, one fact that changes how you buy it',
    durationSeconds: 45,
    aspectRatio: '9:16',
    format: 'social_cutdown',
    platform: 'instagram_reels',
    tokenExamples: ['{origin}', '{elevation_masl}', '{region}'],
  },
  {
    id: 'spine-warehouse-honesty',
    name: 'Warehouse Honesty',
    description: 'Live bag counts and shipping mishaps, no spin',
    durationSeconds: 30,
    aspectRatio: '16:9',
    format: 'social_cutdown',
    platform: 'linkedin',
    tokenExamples: ['{lot_size_bags}', '{price_per_lb}', '{origin}'],
  },
];

let nextJobId = 1;

const createMockJob = (config: VideoGenerationConfig): VideoJob => ({
  id: `video-job-${Date.now()}-${nextJobId++}`,
  status: 'processing',
  config,
  createdAt: new Date().toISOString(),
});

export const getVideoTemplates = (): VideoTemplate[] => VIDEO_TEMPLATES;

export const generateVideo = async (
  config: VideoGenerationConfig,
): Promise<VideoJobResult> => {
  // Simulate async generation pipeline (pending -> processing -> completed)
  const job = createMockJob(config);
  return { jobId: job.id, status: 'processing' };
};

export const getVideoStatus = async (
  jobId: string,
): Promise<VideoJobResult> => {
  // In a real implementation this would poll the backend.
  // For the UI prototype, simulate completion after a short delay.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return {
    jobId,
    status: 'completed',
    asset: {
      id: `${jobId}-asset`,
      title: 'Generated video',
      durationSeconds: 45,
      aspectRatio: '9:16',
      thumbnailUrl: `/api/videos/${jobId}/thumbnail.jpg`,
      videoUrl: `/api/videos/${jobId}/video.mp4`,
      captionUrl: `/api/videos/${jobId}/captions.srt`,
      createdAt: new Date().toISOString(),
    },
  };
};

export const resolveVideoTokenLabel = (token: string): string => {
  const match = CAMPAIGN_TOKENS.find((entry) => entry.token === token);
  return match?.tooltip ?? token;
};
