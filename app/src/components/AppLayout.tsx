import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUi } from '../stores/root-store';
import { SUPPORTED_LOCALES } from '../i18n';
import type { Locale } from '../i18n';
import { LotDetailDrawer } from './LotDetailDrawer';
import { ComparisonTray } from './ComparisonTray';
import { ToastContainer } from './ui/ToastContainer';
import { AgentChatWidget } from './agent/AgentChatWidget';
import {
  Scale, Coins, Star, Sprout, Ship, Search, Sun, Moon,
  Bell, Globe, Menu, X, ChevronDown,
  Layers, Sparkles, Package, ShoppingCart, Webhook, TrendingUp
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation(['common']);
  
  const ui = useUi();
  const { setTheme } = ui;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Sync route locale segment with i18n
  useEffect(() => {
    if (locale && SUPPORTED_LOCALES.includes(locale as Locale)) {
      if (i18n.language !== locale) {
        i18n.changeLanguage(locale);
      }
    } else {
      // Redirect to default locale if missing or invalid
      const detectedLng = localStorage.getItem('greensheet:locale') || 'en-US';
      const pathSuffix = location.pathname === '/' ? '/navigator' : location.pathname;
      navigate(`/${detectedLng}${pathSuffix}`, { replace: true });
    }
  }, [locale, navigate, i18n, location.pathname]);

  // Set theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('greensheet:theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'light';
    setTheme(initialTheme);
  }, [setTheme]);

  const changeLanguage = (newLng: Locale) => {
    setLangDropdownOpen(false);
    localStorage.setItem('greensheet:locale', newLng);
    
    // Replace locale in path
    if (locale) {
      const newPath = location.pathname.replace(`/${locale}`, `/${newLng}`);
      navigate(newPath);
    }
  };

  const getBreadcrumb = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return t('nav.dashboard', 'Dashboard');
    const page = segments[1];
    return t(`nav.${page}`, page.charAt(0).toUpperCase() + page.slice(1));
  };

  const menuGroups = [
    {
      title: 'SOURCE',
      items: [
        { path: 'navigator', label: t('nav.navigator', 'Navigator'), icon: Scale },
        { path: 'catalog', label: t('nav.catalog', 'Catalog'), icon: Ship },
        { path: 'reservations', label: t('nav.reservations', 'Reservations'), icon: Layers },
      ]
    },
    {
      title: 'ENGAGE',
      items: [
        { path: 'campaigns', label: t('nav.campaigns', 'Campaigns'), icon: Coins },
        { path: 'automation-rules', label: t('nav.automationRules', 'Automation Rules'), icon: Sparkles },
      ]
    },
    {
      title: 'RELATIONSHIPS',
      items: [
        { path: 'roasters', label: t('nav.roasters', 'Roasters'), icon: Sprout },
        { path: 'sample-kits', label: t('nav.sampleKits', 'Sample Kits'), icon: Package },
        { path: 'orders', label: t('nav.orders', 'Orders'), icon: ShoppingCart },
      ]
    },
    {
      title: 'INTELLIGENCE',
      items: [
        { path: 'analytics', label: t('nav.analytics', 'Analytics'), icon: Star },
        { path: 'growth', label: t('nav.growth', 'Growth'), icon: TrendingUp },
        { path: 'webhooks', label: t('nav.webhooks', 'Webhooks'), icon: Webhook },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans transition-colors duration-base">
      {/* Skip Link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-teal text-white px-4 py-2 rounded-md z-max shadow-e3">
        Skip to main content
      </a>

      <div className="flex flex-1 relative">
        {/* Sidebar Container */}
        {/* Scrim for Mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-overlay bg-navy-900/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`fixed md:sticky top-0 bottom-0 left-0 z-overlay md:z-auto w-[264px] bg-navy text-parchment-200 flex flex-col border-r border-navy-800 transition-transform duration-slow ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } h-screen shrink-0`}>
          {/* Logo Section */}
          <div className="h-16 px-6 border-b border-navy-800 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-2xl font-display font-medium text-parchment-50 leading-none">
                Greensheet
              </span>
              <span className="text-[9px] font-mono tracking-widest text-[#A9A08C] uppercase mt-1">
                BY ODASI
              </span>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="p-1 md:hidden text-parchment-50/70 hover:text-white rounded-md hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {menuGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <span className="block px-3 text-[10px] font-mono tracking-widest text-[#A9A08C] uppercase font-bold">
                  {group.title}
                </span>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={`/${locale || 'en-US'}/${item.path}`}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) => 
                          `h-10 px-3 rounded-md flex items-center gap-3 font-medium text-sm transition-all focus-visible:ring-1 focus-visible:ring-teal relative ${
                            isActive 
                              ? 'bg-teal text-white shadow-sm font-semibold' 
                              : 'text-parchment-50/70 hover:text-white hover:bg-white/5'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-gold rounded-r-sm" />
                            )}
                            <Icon size={18} className={isActive ? 'text-white' : 'text-parchment-50/50'} />
                            <span>{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer of Sidebar */}
          <div className="p-4 border-t border-navy-800 text-[10px] text-parchment-50/40 font-mono text-center">
            ODASI Technologies • Navigate Your Reality
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-16 bg-surface border-b border-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-sticky shadow-sm">
            {/* Left side: Mobile Toggle & Breadcrumbs */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md md:hidden focus-visible:ring-2 focus-visible:ring-teal"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>
              <nav className="text-xs font-mono font-bold text-muted uppercase tracking-wider">
                {getBreadcrumb()}
              </nav>
            </div>

            {/* Right side: Search, Theme, Language, Profile */}
            <div className="flex items-center gap-4">
              
              {/* Global search */}
              <div className="relative hidden md:block">
                <input 
                  type="text" 
                  placeholder={t('common:a11y.globalSearch', 'Search lots, roasters…')} 
                  className="w-48 xl:w-60 pl-8 pr-3 py-1.5 border border-border bg-recessed/20 text-xs rounded-md focus:w-64 focus:border-teal font-sans transition-all duration-base text-ink"
                />
                <Search size={12} className="absolute left-2.5 top-2.5 text-subtle" />
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => ui.toggleTheme()}
                className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-teal"
                aria-label="Toggle theme"
              >
                {ui.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>

              {/* Language switcher */}
              <div className="relative">
                <button
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs border border-border-interactive rounded-md hover:bg-recessed font-sans text-ink font-semibold focus-visible:ring-2 focus-visible:ring-teal"
                  aria-haspopup="listbox"
                  aria-expanded={langDropdownOpen}
                >
                  <Globe size={14} className="text-subtle" />
                  <span>
                    {locale === 'zh-CN' ? '简体中文' : locale === 'es-MX' ? 'Español' : locale === 'pt-BR' ? 'Português' : 'English'}
                  </span>
                  <ChevronDown size={12} className="text-subtle" />
                </button>
                {langDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-dropdown" onClick={() => setLangDropdownOpen(false)} />
                    <ul className="absolute right-0 mt-1.5 w-40 bg-surface border border-border rounded-lg shadow-e3 py-1 z-dropdown text-xs font-sans">
                      {SUPPORTED_LOCALES.map((lng) => (
                        <li key={lng}>
                          <button
                            onClick={() => changeLanguage(lng)}
                            className={`w-full text-left px-3 py-2 hover:bg-recessed focus-visible:ring-2 focus-visible:ring-teal ${
                              locale === lng ? 'text-teal font-bold' : 'text-ink font-medium'
                            }`}
                          >
                            {lng === 'en-US' && 'English (US)'}
                            {lng === 'zh-CN' && '简体中文'}
                            {lng === 'es-MX' && 'Español (México)'}
                            {lng === 'pt-BR' && 'Português (Brasil)'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* Notifications */}
              <button className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md relative transition-colors focus-visible:ring-2 focus-visible:ring-teal">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-4 h-4 bg-cherry text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
                  3
                </span>
              </button>

              {/* User Avatar */}
              <div className="w-8 h-8 rounded-full border border-border-strong overflow-hidden bg-recessed flex items-center justify-center font-bold text-xs shadow-sm cursor-pointer hover:border-teal">
                JD
              </div>
            </div>
          </header>

          {/* Main Content scrollable grid */}
          <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 bg-canvas max-w-[1280px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Lot Detail Drawer */}
      <LotDetailDrawer />

      {/* Lot Comparison Tray */}
      <ComparisonTray />

      {/* Global Toast Container */}
      <ToastContainer />

      {/* AI Agent Widget */}
      <AgentChatWidget />
    </div>
  );
};
