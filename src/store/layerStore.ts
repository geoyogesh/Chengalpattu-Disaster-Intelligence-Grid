import { create } from 'zustand';

import { GEO_LAYERS } from '@/data/geoLayers';

interface LayerUIState {
  visible: boolean;
  opacity: number;
}

interface LayerState {
  /** Per-layer UI state, plus the 'osm' basemap and 'admin' group pseudo-keys. */
  layers: Record<string, LayerUIState>;
  toggleLayer: (id: string, visible?: boolean) => void;
  setOpacity: (id: string, opacity: number) => void;
  showAll: () => void;
  hideAll: () => void;
}

// Admin-group members share one panel toggle ('admin'); which one draws is
// decided by zoom in MapView. Everything else is OFF by default so the app
// opens showing only administrative boundaries.
const adminIds = GEO_LAYERS.filter((l) => l.adminGroup).map((l) => l.id);

const initialLayers: Record<string, LayerUIState> = {
  osm: { visible: false, opacity: 1 },
  // The admin group starts ON.
  admin: { visible: true, opacity: 0.85 },
  ...Object.fromEntries(
    GEO_LAYERS.map((l) => [
      l.id,
      // Honour the registry's defaultVisible so the map opens meaningful: the
      // flood "hero" layers (water bodies + rivers) are on, plus admin.
      { visible: l.adminGroup ? true : l.defaultVisible, opacity: 0.85 },
    ]),
  ),
};

export const useLayerStore = create<LayerState>((set) => ({
  layers: initialLayers,
  toggleLayer: (id, visible) =>
    set((state) => {
      const current = state.layers[id];
      if (!current) return state;
      const next = { ...current, visible: visible ?? !current.visible };
      const updated = { ...state.layers, [id]: next };
      // Toggling the 'admin' group flips both admin member layers together.
      if (id === 'admin') {
        for (const memberId of adminIds) {
          if (updated[memberId]) {
            updated[memberId] = { ...updated[memberId], visible: next.visible };
          }
        }
      }
      return { layers: updated };
    }),
  setOpacity: (id, opacity) =>
    set((state) => {
      const current = state.layers[id];
      if (!current) return state;
      const updated = { ...state.layers, [id]: { ...current, opacity } };
      if (id === 'admin') {
        for (const memberId of adminIds) {
          if (updated[memberId]) {
            updated[memberId] = { ...updated[memberId], opacity };
          }
        }
      }
      return { layers: updated };
    }),
  showAll: () =>
    set((state) => ({
      layers: Object.fromEntries(
        Object.entries(state.layers).map(([k, v]) => [k, { ...v, visible: true }]),
      ),
    })),
  hideAll: () =>
    set((state) => ({
      layers: Object.fromEntries(
        Object.entries(state.layers).map(([k, v]) => [k, { ...v, visible: false }]),
      ),
    })),
}));

// Expose the store to automated tests so they can drive layer state the same
// way the UI does (rather than mutating the map imperatively).
(window as unknown as { __layerStore?: typeof useLayerStore }).__layerStore =
  useLayerStore;
