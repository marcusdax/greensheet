import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Share2, Coffee, TrendingUp, Image, Radio, Clock } from 'lucide-react';
import { VerificationBadge } from './VerificationBadge';
import type { FeedPost, PostType } from '../types/lotspace';

interface FeedPostCardProps {
  post: FeedPost;
  isLiked?: boolean;
  onLike?: (postId: string) => void;
  onUnlike?: (postId: string) => void;
  onTip?: (farmerSpaceId: string) => void;
  onClick?: (postId: string) => void;
}

const POST_TYPE_CONFIG: Record<PostType, { label: string; color: string }> = {
  lot_listing: { label: 'Lot Live', color: 'bg-teal/10 text-teal border-teal/30' },
  price_update: { label: 'Price Update', color: 'bg-gold/10 text-gold-600 border-gold/30' },
  harvest_report: { label: 'Harvest', color: 'bg-leaf/10 text-leaf border-leaf/30' },
  process_experiment: { label: 'Processing', color: 'bg-roast/10 text-roast border-roast/20' },
  competition_result: { label: 'Competition', color: 'bg-gold/10 text-gold-600 border-gold/30' },
  transparency_receipt: { label: 'True Price', color: 'bg-leaf/10 text-leaf border-leaf/30' },
  tip_milestone: { label: 'Tip Milestone', color: 'bg-cherry/10 text-cherry border-cherry/20' },
  media_story: { label: 'Story', color: 'bg-info/20 text-info border-info/20' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
}

export const FeedPostCard: React.FC<FeedPostCardProps> = ({
  post,
  isLiked = false,
  onLike,
  onUnlike,
  onTip,
  onClick,
}) => {
  const [likeAnimating, setLikeAnimating] = useState(false);
  const postTypeConfig = POST_TYPE_CONFIG[post.postType];
  const isFarmer = post.authorArchetype === 'farmer';

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 600);
    if (isLiked) onUnlike?.(post.id);
    else onLike?.(post.id);
  };

  const handleTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFarmer) onTip?.(post.authorSpaceId);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick?.(post.id)}
      className="bg-surface border border-border rounded-lg p-4 space-y-3 hover:border-teal/30 transition-colors duration-fast cursor-pointer group"
    >
      {/* Author row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-parchment-50 font-display font-semibold text-xs shrink-0">
            {post.authorName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-sans font-semibold text-ink leading-tight truncate">
                {post.authorName}
              </span>
              <VerificationBadge tier={post.authorVerificationTier} size="sm" showLabel={false} />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-subtle font-mono">
              <Clock size={9} />
              <span>{timeAgo(post.publishedAt)}</span>
            </div>
          </div>
        </div>
        {/* Post type chip */}
        <span className={`shrink-0 text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${postTypeConfig.color}`}>
          {postTypeConfig.label}
        </span>
      </div>

      {/* Headline */}
      <h3 className="text-sm font-sans font-semibold text-ink leading-snug group-hover:text-teal transition-colors">
        {post.headline}
      </h3>

      {/* Body */}
      {post.bodyText && (
        <p className="text-xs text-muted font-sans leading-relaxed line-clamp-3">
          {post.bodyText}
        </p>
      )}

      {/* Media thumbnail */}
      {post.mediaAsset && (
        <div className="flex items-center gap-2 bg-recessed rounded-md p-2 border border-border">
          <Image size={14} className="text-muted shrink-0" />
          <span className="text-[10px] text-muted font-mono truncate">
            {post.mediaAsset.caption || 'Media attached'}
          </span>
        </div>
      )}

      {/* Lot metrics */}
      {(post.lotPriceCentsPerLb || post.cupScore) && (
        <div className="flex gap-4">
          {post.cupScore && (
            <div className="flex items-center gap-1 text-xs font-mono">
              <Coffee size={11} className="text-roast" />
              <span className="text-muted">Cup:</span>
              <span className="font-semibold text-ink">{post.cupScore.toFixed(2)}</span>
            </div>
          )}
          {post.lotPriceCentsPerLb && (
            <div className="flex items-center gap-1 text-xs font-mono">
              <TrendingUp size={11} className="text-teal" />
              <span className="text-muted">Price:</span>
              <span className="font-semibold text-ink">${(post.lotPriceCentsPerLb / 100).toFixed(2)}/lb</span>
            </div>
          )}
        </div>
      )}

      {/* Tip stats */}
      {post.tipsTotalCents > 0 && (
        <div className="flex items-center gap-1 text-[10px] font-mono text-cherry">
          <Radio size={10} />
          <span>${(post.tipsTotalCents / 100).toFixed(0)} tipped by {post.tipCount} followers</span>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-3">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-[11px] font-mono transition-colors ${
              isLiked ? 'text-cherry' : 'text-muted hover:text-cherry'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={isLiked ? 'liked' : 'unliked'}
                animate={likeAnimating ? { scale: [1, 1.4, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Heart size={13} fill={isLiked ? 'currentColor' : 'none'} />
              </motion.span>
            </AnimatePresence>
            <span>{post.likeCount.toLocaleString()}</span>
          </button>

          {/* Share */}
          <button className="flex items-center gap-1 text-[11px] font-mono text-muted hover:text-teal transition-colors">
            <Share2 size={13} />
            <span>{post.shareCount.toLocaleString()}</span>
          </button>
        </div>

        {/* Tip button (only for farmer posts) */}
        {isFarmer && (
          <button
            onClick={handleTip}
            className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-md bg-cherry/10 text-cherry border border-cherry/20 hover:bg-cherry/20 transition-all duration-fast"
          >
            ☕ Tip Farmer
          </button>
        )}
      </div>
    </motion.article>
  );
};
