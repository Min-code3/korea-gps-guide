// ── 언어 추가 방법 ─────────────────────────────────────────────────────────
// 1. 이 파일을 복사해서 locales/[lang].ts 로 저장
// 2. 아래 모든 값을 해당 언어로 번역
// 3. lib/i18n.ts 의 messages 객체에 import 후 추가
// ──────────────────────────────────────────────────────────────────────────

const en = {
  // ── Navigation ───────────────────────────────────────────────────────────
  'home.title':    'Korea Audio Guide',
  'home.subtitle': 'Walk at your own pace. The guide follows you.',
  'back':          '← Back',
  'tapAgain':      'Tap again to start guide',

  // ── Main tabs ────────────────────────────────────────────────────────────
  'tab.attractions': 'Attractions',
  'tab.events':      'Events',
  'tab.restaurants': 'Restaurants',
  'tab.all':         'All',

  // ── Event status badges ──────────────────────────────────────────────────
  'event.badge.active':   'Ongoing',
  'event.badge.soon':     'Starting Soon',
  'event.badge.ending':   'Ending Soon',
  'event.badge.upcoming': 'Upcoming',

  // ── Event detail field labels ─────────────────────────────────────────────
  'event.field.period':  'Period',
  'event.field.venue':   'Venue',
  'event.field.address': 'Address',
  'event.field.hours':   'Hours',
  'event.field.fee':     'Fee',
  'event.field.tel':     'Tel',
  'event.field.website': 'Website',

  // ── Event section / filter / state messages ───────────────────────────────
  'event.sectionTitle':        'Local Events',
  'event.filter.thisweek':     'This Week',
  'event.filter.all':          'any period',    // used inside sentence
  'event.filter.allOption':    'All',            // dropdown option text
  'event.filter.month':        'Month {n}',      // {n} = number
  'event.filter.monthLabel':   'month {n}',      // used inside sentence (lowercase)
  'event.empty':               'No events for {filter}.',
  'event.unsupported':         'Event info not yet available for this area.',
  'event.loading':             'Loading...',
  'event.home.loading':        'Loading events…',
  'event.home.empty':          'No upcoming events',

  // ── Restaurant / NearbyPanel ──────────────────────────────────────────────
  'restaurant.myLocation':       'My Location',
  'restaurant.selectedPin':      'Selected Pin',
  'restaurant.search':           'Search',
  'restaurant.searching':        'Searching...',
  'restaurant.empty':            'No restaurants found.',
  'restaurant.loading':          'Loading...',
  'restaurant.loadFailed':       'Failed to load.',
  'restaurant.error.location':   'Location permission denied.',
  'restaurant.error.noPin':      'Select a pin first.',
  'restaurant.back':             'List',
  'restaurant.header':           'Nearby Restaurants',
  'restaurant.tab':              'Restaurants',
  'restaurant.googleMaps':       'View on Google Maps',
  'restaurant.field.signature':  'Signature',
  'restaurant.field.menu':       'Menu',
  'restaurant.field.hours':      'Hours',
  'restaurant.field.closed':     'Closed',
  'restaurant.field.address':    'Address',

  // ── Gallery ───────────────────────────────────────────────────────────────
  'gallery.noPhotos': 'No photos',
  'gallery.more':     'more',

  // ── Map ───────────────────────────────────────────────────────────────────
  'map.loadError': 'Map load failed: ',
} as const;

export default en;
