/**
 * Analytics event tracking
 *
 * 모든 이벤트에 in_field 속성이 자동 포함됩니다.
 * in_field: true  → location_ping이 이 세션에 발생 = 현장 여행자
 * in_field: false → 아직 위치 감지 없음 = 탐색 중인 여행자 (예정 방문)
 *
 * 이 구분이 PM 포트폴리오의 핵심 인사이트입니다.
 * "탐색형과 현장형 사용자의 행동 차이를 데이터로 증명"
 */

import { track as phTrack } from '@/lib/posthog';

// 세션 내 현장 여부 플래그 (location_ping 발생 시 true로 전환)
export function markInField() {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('in_field', 'true');
  }
}

function isInField(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem('in_field') === 'true';
}

function track(event: string, props?: Record<string, unknown>) {
  phTrack(event, { ...props, in_field: isInField() });
}

// ── 홈 화면 ─────────────────────────────────────────────────────────

/** 홈 화면 진입 */
export function trackHomeView(lang: string) {
  track('home_view', { lang });
}

/** 홈에서 지역 카드 클릭 */
export function trackAreaSelected(area: string, lang: string) {
  track('area_selected', { area, lang });
}

/** 홈 이벤트 탭 열기 */
export function trackHomeEventTabOpen(lang: string) {
  track('home_event_tab_open', { lang });
}

// ── 지역 페이지 ──────────────────────────────────────────────────────

/** 메인 탭 전환 (하이라이트/섹터/식당/행사) */
export function trackTabSwitch(area: string, tab: string, lang: string) {
  track('tab_switched', { area, tab, lang });
}

/** 명소 카드 탭 */
export function trackAttractionViewed(
  area: string,
  attractionName: string,
  tab: string,
  hasGuide: boolean,
  lang: string,
) {
  track('attraction_viewed', { area, attraction_name: attractionName, tab, has_guide: hasGuide, lang });
}

/** 섹터 칩 전환 */
export function trackSectorSwitched(area: string, sector: string, lang: string) {
  track('sector_switched', { area, sector, lang });
}

/** 식당 서브탭 전환 (nearby/local) */
export function trackRestaurantTabOpen(area: string, type: 'nearby' | 'local', lang: string) {
  track('restaurant_tab_opened', { area, type, lang });
}

/** 행사 상세 열기 */
export function trackEventDetailOpened(
  area: string,
  eventTitle: string,
  source: 'events_tab' | 'sector_tab' | 'home',
  lang: string,
) {
  track('event_detail_opened', { area, event_title: eventTitle, source, lang });
}

// ── 언어 전환 ────────────────────────────────────────────────────────

/** 언어 토글 */
export function trackLanguageSwitched(from: string, to: string) {
  track('language_switched', { from, to });
}

// ── 외부 링크 ────────────────────────────────────────────────────────

/** 외부 링크 클릭 (티켓, 운영시간, 구글맵 길찾기 등) */
export function trackExternalLinkClick(
  linkType: 'ticket' | 'hours' | 'directions',
  context: { area?: string; name: string },
) {
  track('external_link_clicked', { link_type: linkType, ...context });
}

// ── 가이드 ───────────────────────────────────────────────────────────

/** 오디오 가이드 시작 */
export function trackGuideStarted(attractionId: string, attractionName: string) {
  track('guide_started', { attraction_id: attractionId, attraction_name: attractionName });
}

/** 오디오 가이드 완주 (A 블록 + B 블록 모두 종료) */
export function trackGuideCompleted(attractionId: string, attractionName: string) {
  track('guide_completed', { attraction_id: attractionId, attraction_name: attractionName });
}

/** GPS/수동 핀 트리거 */
export function trackPinTriggered(pinId: string, pinName: string, trigger: 'gps' | 'manual', attractionId?: string) {
  track('pin_triggered', { pin_id: pinId, pin_name: pinName, trigger, attraction_id: attractionId });
}

/** 자동재생 토글 */
export function trackAutoplayToggled(enabled: boolean) {
  track('autoplay_toggled', { enabled });
}
