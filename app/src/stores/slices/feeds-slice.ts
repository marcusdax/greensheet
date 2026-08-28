import type { FeedPost, FeedType } from '../../types/lotspace';
import { feedPosts } from '../../data/feed';

export interface FeedsState {
  posts: FeedPost[];
  activeFeed: FeedType;
  likedPostIds: Set<string>;
  loading: boolean;
  error: string | null;
}

export interface FeedsActions {
  loadFeed: (feedType: FeedType) => void;
  setActiveFeed: (feedType: FeedType) => void;
  likePost: (postId: string) => void;
  unlikePost: (postId: string) => void;
  isLiked: (postId: string) => boolean;
  getPostsByFeed: (feedType: FeedType) => FeedPost[];
}

export type FeedsSlice = FeedsState & FeedsActions;

export const initialFeedsState: FeedsState = {
  posts: [],
  activeFeed: 'market',
  likedPostIds: new Set<string>(),
  loading: false,
  error: null,
};

export const createFeedsSlice = (set: any, get: any) => ({
  ...initialFeedsState,

  loadFeed: (_feedType: FeedType) => {
    set(
      (s: any) => { s.feeds.loading = true; s.feeds.error = null; },
      false,
      'feeds/load/start',
    );
    setTimeout(() => {
      set(
        (s: any) => {
          s.feeds.posts = feedPosts;
          s.feeds.loading = false;
        },
        false,
        'feeds/load/done',
      );
    }, 150);
  },

  setActiveFeed: (feedType: FeedType) => {
    set(
      (s: any) => { s.feeds.activeFeed = feedType; },
      false,
      'feeds/setActive',
    );
  },

  likePost: (postId: string) => {
    set(
      (s: any) => {
        s.feeds.likedPostIds = new Set([...s.feeds.likedPostIds, postId]);
        const idx = s.feeds.posts.findIndex((p: FeedPost) => p.id === postId);
        if (idx >= 0) s.feeds.posts[idx] = { ...s.feeds.posts[idx], likeCount: s.feeds.posts[idx].likeCount + 1 };
      },
      false,
      'feeds/like',
    );
  },

  unlikePost: (postId: string) => {
    set(
      (s: any) => {
        const next = new Set(s.feeds.likedPostIds);
        next.delete(postId);
        s.feeds.likedPostIds = next;
        const idx = s.feeds.posts.findIndex((p: FeedPost) => p.id === postId);
        if (idx >= 0) s.feeds.posts[idx] = { ...s.feeds.posts[idx], likeCount: Math.max(0, s.feeds.posts[idx].likeCount - 1) };
      },
      false,
      'feeds/unlike',
    );
  },

  isLiked: (postId: string) => get().feeds.likedPostIds.has(postId),

  getPostsByFeed: (feedType: FeedType): FeedPost[] => {
    return get().feeds.posts.filter((p: FeedPost) => p.feedType === feedType);
  },
});
