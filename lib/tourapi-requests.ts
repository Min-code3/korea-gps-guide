import { AsyncLocalStorage } from 'node:async_hooks';

const MAX_CONCURRENT_REQUESTS = 5;
let activeRequests = 0;
const waiting: Array<() => void> = [];

// 같은 서버 인스턴스의 지역·식당·커버 요청이 하나의 제한을 공유한다.
export async function limitTourAPIRequest<T>(request: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => {
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      activeRequests++;
      resolve();
    } else {
      waiting.push(resolve);
    }
  });

  try {
    return await request();
  } finally {
    const next = waiting.shift();
    if (next) next(); // 사용 중인 슬롯을 다음 요청으로 넘긴다.
    else activeRequests--;
  }
}

const loadStatus = new AsyncLocalStorage<{ failed: boolean }>();

export function recordTourAPIFailure() {
  const status = loadStatus.getStore();
  if (status) status.failed = true;
}

// fallback을 반환해도 해당 로드의 실패 여부를 캐시 계층까지 전달한다.
// 병렬로 로드하는 다른 캐시 키의 상태에는 영향을 주지 않는다.
export async function withTourAPIStatus<T>(load: () => Promise<T>) {
  const status = { failed: false };
  const value = await loadStatus.run(status, load);
  return { value, failed: status.failed };
}
