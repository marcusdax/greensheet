export interface SelectionSlice {
  selectedLotId: string | null;
  compareTray: string[];
  selectLot: (id: string | null) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
}

export const createSelectionSlice = (set: any) => ({
  selectedLotId: null,
  compareTray: [],
  selectLot: (id: string | null) => set((s: any) => { s.selection.selectedLotId = id; }, false, 'selection/selectLot'),
  toggleCompare: (id: string) =>
    set((s: any) => {
      const i = s.selection.compareTray.indexOf(id);
      if (i >= 0) s.selection.compareTray.splice(i, 1);
      else if (s.selection.compareTray.length < 3) s.selection.compareTray.push(id);
    }, false, 'selection/toggleCompare'),
  clearCompare: () => set((s: any) => { s.selection.compareTray = []; }, false, 'selection/clearCompare'),
});
