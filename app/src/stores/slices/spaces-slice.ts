import type { FarmerSpace, RoasterSpace, CafeSpace, CooperativeSpace, AnySpace } from '../../types/lotspace';
import { farmerSpaces, roasterSpaces, cafeSpaces, cooperativeSpaces } from '../../data/spaces';

export interface SpacesState {
  farmerSpaces: FarmerSpace[];
  roasterSpaces: RoasterSpace[];
  cafeSpaces: CafeSpace[];
  cooperativeSpaces: CooperativeSpace[];
  followedSpaceIds: Set<string>;
  activeSpaceId: string | null;
  loading: boolean;
  error: string | null;
}

export interface SpacesActions {
  loadSpaces: () => void;
  setActiveSpace: (id: string | null) => void;
  followSpace: (id: string) => void;
  unfollowSpace: (id: string) => void;
  isFollowing: (id: string) => boolean;
}

export type SpacesSlice = SpacesState & SpacesActions;

export const initialSpacesState: SpacesState = {
  farmerSpaces: [],
  roasterSpaces: [],
  cafeSpaces: [],
  cooperativeSpaces: [],
  followedSpaceIds: new Set<string>(),
  activeSpaceId: null,
  loading: false,
  error: null,
};

export const createSpacesSlice = (set: any, get: any) => ({
  ...initialSpacesState,

  loadSpaces: () => {
    set(
      (s: any) => {
        s.spaces.loading = true;
        s.spaces.error = null;
      },
      false,
      'spaces/load/start',
    );
    // Simulate async load with mock data
    setTimeout(() => {
      set(
        (s: any) => {
          s.spaces.farmerSpaces = farmerSpaces;
          s.spaces.roasterSpaces = roasterSpaces;
          s.spaces.cafeSpaces = cafeSpaces;
          s.spaces.cooperativeSpaces = cooperativeSpaces;
          s.spaces.loading = false;
        },
        false,
        'spaces/load/done',
      );
    }, 200);
  },

  setActiveSpace: (id: string | null) => {
    set(
      (s: any) => { s.spaces.activeSpaceId = id; },
      false,
      'spaces/setActive',
    );
  },

  followSpace: (id: string) => {
    set(
      (s: any) => {
        s.spaces.followedSpaceIds = new Set([...s.spaces.followedSpaceIds, id]);
      },
      false,
      'spaces/follow',
    );
  },

  unfollowSpace: (id: string) => {
    set(
      (s: any) => {
        const next = new Set(s.spaces.followedSpaceIds);
        next.delete(id);
        s.spaces.followedSpaceIds = next;
      },
      false,
      'spaces/unfollow',
    );
  },

  isFollowing: (id: string) => {
    return get().spaces.followedSpaceIds.has(id);
  },

  getAllSpaces: (): AnySpace[] => {
    const st = get().spaces;
    return [
      ...st.farmerSpaces,
      ...st.roasterSpaces,
      ...st.cafeSpaces,
      ...st.cooperativeSpaces,
    ];
  },
});
