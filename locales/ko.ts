// ── 언어 추가 방법 ─────────────────────────────────────────────────────────
// 1. 이 파일을 복사해서 locales/[lang].ts 로 저장
// 2. 아래 모든 값을 해당 언어로 번역
// 3. lib/i18n.ts 의 messages 객체에 import 후 추가
// ──────────────────────────────────────────────────────────────────────────

const ko = {
  // ── 내비게이션 ───────────────────────────────────────────────────────────
  'home.title':    '한국 오디오 가이드',
  'home.subtitle': '내 속도로 걷는 여행. 가이드가 따라와요.',
  'back':          '← 뒤로',
  'tapAgain':      '한 번 더 탭하면 가이드 시작',

  // ── 메인 탭 (홈, 지역 페이지 공통) ─────────────────────────────────────
  'tab.attractions': '명소',
  'tab.events':      '행사',
  'tab.restaurants': '식당',
  'tab.all':         '전체',

  // ── 행사 상태 배지 ───────────────────────────────────────────────────────
  'event.badge.active':   '진행중',
  'event.badge.soon':     '곧 시작',
  'event.badge.ending':   '마감임박',
  'event.badge.upcoming': '예정',

  // ── 행사 상세 필드 레이블 ────────────────────────────────────────────────
  'event.field.period':  '기간',
  'event.field.venue':   '행사장소',
  'event.field.address': '주소',
  'event.field.hours':   '운영시간',
  'event.field.fee':     '요금',
  'event.field.tel':     '전화',
  'event.field.website': '홈페이지',

  // ── 행사 섹션 / 필터 / 상태 메시지 ─────────────────────────────────────
  'event.sectionTitle':        '이 지역 행사',
  'event.filter.thisweek':     '이번주',
  'event.filter.all':          '전체 기간',    // 빈 메시지 등 문장 안에서 사용
  'event.filter.allOption':    '전체',          // 드롭다운 옵션 텍스트
  'event.filter.month':        '{n}월',         // {n} = 숫자
  'event.filter.monthLabel':   '{n}월',         // filterLabel 용 (영어에서만 다름)
  'event.empty':               '{filter}에 열리는 행사가 없어요.',  // {filter} = filterLabel
  'event.unsupported':         '이 지역은 아직 행사 정보를 지원하지 않아요.',
  'event.loading':             '불러오는 중...',
  'event.home.loading':        '행사 불러오는 중…',
  'event.home.empty':          '예정된 행사가 없어요',

  // ── 식당 / NearbyPanel ──────────────────────────────────────────────────
  'restaurant.myLocation':       '현재위치',
  'restaurant.selectedPin':      '선택한 핀',
  'restaurant.search':           '검색',
  'restaurant.searching':        '검색 중...',
  'restaurant.empty':            '근처에 등록된 식당이 없어요.',
  'restaurant.loading':          '로딩 중...',
  'restaurant.loadFailed':       '식당 정보를 불러오지 못했어요.',
  'restaurant.error.location':   '위치 권한을 허용해주세요.',
  'restaurant.error.noPin':      '핀을 먼저 선택해주세요.',
  'restaurant.back':             '목록',
  'restaurant.header':           '근처 식당',
  'restaurant.tab':              '식당',
  'restaurant.googleMaps':       '구글맵에서 보기',
  'restaurant.field.signature':  '대표메뉴',
  'restaurant.field.menu':       '메뉴',
  'restaurant.field.hours':      '영업시간',
  'restaurant.field.closed':     '휴무일',
  'restaurant.field.address':    '주소',

  // ── 갤러리 ──────────────────────────────────────────────────────────────
  'gallery.noPhotos': '사진이 없어요',
  'gallery.more':     '더보기',

  // ── 지도 ────────────────────────────────────────────────────────────────
  'map.loadError': '지도 로드 실패: ',  // 뒤에 에러 메시지가 붙음
} as const;

export default ko;
