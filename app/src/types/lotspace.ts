/**
 * LotSpace — Domain Type System
 * The social ledger layer of Greensheet. Four new bounded contexts:
 * Spaces · Feeds · Reputation · Connections
 *
 * Design principle: every type here must be traceable to a ledger event.
 * No engagement metric without a revenue event.
 */

// ─── Shared primitives ────────────────────────────────────────────────────────

export type VerificationTier = 'self_declared' | 'agent_verified' | 'audit_verified';

export type SpaceArchetype =
  | 'farmer'       // smallholder, connected pragmatist, aspiring craft producer
  | 'collector'    // field agent / middleman
  | 'cooperative'  // producer org / washing station
  | 'exporter'     // importer/exporter
  | 'roaster'      // roaster / café
  | 'consumer';    // end consumer

export type RegionCode =
  | 'VN-DKL'  // Dak Lak, Vietnam
  | 'VN-LDG'  // Lam Dong, Vietnam
  | 'VN-GLA'  // Gia Lai, Vietnam
  | 'ET-SNNP' // Southern Nations, Ethiopia
  | 'ET-ORO'  // Oromia, Ethiopia
  | 'UG-BUG'  // Bugisu, Uganda
  | 'CO-HUI'  // Huila, Colombia
  | 'PE-JUN'; // Junín, Peru

export type MobileMoneyRail = 'momo' | 'zalopay' | 'mpesa' | 'telebirr' | 'card' | 'bank_transfer';

// ─── Subsistence Ledger (the $3.00/lb True Price Floor) ───────────────────────

/**
 * Five-pillar subsistence ledger — the economic backbone of every farmer Space.
 * All values in cents per pound (USD).
 */
export interface SubsistenceLedger {
  /** $1.20/lb — food, shelter, clothing, education */
  householdCentsPerLb: number;
  /** $0.80/lb — seeds, fertilizer, labor, processing */
  operatingCentsPerLb: number;
  /** $0.20/lb — debt service / input loans */
  debtCentsPerLb: number;
  /** $0.30/lb — farm maintenance, equipment depreciation */
  infrastructureCentsPerLb: number;
  /** $0.50/lb — crop insurance, savings, climate buffer */
  resilienceCentsPerLb: number;
  /** Computed: sum of all five pillars */
  truePriceFloorCentsPerLb: number;
  /** Actual farmgate received this season */
  actualFarmgateCentsPerLb: number;
  /** Season label e.g. "2024–25 Main Crop" */
  seasonLabel: string;
  /** ISO date of last ledger update */
  lastUpdatedAt: string;
}

// ─── EUDR Compliance Data ─────────────────────────────────────────────────────

export interface EudrGeolocation {
  /** For plots < 4 ha: lat/lng point */
  latitude: number;
  longitude: number;
  /** Plot area in hectares */
  plotAreaHa: number;
  /** ISO-3166-1 alpha-2 country code */
  countryCode: string;
  /** Administrative region / province */
  adminRegion: string;
  /** Agent who captured this geolocation */
  capturedByAgentId: string;
  /** ISO date of geolocation capture */
  capturedAt: string;
  /** Whether polygon data is also available (plots ≥ 4 ha) */
  hasPolygon: boolean;
}

// ─── Reproducibility Audit (Three Questions) ─────────────────────────────────

export interface ReproducibilityAudit {
  /** Q1: Can the farmer reproduce this lot at this quality level? */
  canReproduce: boolean;
  reproducibilityNotes: string;
  /** Q2: At what cost per pound can they reproduce it? */
  reproducedCostCentsPerLb: number;
  costNotes: string;
  /** Q3: Who verifies the quality claim? */
  verifier: 'self' | 'agent' | 'q_grader' | 'third_party_lab';
  verifierName: string;
  auditedAt: string;
}

// ─── Agent / Collector Profile ────────────────────────────────────────────────

export interface AgentProfile {
  id: string;
  fullName: string;
  /** The district/village they operate in */
  territory: string;
  regionCode: RegionCode;
  /** Number of verified farmer profiles they manage */
  verifiedFarmerCount: number;
  /** Completed platform trades facilitated */
  completedTradeCount: number;
  /** Agent rating (1–5, unrounded) */
  agentRating: number;
  /** Commission earned this season in cents */
  commissionEarnedCents: number;
  phone: string;
  photo: string | null;
  joinedAt: string;
}

// ─── Harvest Calendar ─────────────────────────────────────────────────────────

export type HarvestPhase =
  | 'flowering'
  | 'green_cherry'
  | 'ripening'
  | 'peak_harvest'
  | 'post_harvest'
  | 'processing'
  | 'dry_season';

export interface HarvestCalendarEntry {
  /** Month index 0–11 (Jan–Dec) */
  month: number;
  phase: HarvestPhase;
  /** Estimated availability in lbs */
  estimatedLbs: number | null;
  notes: string | null;
}

// ─── Space (core profile entity) ─────────────────────────────────────────────

export interface FarmerSpace {
  id: string;
  archetype: 'farmer';
  verificationTier: VerificationTier;
  /** Real full name — anonymous farmer-as-prop imagery is banned */
  fullName: string;
  farmName: string;
  photo: string | null;
  coverPhoto: string | null;
  regionCode: RegionCode;
  /** Free-text location label e.g. "Ea Kar District, Dak Lak" */
  locationLabel: string;
  elevationM: number | null;
  primaryVarietals: string[];
  primaryProcessMethods: string[];
  /** Typical cup score range this farmer achieves */
  cupScoreRangeMin: number;
  cupScoreRangeMax: number;
  subsistenceLedger: SubsistenceLedger;
  eudrGeolocation: EudrGeolocation | null;
  reproducibilityAudit: ReproducibilityAudit | null;
  harvestCalendar: HarvestCalendarEntry[];
  /** Agent who verified this farmer profile */
  verifyingAgentId: string | null;
  /** IDs of active lots this farmer has listed in the Catalog */
  activeLotIds: string[];
  followerCount: number;
  followingCount: number;
  totalTipsReceivedCents: number;
  bioText: string | null;
  /** Media wall: photos, voice note URLs, video thumbnails */
  mediaWall: MediaAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface RoasterSpace {
  id: string;
  archetype: 'roaster';
  verificationTier: VerificationTier;
  roasterName: string;
  photo: string | null;
  coverPhoto: string | null;
  locationLabel: string;
  /** Countries / regions they source from */
  sourcingOrigins: string[];
  /** IDs of farmer Spaces they have ongoing relationships with */
  followedFarmerSpaceIds: string[];
  /** Whether this roaster pays above the True Price Floor */
  isBraveFew: boolean;
  /** Their average farmgate paid this season in cents/lb */
  avgFarmgatePaidCentsPerLb: number | null;
  cuppingHistory: CuppingResult[];
  followerCount: number;
  followingCount: number;
  bioText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CafeSpace {
  id: string;
  archetype: 'roaster'; // cafés share the roaster archetype for platform purposes
  verificationTier: VerificationTier;
  cafeName: string;
  photo: string | null;
  coverPhoto: string | null;
  locationLabel: string;
  /** QR menu widget data */
  menuItems: CafeMenuItem[];
  sourcedFromFarmerSpaceIds: string[];
  isBraveFew: boolean;
  followerCount: number;
  followingCount: number;
  bioText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CooperativeSpace {
  id: string;
  archetype: 'cooperative';
  verificationTier: VerificationTier;
  cooperativeName: string;
  photo: string | null;
  coverPhoto: string | null;
  regionCode: RegionCode;
  locationLabel: string;
  memberFarmerCount: number;
  memberFarmerSpaceIds: string[];
  /** Aggregated EUDR compliance percentage */
  eudrCompliancePct: number | null;
  activeLotIds: string[];
  followerCount: number;
  followingCount: number;
  bioText: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AnySpace = FarmerSpace | RoasterSpace | CafeSpace | CooperativeSpace;

// ─── Media Asset ──────────────────────────────────────────────────────────────

export type MediaAssetType = 'photo' | 'voice_note' | 'video_thumbnail' | 'document';

export interface MediaAsset {
  id: string;
  type: MediaAssetType;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  takenAt: string | null;
  /** Agent-captured vs farmer-self-submitted */
  capturedByAgent: boolean;
}

// ─── Café Menu ────────────────────────────────────────────────────────────────

export interface CafeMenuItem {
  name: string;
  origin: string;
  farmerSpaceId: string | null;
  priceUsd: number;
  /** QR link to Economic Autopsy */
  autopsyQrUrl: string | null;
}

// ─── Feeds ────────────────────────────────────────────────────────────────────

export type FeedType = 'market' | 'stories' | 'following';

export type PostType =
  | 'lot_listing'       // new lot published
  | 'price_update'      // farmgate price changed
  | 'harvest_report'    // seasonal harvest progress
  | 'process_experiment'// new fermentation/processing technique
  | 'competition_result'// cupping competition outcome
  | 'transparency_receipt' // true-price receipt published
  | 'tip_milestone'     // farmer reached tip milestone
  | 'media_story';      // photo/video story post

export interface FeedPost {
  id: string;
  feedType: FeedType;
  postType: PostType;
  authorSpaceId: string;
  authorName: string;
  authorArchetype: SpaceArchetype;
  authorVerificationTier: VerificationTier;
  authorPhoto: string | null;
  /** If postType is lot_listing, references a Catalog lot */
  referencedLotId: string | null;
  headline: string;
  bodyText: string | null;
  mediaAsset: MediaAsset | null;
  /** Lot price if relevant */
  lotPriceCentsPerLb: number | null;
  /** Cup score if relevant */
  cupScore: number | null;
  likeCount: number;
  shareCount: number;
  tipCount: number;
  /** Total tips this post has driven in cents */
  tipsTotalCents: number;
  publishedAt: string;
  isPinned: boolean;
}

// ─── Reputation & Competitions ────────────────────────────────────────────────

export interface CuppingResult {
  id: string;
  farmerSpaceId: string;
  lotId: string | null;
  /** Unrounded SCA score — the platform standard */
  cupScore: number;
  /** SCA 7-attribute breakdown */
  attributes: SCAAttributes;
  gradedBy: 'self' | 'agent' | 'q_grader' | 'crowd';
  graderName: string | null;
  notes: string | null;
  gradedAt: string;
}

export interface SCAAttributes {
  fragrance: number;
  flavor: number;
  aftertaste: number;
  acidity: number;
  body: number;
  balance: number;
  sweetness: number;
}

export type CompetitionStatus = 'open' | 'judging' | 'results_published' | 'closed';

export interface CuppingCompetition {
  id: string;
  name: string;
  description: string;
  status: CompetitionStatus;
  /** Blind lot IDs entered into this competition */
  blindLotIds: string[];
  /** Publicly-revealed farmer Space IDs after judging */
  revealedFarmerSpaceIds: string[] | null;
  /** Creator judges by name */
  creatorJudges: string[];
  /** Premium offered to winner above market price (cents/lb) */
  winnerPremiumCentsPerLb: number;
  /** Prize pool total in cents */
  prizePoolCents: number;
  /** Cup scores submitted so far */
  submittedScores: CuppingResult[];
  submissionDeadline: string;
  resultsPublishedAt: string | null;
  createdAt: string;
}

// ─── Brave Few Leaderboard ────────────────────────────────────────────────────

export interface BraveFewEntry {
  rank: number;
  roasterSpaceId: string;
  roasterName: string;
  photo: string | null;
  locationLabel: string;
  /** Their average farmgate paid this season in cents/lb */
  avgFarmgatePaidCentsPerLb: number;
  /** How much above the $3.00/lb floor they pay, in cents */
  premiumAboveFloorCents: number;
  farmerPartnersCount: number;
  seasonLabel: string;
}

// ─── Connections & Tips ───────────────────────────────────────────────────────

export interface TipTransaction {
  id: string;
  fromSpaceId: string;
  fromName: string;
  toFarmerSpaceId: string;
  toFarmerName: string;
  /** Gross tip amount in cents */
  grossAmountCents: number;
  /** Platform fee in cents (small %) */
  platformFeeCents: number;
  /** Net delivered to farmer in cents */
  netAmountCents: number;
  rail: MobileMoneyRail;
  /** Settled / pending / failed */
  status: 'pending' | 'settled' | 'failed';
  /** Reference lot or post that inspired the tip */
  referencedPostId: string | null;
  referencedLotId: string | null;
  message: string | null;
  createdAt: string;
  settledAt: string | null;
}

export interface Conversation {
  id: string;
  participantSpaceIds: string[];
  participantNames: string[];
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

// ─── Economic Autopsy ─────────────────────────────────────────────────────────

export interface PriceChainStep {
  label: string;
  /** Delta at this step in cents/lb (positive = cost added, negative = deducted) */
  deltaCentsPerLb: number;
  /** Cumulative price at this step */
  cumulativeCentsPerLb: number;
  /** Who captures this margin */
  actor: string;
  notes: string | null;
}

export interface EconomicAutopsy {
  lotId: string;
  farmerSpaceId: string;
  /** The full price chain from farmgate to retail cup */
  priceChain: PriceChainStep[];
  /** Farmgate (the first step) */
  farmgateCentsPerLb: number;
  /** Retail or final consumer price */
  finalPriceCentsPerLb: number;
  /** Farmer's share of the final consumer price (%) */
  farmerSharePct: number;
  subsistenceLedger: SubsistenceLedger;
  reproducibilityAudit: ReproducibilityAudit;
  eudrGeolocation: EudrGeolocation | null;
  /** QR code URL that resolves to this autopsy page */
  qrCodeUrl: string;
  generatedAt: string;
}

// ─── Sentinel Scanner ─────────────────────────────────────────────────────────

export type ConditionIssueType =
  | 'roof_damage'
  | 'vegetation_encroachment'
  | 'structural_settling'
  | 'drying_bed_maintenance'
  | 'water_source_risk'
  | 'site_access_decline';

export type ConditionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SentinelFlag {
  id: string;
  farmerSpaceId: string;
  farmerName: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  issueType: ConditionIssueType;
  severity: ConditionSeverity;
  /** VLM confidence score 0–1 */
  confidenceScore: number;
  description: string;
  /** URL to the flagging imagery */
  imageUrl: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  isResolved: boolean;
}
