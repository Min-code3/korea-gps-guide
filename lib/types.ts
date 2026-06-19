export interface AudioBlock {
  id: string;
  src: string;
  title?: string; // shown in the playlist panel
}

export interface Pin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  pinType?: 'photo' | 'spot';
  autoPlay?: boolean; // default true (B guide) — false = C guide
  routeOrder?: number;    // if set, shows number inside circle
  isMainRoute?: boolean;  // true=blue, false=gray (only used when routeOrder is set)
  bBlock?: AudioBlock; // optional — if absent, pin is a map marker only
}

export interface Attraction {
  id: string;
  contentId?: string; // kor_content_id — gallery lazy load에 사용
  name: string;
  sectors?: string[];
  attractionOrder?: number;
  description?: string;
  guideTitle?: string; // shown in audio guide player — falls back to name if not set
  admission?: string; // e.g. "Free" or "₩3,000"
  hours?: string;     // e.g. "9:00 ~ 22:00"
  center: { lat: number; lng: number };
  center2?: { lat: number; lng: number };
  routePins?: { lat: number; lng: number; order: number }[]; // 지역 페이지 복수 좌표 핀
  defaultZoom: number;
  star?: string;
  tags?: string[];
  images?: string[];
  aBlocks: AudioBlock[];
  pins: Pin[];
}

export interface Tour {
  id: string;
  name: string;
  description?: string;
  tags?: string[]; // displayed as chips below the title
  center: { lat: number; lng: number };
  defaultZoom: number;
  attractions: Attraction[];
}

export interface LocalRestaurant {
  id: string;
  contentid?: string;
  name: string;
  addr?: string;
  center?: { lat: number; lng: number };
  image?: string;
  tel?: string;
  signature?: string;
  menu?: string;
  hours?: string;
  closed?: string;
}

export interface RestaurantPin {
  contentid: string;
  title: string;
  lat: number;
  lng: number;
}

export type GuideStatus =
  | 'IDLE'
  | 'A_PLAYING'
  | 'GUIDE_ENDED'
  | 'B_PLAYING';

export interface UserPosition {
  lat: number;
  lng: number;
  accuracy: number;
  heading?: number | null; // degrees from north, null if unavailable
}
