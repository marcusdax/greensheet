export interface CampaignSlice {
  activeStep: number;
  viewMode: 'detailed' | 'summary';
  setActiveStep: (i: number) => void;
  toggleViewMode: () => void;
}

export const createCampaignSlice = (set: any) => ({
  activeStep: 0,
  viewMode: 'detailed' as const,
  setActiveStep: (i: number) => set((s: any) => { s.campaign.activeStep = i; }, false, 'campaign/setActiveStep'),
  toggleViewMode: () =>
    set((s: any) => { s.campaign.viewMode = s.campaign.viewMode === 'detailed' ? 'summary' : 'detailed'; },
        false, 'campaign/toggleViewMode'),
});
