
const mysql = require("mysql2/promise");
const fs = require("fs");
const env = {};
for (const line of fs.readFileSync(".env","utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const statements = [
  "ALTER TABLE dispatches MODIFY channel ENUM('email','sms','whatsapp','crm','system') NOT NULL",
  "ALTER TABLE dispatches MODIFY status ENUM('sent','queued','halted','lifecycle_updated','converted') NOT NULL DEFAULT 'sent'",
  "ALTER TABLE roasters ADD COLUMN whatsappNumber varchar(40) NULL",
  `CREATE TABLE IF NOT EXISTS warehouse_exceptions (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    lotId bigint unsigned NULL,
    containerNumber varchar(60) NOT NULL DEFAULT '',
    exceptionType ENUM('seal_compromise','weight_moisture_variance','quality_anomaly','partial_compromise','equipment_failure','customs_inspection') NOT NULL,
    tier int NOT NULL,
    status ENUM('open','hard_hold','quarantine','investigating','resolved','closed') NOT NULL DEFAULT 'open',
    disposition ENUM('release','downgrade','reject_claim','reverify_partition') NULL,
    description text NOT NULL,
    rootCause varchar(255) NOT NULL DEFAULT '',
    atFaultParty ENUM('supplier','carrier','customs','greensheet','indeterminate') NULL,
    financialCents int NOT NULL DEFAULT 0,
    slaDueAt timestamp NULL,
    resolvedAt timestamp NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX exceptions_tier_idx (tier), INDEX exceptions_status_idx (status)
  )`,
  `CREATE TABLE IF NOT EXISTS exception_events (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    exceptionId bigint unsigned NOT NULL,
    note varchar(500) NOT NULL,
    actor varchar(120) NOT NULL DEFAULT 'system',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX exception_events_idx (exceptionId)
  )`,
  `CREATE TABLE IF NOT EXISTS retained_samples (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    lotId bigint unsigned NULL,
    lotCode varchar(60) NOT NULL,
    containerNumber varchar(60) NOT NULL DEFAULT '',
    bagPosition varchar(40) NOT NULL DEFAULT 'middle',
    pulledBy varchar(120) NOT NULL,
    storageLocation varchar(120) NOT NULL DEFAULT 'Cabinet A',
    status ENUM('sealed','opened','destroyed','lost') NOT NULL DEFAULT 'sealed',
    openedCount int NOT NULL DEFAULT 0,
    destructionEligibleAt timestamp NULL,
    destroyedAt timestamp NULL,
    destructionMethod varchar(60) NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX samples_lot_idx (lotId), INDEX samples_status_idx (status)
  )`,
  `CREATE TABLE IF NOT EXISTS sample_access_logs (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sampleId bigint unsigned NOT NULL,
    accessedBy varchar(120) NOT NULL,
    purpose varchar(255) NOT NULL,
    quantityGrams double NOT NULL DEFAULT 0,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX access_logs_sample_idx (sampleId)
  )`,
  `CREATE TABLE IF NOT EXISTS cupping_sessions (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sampleId bigint unsigned NULL,
    lotCode varchar(60) NOT NULL,
    isPanel boolean NOT NULL DEFAULT false,
    cuppers varchar(255) NOT NULL,
    fragrance double NOT NULL, flavor double NOT NULL, aftertaste double NOT NULL,
    acidity double NOT NULL, body double NOT NULL, balance double NOT NULL,
    uniformity double NOT NULL, cleanliness double NOT NULL, sweetness double NOT NULL,
    overall double NOT NULL, totalScore double NOT NULL,
    referenceScore double NULL, deltaVsReference double NULL, toleranceBand double NULL,
    verdict ENUM('within_tolerance','outside_tolerance','red_flag') NULL,
    redFlags varchar(255) NOT NULL DEFAULT '',
    notes text NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX cupping_lot_idx (lotCode)
  )`,
  `CREATE TABLE IF NOT EXISTS partners (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    partnerName varchar(255) NOT NULL,
    partnerType ENUM('farmer','collector') NOT NULL,
    originRegion varchar(120) NOT NULL,
    partnerTier ENUM('tier_a','tier_b','tier_c') NOT NULL DEFAULT 'tier_b',
    agreementStatus ENUM('draft','active','terminated') NOT NULL DEFAULT 'active',
    email varchar(320) NOT NULL DEFAULT '',
    phone varchar(40) NOT NULL DEFAULT '',
    effectiveDate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX partners_type_idx (partnerType)
  )`,
  `CREATE TABLE IF NOT EXISTS lot_addenda (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    partnerId bigint unsigned NOT NULL,
    lotId bigint unsigned NULL,
    lotCode varchar(60) NOT NULL,
    processingProtocol varchar(255) NOT NULL DEFAULT '',
    floorPricePerLbCents int NOT NULL,
    expectedQtyLbs int NOT NULL DEFAULT 0,
    deliveryWindow varchar(120) NOT NULL DEFAULT '',
    status ENUM('pending','delivered','verified','sold','settled') NOT NULL DEFAULT 'pending',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX addenda_partner_idx (partnerId)
  )`,
  `CREATE TABLE IF NOT EXISTS partner_payments (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    partnerId bigint unsigned NOT NULL,
    addendumId bigint unsigned NOT NULL,
    paymentType ENUM('floor','revenue_share') NOT NULL,
    amountCents int NOT NULL,
    status ENUM('accrued','paid','held') NOT NULL DEFAULT 'accrued',
    receipt text NOT NULL,
    paidAt timestamp NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX payments_partner_idx (partnerId), INDEX payments_addendum_idx (addendumId)
  )`,
  `CREATE TABLE IF NOT EXISTS collector_pass_throughs (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    partnerId bigint unsigned NOT NULL,
    addendumId bigint unsigned NOT NULL,
    farmerName varchar(255) NOT NULL,
    pctOfLot double NOT NULL,
    floorOwedCents int NOT NULL DEFAULT 0,
    floorPaidAt timestamp NULL,
    rsOwedCents int NOT NULL DEFAULT 0,
    rsPaidAt timestamp NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX pass_through_partner_idx (partnerId)
  )`,
  `CREATE TABLE IF NOT EXISTS sop_documents (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code varchar(40) NOT NULL,
    title varchar(255) NOT NULL,
    category ENUM('warehouse','cupping','samples','agreements','marketing') NOT NULL,
    summary varchar(500) NOT NULL DEFAULT '',
    content text NOT NULL,
    version varchar(20) NOT NULL DEFAULT '1.0',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY sop_code_unique (code),
    INDEX sop_category_idx (category)
  )`,
  `CREATE TABLE IF NOT EXISTS sop_acknowledgments (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    documentId bigint unsigned NOT NULL,
    personName varchar(120) NOT NULL,
    role varchar(120) NOT NULL DEFAULT '',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX sop_ack_doc_idx (documentId)
  )`,
  `CREATE TABLE IF NOT EXISTS waitlist_signups (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product ENUM('foundry','lotspace') NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(320) NOT NULL,
    company varchar(255) NOT NULL DEFAULT '',
    interest varchar(500) NOT NULL DEFAULT '',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY waitlist_unique_idx (product, email)
  )`,
  `CREATE TABLE IF NOT EXISTS referrals (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code varchar(40) NOT NULL,
    referrerRoasterId bigint unsigned NOT NULL,
    referredRoasterId bigint unsigned NOT NULL,
    status ENUM('signed_up','kit_sent','rewarded') NOT NULL DEFAULT 'signed_up',
    rewardNote varchar(255) NOT NULL DEFAULT '',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX referrals_referrer_idx (referrerRoasterId)
  )`,
  `CREATE TABLE IF NOT EXISTS marketing_posts (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    pillar varchar(10) NOT NULL,
    channel ENUM('linkedin','instagram','twitter','tiktok','newsletter') NOT NULL,
    title varchar(255) NOT NULL,
    body text NOT NULL,
    week int NOT NULL,
    status ENUM('draft','scheduled','published') NOT NULL DEFAULT 'draft',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX posts_pillar_idx (pillar)
  )`,
  `CREATE TABLE IF NOT EXISTS pricing_link_clicks (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    roasterId bigint unsigned NOT NULL,
    lotId bigint unsigned NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX clicks_roaster_idx (roasterId)
  )`,
  "ALTER TABLE automation_rules ADD UNIQUE KEY automation_rules_ruleCode_unique (ruleCode)",
  `CREATE TABLE IF NOT EXISTS users (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email varchar(320) NOT NULL,
    name varchar(120) NOT NULL,
    passwordHash varchar(255) NOT NULL,
    role ENUM('platform_admin','ops_manager','sales_csm','analyst','roaster_buyer') NOT NULL DEFAULT 'roaster_buyer',
    roasterId bigint unsigned NULL,
    active boolean NOT NULL DEFAULT true,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY users_email_unique (email),
    INDEX users_roaster_idx (roasterId)
  )`,
  `CREATE TABLE IF NOT EXISTS shipment_intakes (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    lotId bigint unsigned NULL,
    consignor varchar(255) NOT NULL DEFAULT '',
    consignee varchar(255) NOT NULL DEFAULT '',
    containerNumber varchar(60) NOT NULL DEFAULT '',
    sealNumber varchar(60) NOT NULL DEFAULT '',
    grossWeightLbs int NOT NULL DEFAULT 0,
    shippedAt timestamp NULL,
    arrivedAt timestamp NULL,
    source ENUM('manual','docintake') NOT NULL DEFAULT 'manual',
    extractionJson text NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX intakes_lot_idx (lotId)
  )`,
];
(async () => {
  const conn = await mysql.createConnection({ uri: env.DATABASE_URL });
  for (const s of statements) {
    const label = s.slice(0, 70).replace(/\s+/g, " ");
    try { await conn.query(s); console.log("OK  ", label); }
    catch (e) {
      if (e.code === "ER_DUP_FIELDNAME" || e.code === "ER_DUP_KEYNAME" || String(e.message).includes("Duplicate"))
        console.log("SKIP", label, "-", e.message.slice(0, 60));
      else { console.log("FAIL", label, "-", e.message); }
    }
  }
  const [tables] = await conn.query("SHOW TABLES");
  console.log("TABLES:", tables.map(t => Object.values(t)[0]).sort().join(", "));
  await conn.end();
})();
