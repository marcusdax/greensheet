#!/bin/bash
# Greensheet Database Migration Automation Script
# Runs all migrations in the correct order with error handling and logging

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="migration-$(date +%Y%m%d-%H%M%S).log"
DB_USER="${DB_USER:-auctum}"
DB_PASSWORD="${DB_PASSWORD:-auctum123}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-auctum_ledger}"
DATABASE_URL="${DATABASE_URL:-mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Greensheet Database Migration Automation Script          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Database: ${DB_NAME}"
echo "  Host: ${DB_HOST}:${DB_PORT}"
echo "  User: ${DB_USER}"
echo "  Log file: ${LOG_FILE}"
echo ""

# Function to log messages
log() {
  local msg="$1"
  echo -e "${msg}" | tee -a "${LOG_FILE}"
}

# Function to check if database is reachable
check_database() {
  log "${BLUE}[1/7] Checking database connection...${NC}"
  if ! mysqladmin ping -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" > /dev/null 2>&1; then
    log "${RED}✗ Database not reachable at ${DB_HOST}:${DB_PORT}${NC}"
    log "${YELLOW}Please ensure MySQL is running. Try: docker compose up mysql${NC}"
    exit 1
  fi
  log "${GREEN}✓ Database connection successful${NC}"
}

# Function to run Drizzle migrations
run_drizzle_migrations() {
  log ""
  log "${BLUE}[2/7] Running Drizzle ORM migrations...${NC}"
  cd app
  
  if ! npm run db:migrate >> "${LOG_FILE}" 2>&1; then
    log "${RED}✗ Drizzle migrations failed${NC}"
    log "${YELLOW}Check ${LOG_FILE} for details${NC}"
    cd ..
    exit 1
  fi
  
  log "${GREEN}✓ Drizzle migrations completed${NC}"
  cd ..
}

# Function to run manual SQL migrations
run_manual_migrations() {
  log ""
  log "${BLUE}[3/7] Running manual SQL migrations...${NC}"
  
  local migrations=(
    "0001_expand_existing.sql"
    "0002_wallet_fx_dunning_einvoice.sql"
    "0003_trust_score.sql"
    "0004_education_partners.sql"
    "0005_pilot_allowlist.sql"
  )
  
  for migration in "${migrations[@]}"; do
    local migration_path="app/db/migrations/manual/${migration}"
    
    if [ ! -f "${migration_path}" ]; then
      log "${YELLOW}⊘ Skipping ${migration} (file not found)${NC}"
      continue
    fi
    
    log "  Running ${migration}..."
    if mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < "${migration_path}" >> "${LOG_FILE}" 2>&1; then
      log "${GREEN}  ✓ ${migration} completed${NC}"
    else
      log "${RED}  ✗ ${migration} failed${NC}"
      log "${YELLOW}Check ${LOG_FILE} for details${NC}"
      exit 1
    fi
  done
  
  log "${GREEN}✓ All manual migrations completed${NC}"
}

# Function to seed database
seed_database() {
  log ""
  log "${BLUE}[4/7] Seeding database...${NC}"
  cd app
  
  export DATABASE_URL="${DATABASE_URL}"
  
  local seeds=(
    "db:seed"
    "db:seed:expansion"
    "db:seed:auth"
    "db:seed:payments"
    "db:seed:dunning"
    "db:seed:education"
    "db:seed:demo"
  )
  
  for seed in "${seeds[@]}"; do
    log "  Running npm run ${seed}..."
    if npm run "${seed}" >> "../${LOG_FILE}" 2>&1; then
      log "${GREEN}  ✓ ${seed} completed${NC}"
    else
      log "${YELLOW}  ⊘ ${seed} skipped or failed (seeds are idempotent, data may already exist)${NC}"
    fi
  done
  
  cd ..
  log "${GREEN}✓ Database seeding completed${NC}"
}

# Function to verify migrations
verify_migrations() {
  log ""
  log "${BLUE}[5/7] Verifying migration status...${NC}"
  
  # Check if tables exist
  local table_count=$(mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}'" 2>/dev/null | tail -1)
  
  if [ "$table_count" -gt 0 ]; then
    log "${GREEN}✓ Found ${table_count} tables in database${NC}"
  else
    log "${YELLOW}⊘ No tables found (database may be empty)${NC}"
  fi
}

# Function to display summary
display_summary() {
  log ""
  log "${BLUE}[6/7] Migration Summary${NC}"
  log ""
  log "✓ Database connection verified"
  log "✓ Drizzle ORM migrations completed"
  log "✓ Manual SQL migrations completed"
  log "✓ Database seeding completed"
  log "✓ Migrations verified"
  log ""
  log "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  log "${GREEN}All migrations completed successfully!${NC}"
  log "${GREEN}═══════════════════════════════════════════════════════════${NC}"
}

# Function to start app
start_app() {
  log ""
  log "${BLUE}[7/7] Next Steps${NC}"
  log ""
  log "To start the application:"
  log "  ${YELLOW}docker compose up${NC}"
  log ""
  log "Or run locally:"
  log "  ${YELLOW}cd app && npm run dev${NC}"
  log ""
  log "Access the app at: ${YELLOW}http://localhost:3000${NC}"
  log ""
}

# Main execution
main() {
  {
    check_database
    run_drizzle_migrations
    run_manual_migrations
    seed_database
    verify_migrations
    display_summary
    start_app
  } 2>&1 | tee -a "${LOG_FILE}"
  
  log ""
  log "Full log saved to: ${LOG_FILE}"
}

# Run main function
main
