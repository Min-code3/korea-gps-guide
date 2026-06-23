import { create } from 'zustand';
import { Attraction, GuideStatus, UserPosition } from './types';
import { trackAutoplayToggled, trackGuideStarted, trackPinTriggered, trackGuideCompleted } from './analytics';

interface GuideStore {
  attraction: Attraction | null;
  setAttraction: (a: Attraction) => void;

  userPosition: UserPosition | null;
  setUserPosition: (pos: UserPosition) => void;

  status: GuideStatus;
  aBlockIndex: number;
  triggeredPinId: string | null;
  pendingPinId: string | null;
  visitedPinIds: string[];

  isPlaying: boolean;
  progress: number;
  duration: number;
  setIsPlaying: (v: boolean) => void;
  setProgress: (v: number) => void;
  setDuration: (v: number) => void;

  seekTo: (ratio: number) => void;
  togglePause: () => void;
  setPlayerControls: (seek: (r: number) => void, toggle: () => void) => void;

  startGuide: () => void;
  resumeGuide: () => void;
  prevBlock: () => void;
  nextBlock: () => void;

  autoPlayEnabled: boolean;
  toggleAutoPlay: () => void;

  triggerPin: (pinId: string) => void;
  triggerPinImmediate: (pinId: string) => void;
  triggerPinManual: (pinId: string) => void;
  goToABlock: (idx: number) => void;

  onABlockEnd: () => void;
  onBBlockEnd: () => void;
}

export const useGuideStore = create<GuideStore>((set, get) => ({
  attraction: null,
  setAttraction: (attraction) => set({ attraction }),

  userPosition: null,
  setUserPosition: (pos) => set({ userPosition: pos }),

  status: 'IDLE',
  aBlockIndex: 0,
  triggeredPinId: null,
  pendingPinId: null,
  visitedPinIds: [],

  isPlaying: false,
  progress: 0,
  duration: 0,
  setIsPlaying: (v) => set({ isPlaying: v }),
  setProgress: (v) => set({ progress: v }),
  setDuration: (v) => set({ duration: v }),

  autoPlayEnabled: true,
  toggleAutoPlay: () => {
    const next = !get().autoPlayEnabled;
    trackAutoplayToggled(next);
    set({ autoPlayEnabled: next });
  },

  seekTo: () => {},
  togglePause: () => {},
  setPlayerControls: (seek, toggle) => set({ seekTo: seek, togglePause: toggle }),

  startGuide: () => {
    const { attraction } = get();
    if (!attraction) return;
    trackGuideStarted(attraction.id, attraction.name);
    if (attraction.aBlocks.length === 0) {
      // No A-guide — play first pin's B guide immediately
      const firstPin = attraction.pins[0];
      if (!firstPin) return;
      set({
        status: 'B_PLAYING',
        triggeredPinId: firstPin.id,
        visitedPinIds: [firstPin.id],
        aBlockIndex: 0,
        pendingPinId: null,
      });
    } else {
      set({ status: 'A_PLAYING', aBlockIndex: 0, visitedPinIds: [], pendingPinId: null });
    }
  },

  resumeGuide: () => {
    const { attraction, aBlockIndex, visitedPinIds } = get();
    if (!attraction) return;
    const nextIndex = aBlockIndex + 1;
    if (nextIndex < attraction.aBlocks.length) {
      set({ status: 'A_PLAYING', aBlockIndex: nextIndex, triggeredPinId: null });
    } else {
      // A guide done — play any unvisited B guides automatically
      const unvisited = attraction.pins.find((p) => !visitedPinIds.includes(p.id) && p.autoPlay !== false && p.bBlock);
      if (unvisited) {
        set({
          status: 'B_PLAYING',
          triggeredPinId: unvisited.id,
          pendingPinId: null,
          visitedPinIds: [...visitedPinIds, unvisited.id],
        });
      } else {
        trackGuideCompleted(attraction.id, attraction.name);
        set({ status: 'GUIDE_ENDED', triggeredPinId: null });
      }
    }
  },

  prevBlock: () => {
    const { status, aBlockIndex } = get();
    if (status !== 'A_PLAYING' && status !== 'GUIDE_ENDED') return;
    if (aBlockIndex <= 0) return;
    set({ status: 'A_PLAYING', aBlockIndex: aBlockIndex - 1 });
  },

  nextBlock: () => {
    const { attraction, status, aBlockIndex } = get();
    if (!attraction) return;
    if (status !== 'A_PLAYING' && status !== 'GUIDE_ENDED') return;
    if (aBlockIndex >= attraction.aBlocks.length - 1) return;
    set({ status: 'A_PLAYING', aBlockIndex: aBlockIndex + 1 });
  },

  triggerPin: (pinId: string) => {
    const { attraction, status, visitedPinIds } = get();
    const pin = attraction?.pins.find((p) => p.id === pinId);
    if (!pin?.bBlock) return;
    if (visitedPinIds.includes(pinId)) return;
    trackPinTriggered(pinId, pin.name, 'gps', attraction?.id);

    if (status === 'A_PLAYING') {
      set({ pendingPinId: pinId });
    } else if (status === 'GUIDE_ENDED' || status === 'IDLE') {
      set({
        status: 'B_PLAYING',
        triggeredPinId: pinId,
        pendingPinId: null,
        visitedPinIds: [...visitedPinIds, pinId],
      });
    }
  },

  // Immediately switch to B-guide, bypassing current A-block (used when paused + autoPlay ON)
  triggerPinImmediate: (pinId: string) => {
    const { attraction, visitedPinIds } = get();
    const pin = attraction?.pins.find((p) => p.id === pinId);
    if (!pin?.bBlock) return;
    if (visitedPinIds.includes(pinId)) return;
    trackPinTriggered(pinId, pin.name, 'gps', attraction?.id);
    set({
      status: 'B_PLAYING',
      triggeredPinId: pinId,
      pendingPinId: null,
      visitedPinIds: [...visitedPinIds, pinId],
    });
  },

  triggerPinManual: (pinId: string) => {
    const { attraction, status, visitedPinIds } = get();
    const pin = attraction?.pins.find((p) => p.id === pinId);
    if (!pin?.bBlock) return;
    trackPinTriggered(pinId, pin.name, 'manual', attraction?.id);

    // Manual tap always plays immediately
    set({
      status: 'B_PLAYING',
      triggeredPinId: pinId,
      pendingPinId: null,
      visitedPinIds: visitedPinIds.includes(pinId) ? visitedPinIds : [...visitedPinIds, pinId],
    });
  },

  goToABlock: (idx: number) => {
    const { attraction } = get();
    if (!attraction) return;
    if (idx < 0 || idx >= attraction.aBlocks.length) return;
    set({ status: 'A_PLAYING', aBlockIndex: idx, triggeredPinId: null, pendingPinId: null });
  },

  onABlockEnd: () => {
    const { attraction, aBlockIndex, pendingPinId, visitedPinIds } = get();
    if (!attraction) return;

    if (pendingPinId) {
      set({
        status: 'B_PLAYING',
        triggeredPinId: pendingPinId,
        pendingPinId: null,
        visitedPinIds: [...visitedPinIds, pendingPinId],
      });
      return;
    }

    const nextIndex = aBlockIndex + 1;
    if (nextIndex < attraction.aBlocks.length) {
      set({ status: 'A_PLAYING', aBlockIndex: nextIndex });
    } else {
      // A guide done — play any unvisited B guides automatically
      const unvisited = attraction.pins.find((p) => !visitedPinIds.includes(p.id) && p.autoPlay !== false && p.bBlock);
      if (unvisited) {
        set({
          status: 'B_PLAYING',
          triggeredPinId: unvisited.id,
          pendingPinId: null,
          visitedPinIds: [...visitedPinIds, unvisited.id],
        });
      } else {
        trackGuideCompleted(attraction.id, attraction.name);
        set({ status: 'GUIDE_ENDED' });
      }
    }
  },

  // B ends → auto-resume A guide
  onBBlockEnd: () => {
    get().resumeGuide();
  },
}));
