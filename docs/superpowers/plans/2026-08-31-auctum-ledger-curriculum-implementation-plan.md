# Auctum Ledger Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-paced web-based curriculum for Auctum Ledger that integrates with verification tiers, enables in-app course authoring, and provides progress tracking for farmers, roasters, and consumers.

**Architecture:** Three cohesive layers — 1) Data model in `app/src/types/ledger.ts` extending existing Space/Progress types, 2) `CoursePlayer` component with tabbed navigation (Overview/Lessons/Progress), 3) System-prompt domain extension in `app/server/system-prompt/curriculum.ts` for AI-assisted authoring. All layers integrate with existing `VerificationTier` system and i18n infrastructure.

**Tech Stack:** React 18 + Tailwind CSS + React Router v6 + react-i18next + Zustand store + Vitest + Vite

---

## Global Constraints

- **Version Floors:** TypeScript 7.0+, React 18, Tailwind 3.4+
- **Dependency Limits:** Must not introduce new external dependencies
- **Naming Rules:** PascalCase for interfaces, camelCase for variables, match existing patterns
- **Platform Requirements:** Work in all 4 locales with RTL handling support
- **Testing Requirements:** 100% test coverage with Vitest for all new code

---

## Task Decomposition

### Task 1: Extend curriculum data model in ledger.ts

**Files:**
- Modify: `app/src/types/ledger.ts` (append new types at end of file)

**Interfaces:**
- Produces: `CurriculumModule`, `CurriculumLesson`, `CurriculumTrack`, `UserCurriculumProgress`, `CurriculumMilestone`

- [ ] **Step 1: Write the failing test**

Create `app/src/types/__tests__/curriculum.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type { CurriculumModule, CurriculumTrack } from '../types/ledger';

describe('Curriculum Types', () => {
  it('should have valid CurriculumModule shape', () => {
    const module: CurriculumModule = {
      id: 'test-1',
      title: 'Test Module',
      description: 'Test Description',
      level: 'beginner',
      prerequisites: [],
      regionCode: 'VN-DKL',
      track: 'quality',
      author: 'agent-123',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    };
    expect(module.id).toBe('test-1');
    expect(module.track).toBe('quality');
  });

  it('should have valid CurriculumTrack types', () => {
    const tracks: CurriculumTrack[] = ['quality', 'compliance', 'finance', 'logistics'];
    expect(tracks).toContain('quality');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- app/src/types/__tests__/curriculum.test.ts`  
Expected: FAIL with "Module not found" for CurriculumModule

- [ ] **Step 3: Write minimal implementation**

Append to `app/src/types/ledger.ts`:
```typescript
// ─── Curriculum Domain ────────────────────────────────────────────────────────────

export type CurriculumTrack = 'quality' | 'compliance' | 'finance' | 'logistics';

export type CurriculumLevel = 'beginner' | 'intermediate' | 'advanced';

export type ModuleStatus = 'available' | 'locked' | 'in_progress' | 'completed';

export interface CurriculumModule {
  id: string;
  title: string;
  description: string;
  level: CurriculumLevel;
  prerequisites: string[];
  regionCode: RegionCode;
  track: CurriculumTrack;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumLesson {
  id: string;
  moduleId: string;
  title: string;
  content: string; // Markdown or HTML
  estimatedMinutes: number;
  quizId?: string;
  mediaAssets?: MediaAsset[];
}

export type VerificationTieIn = 'self_declared' | 'agent_verified' | 'audit_verified';

export interface CurriculumMilestone {
  id: string;
  moduleId: string;
  lessonCount: number;
  verificationTier: VerificationTieIn;
  badgeId?: string;
  unlocks?: string[]; // Space features, lots, etc.
}

export interface UserCurriculumProgress {
  userId: string;
  moduleId: string;
  status: ModuleStatus;
  lessonsCompleted: string[];
  lastUpdated: string;
  trustScoreBoost?: number;
}

export interface CurriculumCatalog {
  tracks: CurriculumTrack[];
  modules: CurriculumModule[];
  milestones: CurriculumMilestone[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- app/src/types/__tests__/curriculum.test.ts`  
Expected: PASS (8-12 tests)

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/types/ledger.ts app/src/types/__tests__/curriculum.test.ts
git commit -m "feat: add curriculum data model types"
```

---

### Task 2: Create coursework store slice

**Files:**
- Create: `app/src/stores/slices/curriculum-slice.ts`
- Create: `app/src/stores/slices/__tests__/curriculum-slice.test.ts`

**Interfaces:**
- Consumes: `UserCurriculumProgress`, `CurriculumModule`, `CurriculumCatalog` types
- Produces: curriculum state including user progress, available tracks, module status

- [ ] **Step 1: Write failing slice test**

```typescript
import { describe, it, expect } from 'vitest';
import { createCurriculumSlice } from '../curriculum-slice';

describe('Curriculum Slice', () => {
  it('should initialize with empty progress', () => {
    const slice = createCurriculumSlice();
    expect(slice.state.userProgress).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- app/src/stores/slices/__tests__/curriculum-slice.test.ts`  
Expected: FAIL with "createCurriculumSlice not defined"

- [ ] **Step 3: Write minimal implementation**

Create slice following existing `spaces-slice.ts` pattern:
```typescript
import { CurriedStoreApi } from 'zustand';
import { devtools } from 'zustand/middleware/devtools';
import { immer } from 'zustand/middleware/immer';
import type {
  CurriculumModule,
  CurriculumCatalog,
  UserCurriculumProgress,
  ModuleStatus,
} from '../../types/ledger';

export const createCurriculumSlice = () => ({
  state: {
    userProgress: {} as Record<string, UserCurriculumProgress>,
    catalog: null as CurriculumCatalog | null,
  },
  actions: {
    setCatalog: (catalog: CurriculumCatalog) => {
      state.catalog = catalog;
    },
    markLessonComplete: (moduleId: string, lessonId: string) => {
      const progress = state.userProgress[moduleId] || {
        userId: '',
        moduleId,
        status: 'available',
        lessonsCompleted: [],
        lastUpdated: new Date().toISOString(),
      };
      if (!progress.lessonsCompleted.includes(lessonId)) {
        progress.lessonsCompleted.push(lessonId);
        progress.lastUpdated = new Date().toISOString();
        if (progress.lessonsCompleted.length > 0) {
          progress.status = 'in_progress';
        }
        state.userProgress[moduleId] = progress;
      }
    },
    completeModule: (moduleId: string) => {
      const progress = state.userProgress[moduleId];
      if (progress) {
        progress.status = 'completed';
        progress.lastUpdated = new Date().toISOString();
      }
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Expected: 8-12 PASS tests

- [ ] **Step 5: Commit**

---

### Task 3: Create CoursePlayer component

**Files:**
- Create: `app/src/components/CoursePlayer.tsx`
- Create: `app/src/components/__tests__/CoursePlayer.test.tsx`
- Modify: `app/src/components/AppLayout.tsx` (add route)

**Interfaces:**
- Consumes: Curriculum types, Zustand store
- Produces: Tabbed UI with Overview/Lessons/Progress for each module

- [ ] **Step 1: Write basic component test**

```tsx
import { render, screen } from '@testing-library/react';
import { CoursePlayer } from '../CoursePlayer';

describe('CoursePlayer', () => {
  it('renders module overview', () => {
    render(<CoursePlayer moduleId="test-module" />);
    expect(screen.getByText(/Quality Control Module/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify fails**

Expected: FAIL "CoursePlayer not defined"

- [ ] **Step 3: Implement minimal component**

```tsx
export const CoursePlayer: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { t } = useTranslation();
  const module = useModuleData(moduleId);
  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'progress'>('overview');

  return (
    <div className="p-6">
      <div className="flex space-x-4 mb-4">
        {(['overview', 'lessons', 'progress'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 border rounded"
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>
      {/* Tab content rendered conditionally */}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify passes**

- [ ] **Step 5: Commit**

---

### Task 4: Add curriculum routes and page

**Files:**
- Create: `app/src/pages/CurriculumPage.tsx`
- Create: `app/src/pages/__tests__/CurriculumPage.test.tsx`
- Modify: `app/src/App.tsx` (add new route)

**Interfaces:**
- Consumes: Catalog data from store
- Produces: Dashboard of all available curriculum tracks/modules

- [ ] **Step 1: Add curriculum route to App.tsx**
- [ ] **Step 2: Create CurriculumPage with track-based navigation**
- [ ] **Step 3: Write and run tests**
- [ ] **Step 4: Commit**

---

### Task 5: Integrate verification tier scoring

**Files:**
- Modify: `app/src/components/AuctumVerifiedOrigin.tsx` (add education badges)
- Modify: `app/src/components/CupScoreBadge.tsx` (coordinate with curriculum)

**Interfaces:**
- Consumes: UserCurriculumProgress, VerificationTier
- Produces: Trust score boosts from course completion

- [ ] **Step 1: Map milestone completion to tier upgrades**
- [ ] **Step 2: Add visual indicators for earned badges**
- [ ] **Step 3: Write integration tests**
- [ ] **Step 4: Commit**

---

### Task 6: Build in-app authoring interface

**Files:**
- Create: `app/src/components/forms/CurriculumForm.tsx`
- Create: `app/src/stores/slices/__tests__/curriculum-authoring.test.ts`
- Modify: `app/server/system-prompt/curriculum.ts`

**Interfaces:**
- Consumes: AI system prompt domain knowledge
- Produces: UI form for generating module/lesson content via AI

- [ ] **Step 1: Extend system prompt with authoring patterns**
- [ ] **Step 2: Create form component with AI-assisted content generation**
- [ ] **Step 3: Wire into store for saving authored content**
- [ ] **Step 4: Commit**

---

### Task 7: Run full verification

**Commands:**
- `npm run test:run` → 250+ tests PASS
- `npm run lint` → 0 errors
- `npm run build` → production bundle

**Files touched:** All new files above

- [ ] **Step 1: Run full test suite**
- [ ] **Step 2: Run lint**
- [ ] **Step 3: Run production build**
- [ ] **Step 4: Commit all changes**

---

## Success Criteria

- [ ] 250+ tests passing
- [ ] <5 lint warnings
- [ ] Production build succeeds (≤800KB chunks)
- [ ] All new files have 100% test coverage
- [ ] Curriculum integrates with existing verification tier system
- [ ] Routes preserve: `/:locale/curriculum/:track/:moduleId` format