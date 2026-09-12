import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Sparkles, BarChart3, GitBranch, Link2, Clock, CheckCircle2, AlertTriangle, Loader2, Copy, Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Episode Data (from marketing/05-video-content-ecosystem.md §1) ───

interface Episode {
  id: string;
  title: string;
  runtime: string;
  hook: string;
  beatCount: number;
  status: 'published' | 'cutting' | 'draft';
  thumbnail: string;
}

const EPISODES: Episode[] = [
  {
    id: 'verified-ep1',
    title: 'The 86-Point Problem',
    runtime: '~95 s',
    hook: 'This coffee scores 86.5. This one scores 84. One of those numbers is made up.',
    beatCount: 6,
    status: 'published',
    thumbnail: 'verified-ep1-thumb',
  },
  {
    id: 'verified-ep2',
    title: 'Anatomy of a Lot',
    runtime: '~120 s',
    hook: 'This bag traveled 7,000 miles. Its story fits in eight data fields — and every one of them is checkable.',
    beatCount: 7,
    status: 'published',
    thumbnail: 'verified-ep2-thumb',
  },
  {
    id: 'verified-ep3',
    title: 'Sample to Contract in 9 Days',
    runtime: '~90 s',
    hook: 'Nine days ago, Maya had never heard of us. Today she\'s reordering.',
    beatCount: 7,
    status: 'cutting',
    thumbnail: 'verified-ep3-thumb',
  },
];

// ─── Cutdown Matrix (from §3) ───

interface CutdownRow {
  platform: string;
  aspect: string;
  length: string;
  source: string;
  hookVariants: string;
  cta: string;
  primaryKPI: string;
}

const CUTDOWNS: CutdownRow[] = [
  { platform: 'YouTube (anchor)', aspect: '16:9', length: '90–120 s', source: 'Full episode', hookVariants: 'Native open', cta: 'Verbal + end-screen → kit LP', primaryKPI: 'VTR, watch time, subs' },
  { platform: 'YouTube Shorts', aspect: '9:16', length: '30–45 s', source: 'Ep proof beat (wager/score-match)', hookVariants: 'A, B, C', cta: '"Full film + free kit — link"', primaryKPI: 'Swipe-away rate, CTR' },
  { platform: 'LinkedIn organic', aspect: '1:1', length: '45–60 s', source: 'Problem + turn beats; captions-first', hookVariants: 'A, B', cta: 'Comment-bait line + link in comments', primaryKPI: 'Completion, dwell, CTR' },
  { platform: 'LinkedIn paid (supply-side)', aspect: '16:9', length: '30 s', source: 'Ep3 workflow cut', hookVariants: 'B', cta: '"See lead scoring" → importer LP', primaryKPI: 'SQL rate' },
  { platform: 'TikTok', aspect: '9:16', length: '20–35 s', source: 'Score Reveal / wager beat', hookVariants: 'C, A', cta: '"Kit link in bio"', primaryKPI: '3s→full retention, shares' },
  { platform: 'Instagram Reels', aspect: '9:16', length: '20–35 s', source: 'Origin macro + score reveal', hookVariants: 'C, B', cta: 'Link sticker → kit LP', primaryKPI: 'Saves, shares, CTR' },
  { platform: 'X / Twitter', aspect: '16:9', length: '30–45 s', source: 'Bold stat + wager', hookVariants: 'B', cta: 'Quote-tweet prompt', primaryKPI: 'Link clicks' },
  { platform: 'Email/CRM embed', aspect: '16:9 GIF→video', length: '15 s loop', source: 'Cupping beat', hookVariants: '—', cta: 'Feedback form', primaryKPI: 'Feedback submission rate' },
];

// ─── Performance Framework (from §7.1) ───

interface PerfMetric {
  metric: string;
  youtube: string;
  shortsTiktok: string;
  linkedin: string;
}

const PERFORMANCE_METRICS: PerfMetric[] = [
  { metric: 'Hook hold (3 s → 10 s)', youtube: '≥ 70%', shortsTiktok: '≥ 65%', linkedin: '≥ 60%' },
  { metric: 'VTR (complete or 30 s)', youtube: '≥ 55% @ 30 s', shortsTiktok: '≥ 25% full-completion', linkedin: '≥ 35% @ 30 s' },
  { metric: 'Retention curve targets', youtube: '≥ 75% @ 15 s; ≥ 45% @ 60 s; ≥ 25% @ end', shortsTiktok: '≥ 50% @ 50% mark', linkedin: '≥ 40% @ 50% mark' },
  { metric: 'CTR to LP', youtube: '≥ 1.2%', shortsTiktok: '≥ 0.8%', linkedin: '≥ 1.5%' },
  { metric: 'Engaged-view conversion', youtube: '≥ 0.35% of ≥ 75% viewers', shortsTiktok: '≥ 0.15%', linkedin: '≥ 0.5%' },
  { metric: 'Cost guardrail (paid)', youtube: '≤ $200/attributed signup', shortsTiktok: 'same', linkedin: 'SQL ≤ $400' },
];

// ─── API Branded Video Config ───

interface BrandedVideoConfig {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  ctaText: string;
  ctaUrl: string;
  watermark: boolean;
  outroText: string;
}

const DEFAULT_BRAND_CONFIG: BrandedVideoConfig = {
  brandName: '',
  primaryColor: '#16323E',
  accentColor: '#C9A34A',
  ctaText: 'Cup it before you commit a dollar',
  ctaUrl: '',
  watermark: true,
  outroText: 'Verified, from origin. — Auctum Ledger',
};

// ─── Helpers ───

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'published': return 'bg-leaf/20 text-leaf border border-leaf/30';
    case 'cutting': return 'bg-gold/20 text-gold-600 border border-gold/30';
    case 'draft': return 'bg-recessed text-muted border border-border';
    default: return 'bg-recessed text-muted border border-border';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'published': return <CheckCircle2 size={14} className="text-leaf" />;
    case 'cutting': return <Clock size={14} className="text-gold-600" />;
    case 'draft': return <AlertTriangle size={14} className="text-muted" />;
    default: return null;
  }
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted hover:text-teal transition-colors font-mono" aria-label="Copy to clipboard">
      {copied ? <Check size={12} className="text-leaf" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

// ─── Main Component ───

export const VideoPage: React.FC = () => {
  const { t } = useTranslation(['common']);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode>(EPISODES[0]);
  const [showCutdowns, setShowCutdowns] = useState(false);
  const [brandConfig, setBrandConfig] = useState<BrandedVideoConfig>(DEFAULT_BRAND_CONFIG);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerateBrandedVideo = async () => {
    setGenerating(true);
    setGeneratedUrl(null);
    // Simulate API call to branded video generation endpoint
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockUrl = `https://cdn.auctum.ledger/video/branded/${brandConfig.brandName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.mp4`;
    setGeneratedUrl(mockUrl);
    setGenerating(false);
  };

  const handleCopyUrl = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl).catch(() => {});
    }
  };

  return (
    <div className="space-y-6">
      {/* ── View Header ── */}
      <div className="flex flex-col gap-1">
        <span className="overline text-xs text-muted tracking-wider">
          {t('common:nav.videos', 'VIDEO CONTENT')}
        </span>
        <h1 className="text-3xl font-display font-medium text-ink">
          {t('common:nav.video', 'Video Content Ecosystem')}
        </h1>
        <p className="text-sm text-muted font-sans max-w-2xl">
          {t('common:video.subtitle', 'Manage VERIFIED episodes, social cutdowns, and generate branded custom videos via API.')}
        </p>
      </div>

      {/* ── Branded Video Creator (API) ── */}
      <section className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4" aria-label="Branded video creation">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <Sparkles size={18} className="text-gold-600" />
          <div>
            <h2 className="text-lg font-display font-semibold text-ink">
              {t('common:video.brandCreator', 'Branded Video Creator')}
            </h2>
            <p className="text-xs text-muted font-sans">
              {t('common:video.brandCreatorDesc', 'Generate custom branded videos through the API with your logo, colors, and CTA.')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="brand-name" className="overline text-xs text-muted font-bold block">
              {t('common:video.brandName', 'Brand Name')}
            </label>
            <input
              id="brand-name"
              type="text"
              value={brandConfig.brandName}
              onChange={(e) => setBrandConfig(prev => ({ ...prev, brandName: e.target.value }))}
              placeholder="e.g. Meridian Roasters"
              className="w-full px-3 py-1.5 border border-border-interactive rounded-md bg-recessed/20 text-ink text-sm focus:border-teal font-sans"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="brand-primary" className="overline text-xs text-muted font-bold block">
              {t('common:video.primaryColor', 'Primary Color')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="brand-primary"
                type="color"
                value={brandConfig.primaryColor}
                onChange={(e) => setBrandConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer border border-border"
              />
              <span className="font-mono text-xs text-muted">{brandConfig.primaryColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="brand-accent" className="overline text-xs text-muted font-bold block">
              {t('common:video.accentColor', 'Accent Color')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="brand-accent"
                type="color"
                value={brandConfig.accentColor}
                onChange={(e) => setBrandConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer border border-border"
              />
              <span className="font-mono text-xs text-muted">{brandConfig.accentColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cta-text" className="overline text-xs text-muted font-bold block">
              {t('common:video.ctaText', 'CTA Text')}
            </label>
            <input
              id="cta-text"
              type="text"
              value={brandConfig.ctaText}
              onChange={(e) => setBrandConfig(prev => ({ ...prev, ctaText: e.target.value }))}
              className="w-full px-3 py-1.5 border border-border-interactive rounded-md bg-recessed/20 text-ink text-sm focus:border-teal font-sans"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cta-url" className="overline text-xs text-muted font-bold block">
              {t('common:video.ctaUrl', 'CTA URL')}
            </label>
            <input
              id="cta-url"
              type="url"
              value={brandConfig.ctaUrl}
              onChange={(e) => setBrandConfig(prev => ({ ...prev, ctaUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-1.5 border border-border-interactive rounded-md bg-recessed/20 text-ink text-sm focus:border-teal font-sans"
            />
          </div>
          <div className="space-y-1.5 flex items-end">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={brandConfig.watermark}
                onChange={(e) => setBrandConfig(prev => ({ ...prev, watermark: e.target.checked }))}
                className="rounded-sm border-border-interactive text-teal focus:ring-teal w-4 h-4 cursor-pointer"
              />
              {t('common:video.watermark', 'Include watermark')}
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerateBrandedVideo}
            disabled={generating || !brandConfig.brandName || !brandConfig.ctaUrl}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 disabled:opacity-50 text-white rounded-md text-sm font-semibold shadow-e1 transition-all focus-visible:ring-2 focus-visible:ring-teal"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('common:video.generating', 'Generating...')}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {t('common:video.generate', 'Generate Branded Video')}
              </>
            )}
          </button>
          {generatedUrl && (
            <div className="flex items-center gap-2 bg-recessed/40 px-3 py-1.5 rounded-md border border-border">
              <span className="font-mono text-xs text-ink truncate max-w-xs">{generatedUrl}</span>
              <CopyButton text={generatedUrl} />
            </div>
          )}
        </div>

        {/* API Endpoint Reference */}
        <div className="bg-recessed/20 p-3 rounded-md border border-border/50 font-mono text-xs text-muted space-y-1">
          <div className="flex items-center justify-between">
            <span className="overline text-muted font-bold text-[10px]">API ENDPOINT</span>
            <CopyButton text="POST /api/v1/video/branded" />
          </div>
          <code className="block bg-canvas p-2 rounded text-ink/80">
            POST /api/v1/video/branded<br />
            Body: {'{'} brandName, primaryColor, accentColor, ctaText, ctaUrl, watermark, outroText {'}'}<br />
            Returns: {'{'} videoUrl, thumbnailUrl, cutdowns[], status {'}'}
          </code>
        </div>
      </section>

      {/* ── Video Player + Episode Selector ── */}
      <section className="bg-surface rounded-lg border border-border shadow-e1 overflow-hidden" aria-label="Video player">
        {/* Player Area */}
        <div className="relative bg-navy aspect-video flex items-center justify-center group cursor-pointer" onClick={() => {}} role="button" aria-label="Play video">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
              <Play size={32} className="text-white ml-1" fill="white" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-navy-900/90 to-transparent p-4">
            <h3 className="text-white font-display text-lg font-semibold">{selectedEpisode.title}</h3>
            <div className="flex items-center gap-3 text-parchment-200 text-xs font-mono mt-1">
              <span>{selectedEpisode.runtime}</span>
              <span>•</span>
              <span>{selectedEpisode.beatCount} beats</span>
              <span>•</span>
              <span className="capitalize">{selectedEpisode.status}</span>
            </div>
          </div>
          {selectedEpisode.status === 'published' && (
            <div className="absolute top-3 right-3 bg-leaf/90 text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
              VERIFIED
            </div>
          )}
        </div>

        {/* Episode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {EPISODES.map((ep) => (
            <button
              key={ep.id}
              onClick={() => setSelectedEpisode(ep)}
              className={`text-left p-4 transition-all focus-visible:ring-2 focus-visible:ring-teal ${
                selectedEpisode.id === ep.id ? 'bg-recessed/40 border-l-2 border-l-teal' : 'hover:bg-hover/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${statusBadgeClass(ep.status)}`}>
                  {ep.status}
                </span>
                {statusIcon(ep.status)}
              </div>
              <h4 className="text-sm font-semibold text-ink font-sans leading-snug mb-1">{ep.title}</h4>
              <p className="text-xs text-muted line-clamp-2">{ep.hook}</p>
              <span className="text-[10px] font-mono text-subtle mt-2 block">{ep.runtime}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Cutdown Matrix Toggle ── */}
      <section className="bg-surface rounded-lg border border-border shadow-e1 overflow-hidden" aria-label="Social cutdown matrix">
        <button
          type="button"
          onClick={() => setShowCutdowns(!showCutdowns)}
          className="w-full flex items-center justify-between p-4 text-left focus-visible:ring-2 focus-visible:ring-teal"
          aria-expanded={showCutdowns}
        >
          <div className="flex items-center gap-3">
            <GitBranch size={18} className="text-gold-600" />
            <div>
              <h2 className="text-lg font-display font-semibold text-ink">
                {t('common:video.cutdownMatrix', 'Social Cutdown Matrix')}
              </h2>
              <p className="text-xs text-muted font-sans">
                {t('common:video.cutdownMatrixDesc', '8 platforms × 3 hook variants per anchor episode')}
              </p>
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`text-muted transition-transform duration-base ${showCutdowns ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {showCutdowns && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full text-xs font-sans border-collapse border border-border">
                  <thead>
                    <tr className="bg-recessed/30 border-b border-border">
                      <th className="px-3 py-2 text-left font-semibold text-muted">Platform</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted">Aspect</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted">Length</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted">Source</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted">Hook</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted">CTA</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted">Primary KPI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {CUTDOWNS.map((row, idx) => (
                      <tr key={idx} className="hover:bg-hover/10">
                        <td className="px-3 py-2 font-semibold text-ink">{row.platform}</td>
                        <td className="px-3 py-2 text-muted font-mono">{row.aspect}</td>
                        <td className="px-3 py-2 text-muted font-mono">{row.length}</td>
                        <td className="px-3 py-2 text-muted max-w-[200px] truncate">{row.source}</td>
                        <td className="px-3 py-2 text-muted font-mono">{row.hookVariants}</td>
                        <td className="px-3 py-2 text-muted max-w-[180px] truncate">{row.cta}</td>
                        <td className="px-3 py-2 text-muted">{row.primaryKPI}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Performance Framework ── */}
      <section className="bg-surface rounded-lg border border-border shadow-e1 overflow-hidden" aria-label="Performance metrics">
        <div className="p-4 pb-2 flex items-center gap-3 border-b border-border">
          <BarChart3 size={18} className="text-teal" />
          <div>
            <h2 className="text-lg font-display font-semibold text-ink">
              {t('common:video.performance', 'Performance Framework')}
            </h2>
            <p className="text-xs text-muted font-sans">
              {t('common:video.performanceDesc', 'Platform KPI targets from the content strategy')}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs font-sans border-collapse border border-border">
            <thead>
              <tr className="bg-recessed/30 border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-muted">Metric</th>
                <th className="px-3 py-2 text-left font-semibold text-muted">YouTube 16:9</th>
                <th className="px-3 py-2 text-left font-semibold text-muted">Shorts/TikTok/Reels</th>
                <th className="px-3 py-2 text-left font-semibold text-muted">LinkedIn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERFORMANCE_METRICS.map((row, idx) => (
                <tr key={idx} className="hover:bg-hover/10">
                  <td className="px-3 py-2 font-semibold text-ink">{row.metric}</td>
                  <td className="px-3 py-2 font-mono text-muted">{row.youtube}</td>
                  <td className="px-3 py-2 font-mono text-muted">{row.shortsTiktok}</td>
                  <td className="px-3 py-2 font-mono text-muted">{row.linkedin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Attribution Plumbing ── */}
      <section className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-3" aria-label="Attribution">
        <h2 className="text-lg font-display font-semibold text-ink">
          {t('common:video.attribution', 'Attribution Plumbing')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-recessed/20 p-3 rounded border border-border/50">
            <span className="overline text-muted font-bold text-[10px]">UTM Pattern</span>
            <code className="block text-ink mt-1 bg-canvas p-2 rounded">
              utm_source={'{platform}'}&amp;utm_medium=video&amp;utm_campaign=verified_s1&amp;utm_content={'{episode}_{hook_variant}'}
            </code>
          </div>
          <div className="bg-recessed/20 p-3 rounded border border-border/50">
            <span className="overline text-muted font-bold text-[10px]">Landing Page</span>
            <code className="block text-ink mt-1 bg-canvas p-2 rounded">/watch/verified-ep1, ep2, ep3</code>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted font-sans">
          <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-leaf" /> Engaged-view audiences sync to ad platforms</span>
          <span className="flex items-center gap-1"><Link2 size={14} className="text-teal" /> Video touch logged as nurture touch</span>
        </div>
      </section>
    </div>
  );
};
