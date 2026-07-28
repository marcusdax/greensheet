# Greensheet Platform — Technical & Product Documentation

Greensheet is a B2B SaaS platform for specialty coffee green-bean distribution, connecting importers/exporters with coffee roasters. The platform combines advanced, multi-attribute sourcing optimization with automated, adjustable CRM marketing engines and a premium, token-driven editorial design system.

This repository contains the interactive Greensheet web application under the `app/` folder, wired to support localized B2B client operations across multiple international markets.

---

## 1. Platform Architecture

The frontend is engineered as a zero-dependency, high-performance client-side application built on a modern React + TypeScript + Vite stack. It compiles to a lightweight static bundle (~950 kB) optimized for fast loading and zero network latency during interactive operations.

```mermaid
graph TD
    A[React App Layout] --> B[Zustand Root Store]
    B --> C[Sourcing Slice]
    B --> D[Selection Slice]
    B --> E[Campaign Slice]
    B --> F[UI Slice]
    A --> G[React Router v6]
    G --> H[/:locale/navigator]
    G --> I[/:locale/catalog]
    G --> J[/:locale/campaigns]
    G --> K[/:locale/roasters]
    G --> L[/:locale/analytics]
    B --> M[Sourcing Selector Algorithms]
    M --> H
    style A fill:#16323E,stroke:#fff,stroke-width:2px,color:#FDFBF5
    style B fill:#2A6E73,stroke:#fff,stroke-width:2px,color:#FDFBF5
```

### 1.1 State Management (Zustand Unified Store)
State is structured inside a unified Zustand store in [root-store.ts](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/stores/root-store.ts), composed using Immer middleware for immutable draft mutations and Devtools/Persist middlewares for localStorage state sync and diagnostic tracking.

*   **Sourcing Slice ([sourcing-slice.ts](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/stores/slices/sourcing-slice.ts))**: Manages Green Coffee Lot filtering parameters, including target sourcing goals (e.g. Balanced, Cost, ESG, Quality), budget ceilings, min cup scores, search queries, selected origins, and processing methods.
*   **Selection Slice ([selection-slice.ts](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/stores/slices/selection-slice.ts))**: Controls the active lot drawer details and handles the comparison tray (up to 3 lots simultaneously).
*   **Campaign Slice ([campaign-slice.ts](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/stores/slices/campaign-slice.ts))**: Tracks the active email/SMS campaign automation rule steps and view toggles.
*   **UI Slice ([ui-slice.ts](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/stores/slices/ui-slice.ts))**: Manages platform notifications (Toasts), system theme toggling (Light/Dark mode), and local feature flags.

### 1.2 Multi-Attribute Lot Scoring & Utility Algorithm
Green coffee lots are evaluated dynamically on the client based on weights matching the user's active sourcing profile. The algorithm inside [sourcing-selectors.ts](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/stores/selectors/sourcing-selectors.ts) normalizes and computes utility scores for each lot:

$$S_i = w_{\text{cost}} \cdot U_{\text{cost}}(i) + w_{\text{cup}} \cdot U_{\text{cup}}(i) + w_{\text{esg}} \cdot U_{\text{esg}}(i) + w_{\text{speed}} \cdot U_{\text{speed}}(i)$$

Where:
*   **$U_{\text{cost}}(i)$**: Cost utility. Computed as a linear normalization relative to the budget ceiling:
    $$U_{\text{cost}}(i) = 1.0 - \min\left(1.0, \frac{\text{pricePerLb}(i)}{\text{budgetCeiling}}\right)$$
*   **$U_{\text{cup}}(i)$**: Cup Score utility. Evaluated on the Specialty Coffee Association (SCA) 80–100 scale:
    $$U_{\text{cup}}(i) = \frac{\text{cupScore}(i) - 80}{20}$$
*   **$U_{\text{esg}}(i)$**: ESG compliance utility, mapped from the lot's ESG rating (1 to 5 stars):
    $$U_{\text{esg}}(i) = \frac{\text{esgScore}(i) - 1}{4}$$
*   **$U_{\text{speed}}(i)$**: Logistics speed utility, mapped to arrival timelines:
    $$U_{\text{speed}}(i) = 1.0 - \min\left(1.0, \frac{\text{daysToArrival}(i)}{120}\right)$$

Active profiles automatically re-weight these parameters:
1.  **Balanced Sourcing** (Default): Equal weight across all metrics (25% each).
2.  **Cost Optimization**: Prioritizes lowest price (50% Cost, 20% Cup, 15% ESG, 15% Speed).
3.  **Quality Focus**: Prioritizes premium cup quality (10% Cost, 60% Cup, 15% ESG, 15% Speed).
4.  **ESG Champion**: Prioritizes ethical and sustainable certifications (15% Cost, 15% Cup, 55% ESG, 15% Speed).
5.  **Supply Chain Optimized**: Prioritizes immediate shipping and low lead times (15% Cost, 15% Cup, 15% ESG, 55% Speed).

### 1.3 Localization Architecture & Routing
Platform localization is powered by `react-i18next` and a localized route structure in [App.tsx](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/App.tsx).
*   **Zero-Lag Asset Ingestion**: To avoid network fetch lag during client-side rendering, translations (1,036 keys across `en-US`, `zh-CN`, `es-MX`, and `pt-BR` locales) are bundled directly into the JavaScript chunk at compile time via static JSON imports in [i18n/index.ts](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/i18n/index.ts).
*   **Dynamic Language Switcher**: Routing follows `/:locale/:page` path structures. Changing the language in the layout dropdown immediately translates all views and updates the router state asynchronously.

---

## 2. Interactive Product Features & Modules

### 2.1 Sourcing Navigator (`/navigator`)
An advanced green coffee sourcing portal containing dynamic filters and analytical lot ranking widgets:
*   **Dynamic Weighting Sliders**: Allows the user to manually override the active profile's weights to fine-tune recommendations in real-time.
*   **Compact Lot Cards**: Display essential metadata (origin, processing method, elevations, available volume), weighted match scores (0-100), and an interactive compare checkbox.
*   **Comparison Tray**: A bottom-docked panel where users can pin up to 3 lots to inspect side-by-side metrics, cost models, and sensory details.
*   **Lot Detail Drawer**: Slides out to reveal Oblique Flavor Wheel visualization, compliance credentials, cost breakdown graphs (margin vs. FOT cost), and logistics timelines.

### 2.2 Global Catalog (`/catalog`)
A high-density B2B ledger displaying all available lots in a responsive table.
*   **Multi-Column Sorting**: Quick ordering by origin, available pounds, cup scores, price per lb, and arrival dates.
*   **Bulk Actions**: Instant trigger buttons to request samples, compare, or email lots directly to roasters.
*   **Responsive layouts**: Automatically collapses to a card-based grid layout on mobile screens.

### 2.3 Adjustable Marketing Campaigns (`/campaigns`)
The core marketing command center which lets green coffee distributors build, adjust, and track B2B email/SMS outreach:
*   **Active Rules Builder**: A step-based automation inspector that lets users edit triggers, actions (e.g. `SEND_EMAIL`, `SEND_SMS`), delay durations, and target segments for campaign series (COF-001 through COF-005).
*   **A/B Test Variant Cards**: Shows Bayesian-optimized split conversions (e.g. Variant A "SCA Cup Focus" vs. Variant B "ESG Story Focus") detailing sample sizes, conversion rates, and statistical significance values.
*   **Automation Timelines**: Visualized subscriber conversion pipelines demonstrating live status counts.

### 2.4 Roaster CRM (`/roasters`)
A B2B CRM ledger designed to monitor and manage coffee roasters:
*   **Segment Status Badges**: Tracks customer stages including `active`, `trial`, `dormant`, and `churned`.
*   **LTV & Transaction History**: Lists lifetime value and purchase frequencies with formatted currency ledgers.
*   **ML Churn Hazard Indicators**: Highlights at-risk roaster accounts using survival risk models. It outputs hazard ratios (0.0 to 1.0) and flags high-risk accounts (> 0.70) for immediate save-offer interventions.

### 2.5 Portfolio Intelligence & Analytics (`/analytics`)
A detailed analytics suite powered by Recharts:
*   **Cup Quality Benchmark**: A composed chart showing average quality scores compared against market median and peer quantile bands.
*   **Cohort Retention Heatmap**: A structured weekly matrix color-coded (teal to gold) mapping roasters returning by weekly cohort.
*   **LTV:CAC Scatter Chart**: A coordinate chart mapping roaster acquisition cost against lifetime value, featuring a red $3\times$ LTV:CAC floor reference threshold line.
*   **Inventory Forecast & Telemetry**: Depicts actual green-bean depletion rates alongside a forecasted depletion curve and confidence interval cones.
*   **Churn Survival Curve**: Visualizes predicted roaster retention likelihood over weeks using Cox Proportional Hazards survival functions.

---

## 3. Design System & Visual Language

The visual layer is governed by a W3C-compliant Design Token System mapping hex and spacing tokens to theme variables. It is loaded in [tokens.css](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/src/styles/tokens.css) and wired into [tailwind.config.js](file:///c:/Users/wylde/Desktop/greensheet-expansion/app/tailwind.config.js).

### 3.1 Core Color Palette & Surface Tokens
*   **Parchment Ground (`--color-background`)**: `#FDFBF5` (Light mode base)
*   **Ink (`--color-ink`)**: `#1C1917` (High-contrast typography)
*   **Teal/Leaf (`--color-teal`)**: `#2A6E73` (Primary accents and brand highlights)
*   **Cherry/Crimson (`--color-cherry`)**: `#8C3B34` (Warnings, churn indicators, hazard thresholds)
*   **Espresso-Navy (`--color-navy`)**: `#16323E` (Dark mode backgrounds, headers, and tooltips)
*   **Gold/Bronze (`--color-gold`)**: `#C9A34A` (Premium scoring badges and highlighted lots)

### 3.2 Typography Guidelines
*   **Display Title**: *Fraunces* (Serif, weights 400-600). Used for page headers and premium editorial sections.
*   **UI Typography**: *Archivo* (Sans-serif, weights 400-600). Used for clean, legible controls, sidebar navigation, and filters.
*   **Data & Ledgers**: *IBM Plex Mono* (Monospace, weights 400-500). Configured with CSS `.figure` classes to ensure tabular, non-proportional alignment for pricing, weights, and dates.

### 3.3 Elevations & Transitions
*   **Shadows**: Soft, multi-layered elevations (`e1` through `e5`) ranging from basic borders to floating modal sheets.
*   **Motion**: Standard transition timings (`150ms` ease-in-out) applied to all hover states, toggle controls, and collapsing elements. Drawer sheets leverage `framer-motion` spring animations to ensure fluid mobile interaction.

---

## 4. Local Development & Deployment

### 4.1 Prerequisites
*   Node.js (version 18 or higher recommended)
*   npm or yarn package manager

### 4.2 Windows Shell Quirks
> [!IMPORTANT]
> If local PowerShell script execution is restricted on your Windows environment, prefix all script and build executions using `cmd /c` to bypass restriction policies.

### 4.3 Setup & Installation
1. Navigate to the `app/` folder:
   ```cmd
   cd app
   ```
2. Install dependencies:
   ```cmd
   cmd /c "npm install"
   ```

### 4.4 Running the Development Server
To launch the Vite hot-reloading development server locally:
```cmd
cmd /c "npm run dev"
```
The application will start on **[http://localhost:5173/](http://localhost:5173/)**.

### 4.5 Build & Compilation Check
To verify that the application compiles and bundles cleanly for production deployment:
```cmd
cmd /c "npm run build"
```
This command runs TypeScript verification compiles (`tsc -b`) and executes Vite/Rollup bundling. The compiled static output is generated in the `app/dist/` directory.

### 4.6 Linting & Code Verification
To run code linting checks:
```cmd
cmd /c "npm run lint"
```
This utility scans the codebase for unused imports, formatting discrepancies, and React Hooks usage errors.

### 4