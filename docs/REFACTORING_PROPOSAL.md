# LambdaDB TypeScript SDK Refactoring Proposal

이 문서는 LambdaDB TypeScript SDK의 개발자 경험(DX) 개선과 Speakeasy 의존 제거 방향을 정리한 제안서입니다.

---

## 1. 현재 구조의 문제점

### 1.1 API 형태

- **깊은 중첩**: `lambdaDB.collections.docs.listDocs()` — 리소스 계층이 길고, “문서 목록”이 `collections` 아래에 있어 직관적이지 않음.
- **매 호출마다 `collectionName`**: 문서/컬렉션 작업마다 `{ collectionName: "my-collection", ... }` 를 반복 전달해야 함.
- **네이밍 불일치**: `collections.list()` vs `collections.docs.listDocs()` — 동일한 “목록” 작업인데 `list` / `listDocs` 혼용.
- **REST 리소스와 불일치**: 사용자 멘탈 모델은 “특정 컬렉션에 대한 작업”인데, API는 전역 `collections.docs.*` + 매번 컬렉션 이름 전달.

### 1.2 Speakeasy 생성 코드의 한계

- `DO NOT EDIT` 로 인해 우리가 원하는 API 형태로 수정할 수 없음.
- OpenAPI 경로 구조(`/collections`, `/collections/{collectionName}/docs`)가 그대로 노출되어, 리소스 중심 DX를 만들기 어려움.
- 재생성 시 수동 개선 사항이 모두 덮어써짐.

---

## 2. SDK Best Practice 요약

(참고: [Speakeasy SDK Best Practices](https://www.speakeasy.com/post/sdk-best-practices), [Naming Conventions](https://sdks.io/docs/best-practices/design/naming-conventions), [TypeScript API Design](https://azure.github.io/azure-sdk/typescript_design.html))

| 원칙 | 적용 방향 |
|------|-----------|
| **리소스 스코프** | “컬렉션”을 한 번 지정한 뒤, 해당 컬렉션에 대한 작업만 호출 (`client.collection("name").docs.list()`) |
| **동사+객체 네이밍** | `list`, `get`, `create`, `delete`, `update`, `upsert`, `fetch`, `query` 등 일관된 패턴 |
| **타입 안전성** | 기존 Zod/타입 유지하되, 공개 API에서는 단순한 request/response 타입 노출 |
| **모듈화** | 컬렉션·문서·쿼리 등 역할별로 메서드 그룹화, tree-shaking 유지 |

---

## 3. 권장 API 형태 (리팩터링 목표)

### 3.1 컬렉션 스코프 API

컬렉션 이름을 한 번 지정한 “핸들”을 두고, 이후 호출에서는 `collectionName`을 넘기지 않음.

```typescript
const lambdaDB = new LambdaDB({ projectApiKey: "..." });

// 프로젝트 전체 컬렉션 목록
const listResult = await lambdaDB.collections.list();

// 특정 컬렉션 핸들
const collection = lambdaDB.collection("my-collection");

// 컬렉션 메타/설정
await collection.get();
await collection.update({ indexConfigs: { ... } });
await collection.delete();

// 검색
await collection.query({ query: { queryString: { query: "..." } }, size: 10 });

// 문서 작업 — collectionName 불필요
await collection.docs.list({ size: 20, pageToken });
await collection.docs.upsert({ docs: [...] });
await collection.docs.update({ docs: [{ id: "...", ... }] });
await collection.docs.delete({ ids: ["id1", "id2"] });
await collection.docs.fetch({ ids: ["id1", "id2"] });
const bulkInfo = await collection.docs.getBulkUpsert();
await collection.docs.bulkUpsert({ objectKey: bulkInfo.objectKey });
```

### 3.2 네이밍 정리

| 현재 | 권장 (문서 작업) |
|------|------------------|
| `collections.docs.listDocs(req)` | `collection.docs.list(options?)` |
| `collections.docs.upsert(req)` | `collection.docs.upsert({ docs })` |
| `collections.docs.update(req)` | `collection.docs.update({ docs })` |
| `collections.docs.delete(req)` | `collection.docs.delete({ ids? \| filter? })` |
| `collections.docs.fetch(req)` | `collection.docs.fetch({ ids, ... })` |
| `collections.docs.getBulkUpsert(req)` | `collection.docs.getBulkUpsert()` |
| `collections.docs.bulkUpsert(req)` | `collection.docs.bulkUpsert({ objectKey })` |

컬렉션 작업은 이미 `list`/`get`/`create`/`update`/`delete`/`query` 로 정리 가능.

---

## 4. Speakeasy 제거 전략

### 4.1 유지하는 것

- **`src/funcs/`**: 기존 `collectionsList`, `collectionsDocsListDocs` 등 — 실제 HTTP/라우팅/에러 매핑 담당. 이 레이어를 “내부 구현”으로만 사용.
- **`src/lib/`**: `sdks.ts`, `http.ts`, `config.ts`, `retries.ts`, `security.ts` 등 — HTTP 클라이언트, 재시도, 인증.
- **`src/core.ts`**: `LambdaDBCore` (또는 동일 역할의 클라이언트).
- **`src/models/`**: operations, errors, 스키마 — func에서 그대로 참조.
- **`src/hooks/`**: 필요 시 유지.

즉, **재생성으로 덮어쓰지 않을 부분**만 우리가 “퍼사드”로 감싸고, 나머지는 그대로 둠.

### 4.2 우리가 새로 작성·대체하는 것

- **`src/sdk/`**  
  - Speakeasy 생성 `sdk.ts` / `collections.ts` / `docs.ts` 를 **더 이상 재생성하지 않고**, 우리가 직접 작성하는 퍼사드로 교체.
  - 새 진입점: `LambdaDB` 클래스와 `collection(name)` 핸들, `Collections`/`Collection`/`CollectionDocs` 등.
- **퍼사드 구현 방식**  
  - 퍼사드 메서드는 내부에서 기존 `collectionsDocsListDocs(client, { collectionName, ... }, options)` 형태로만 호출.
  - 즉, **HTTP/모델 레이어는 전부 기존 코드 재사용**, “진입 API”만 바꿈.

### 4.3 Speakeasy 제거 후 가능한 개선

| 항목 | 설명 | 반영 상태 |
|------|------|-----------|
| **컬렉션 스코프 API** | `collection("name")` 핸들 도입으로 `collectionName` 반복 제거. | ✅ 반영 (`client.ts`) |
| **일관된 메서드 이름** | `listDocs` → `list`, `get`/`list`/`create`/`delete`/`update`/`upsert`/`fetch`/`query` 통일. | ✅ 반영 (퍼사드) |
| **타입 단순화** | 공개 API용 타입을 `src/types/public.ts` 등에서 재export하거나, request body만 노출하는 얇은 타입 정의. | ❌ 미반영 |
| **에러/Result 처리** | 필요 시 `unwrapAsync` 대신 `Result` 반환 옵션 또는 커스텀 에러 타입 노출. | ❌ 미반영 |
| **문서화** | JSDoc과 예제를 우리 API 기준으로 작성 (README, 예제 코드). | ✅ 반영 (README, examples, JSDoc) |
| **추가 기능** | 페이지네이션 헬퍼, 쿼리 빌더, 재시도/타임아웃 기본값 등 점진적 추가. | ❌ 미반영 |

---

## 5. 마이그레이션 경로

1. **Phase 1 (비파괴)**  
   - `src/sdk/` 아래에 새 퍼사드 클래스(`LambdaDB`, `Collection`, `CollectionDocs`)를 추가하고, 기존 `LambdaDB`/`collections`/`docs`는 **deprecated** 또는 별도 export로 유지.  
   - 예: `import { LambdaDB } from "@functional-systems/lambdadb"` 는 새 API, `import { LambdaDBLegacy } from "@functional-systems/lambdadb/legacy"` 는 기존 API.

2. **Phase 2 (완료)**  
   - 문서/예제를 새 API로 전환. README·USAGE·examples 를 `LambdaDBClient` 기준으로 수정하고, 기존 `LambdaDB` 는 "Legacy API" 로 문서화하여 두 진입점 병행 유지.

3. **Phase 3 (완료)**  
   - Speakeasy 재생성 스크립트 제거. CI에서 Speakeasy 실행 중단, npm 배포는 태그/수동 트리거 워크플로로 전환. OpenAPI 스펙 변경 시 수동 반영 가이드 추가.

---

## 6. 정리

- **전체 리팩터링이 필요한가?**  
  - “전체를 한 번에 갈아엎는” 것보다는 **퍼사드 도입**으로 충분합니다. 기존 func/model 재사용으로 위험과 작업량을 줄일 수 있습니다.

- **Speakeasy를 완전히 제거해도 되는가?**  
  - **생성 파이프라인만 제거**하고, 이미 생성된 **코드( funcs, models, lib )는 그대로 두고 재사용**하는 방향을 권장합니다.  
  - 새로 작성하는 것은 “진입 API” (`sdk/`) 뿐이므로, 앞으로 Speakeasy에 의해 덮어써질 부분은 없습니다.

- **추가로 개선할 수 있는 것**  
  - 위 표와 3장의 API 형태대로 컬렉션 스코프 + 네이밍 통일, 타입/에러/문서 정리, 필요 시 페이지네이션/쿼리 헬퍼 등을 단계적으로 도입할 수 있습니다.

이 제안서를 기준으로 Phase 1 퍼사드 설계와 파일 구조를 구체화하면 됩니다.

---

## 7. 구현 상태 (Phase 1 예시)

`src/client.ts` 에 **컬렉션 스코프 퍼사드**가 구현되어 있습니다. 기존 func/model을 그대로 사용하며, Speakeasy 생성 코드를 수정하지 않습니다.

### 사용 방법

```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ projectApiKey: "YOUR_API_KEY" });

// 프로젝트 전체
const list = await client.listCollections();
await client.createCollection({ collectionName: "my-collection", indexConfigs: { ... } });

// 컬렉션 스코프 — collectionName 한 번만 지정
const collection = client.collection("my-collection");
await collection.get();
await collection.update({ indexConfigs: { ... } });
await collection.query({ query: { queryString: { query: "..." } }, size: 10 });

// 문서 작업
await collection.docs.list({ size: 20 });
await collection.docs.upsert({ docs: [{ id: "1", text: "hello" }] });
await collection.docs.fetch({ ids: ["1", "2"] });
await collection.docs.delete({ ids: ["1"] });
```

기존 `LambdaDB` (`lambdaDB.collections.docs.listDocs({ collectionName, ... })`) 도 그대로 사용 가능하며, 새 코드에서는 `LambdaDBClient` + `collection(name)` 사용을 권장합니다.

---

## 8. Phase 2 완료 내역

- **README.md**: 진입 예제·인증·재시도·에러·서버·HTTP 클라이언트·디버깅 코드 샘플을 모두 `LambdaDBClient` 기준으로 변경. "Legacy API" 섹션에서 `LambdaDB` 유지 및 권장 사항 명시.
- **USAGE.md**: SDK 예제를 `LambdaDBClient` + `client.collection(name)` 으로 변경.
- **examples/**: `collectionsList.example.ts` 를 `LambdaDBClient`·`listCollections()` 로 수정, `collectionScoped.example.ts` 추가. `examples/README.md` 에 새 예제 설명 및 권장 API 안내 반영.
- 기존 진입점(`LambdaDB`)은 제거하지 않고 병행 유지하여 하위 호환 보장.

---

## 9. Phase 3 완료 내역

- **CI 워크플로**
  - `.github/workflows/sdk_generation.yaml` 삭제 — Speakeasy 기반 SDK 생성 더 이상 실행하지 않음.
  - `.github/workflows/sdk_publish.yaml` 삭제 후 `.github/workflows/publish.yaml` 추가 — `v*` 태그 푸시 또는 `workflow_dispatch` 시 `npm ci` / `npm run build` / `npm publish --access public` 실행. `NPM_TOKEN` 시크릿 사용.
- **문서**
  - `docs/OPENAPI_UPDATE.md` 추가 — OpenAPI 스펙 URL, 수동 반영 방법, Option B(선택적 로컬 Speakeasy 실행 참고용) 안내.
  - `.speakeasy/README.md` 추가 — 해당 디렉터리는 참고용이며, CI에서 Speakeasy를 다시 사용하지 않는다고 명시.
- **README**
  - Speakeasy 배지 제거. 라이선스 배지를 Apache-2.0으로 통일.
  - Contributions 문단 수정 — “자동 생성” 표현 제거, `src/client.ts` 및 수동 유지보수·`docs/OPENAPI_UPDATE.md` 안내로 수정.
- `src/funcs/`, `src/models/`, `src/lib/` 등 기존 코드는 그대로 두고, 앞으로는 OpenAPI 변경 시 위 문서에 따라 수동으로만 반영.
