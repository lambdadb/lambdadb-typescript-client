import assert from 'node:assert/strict';
import test from 'node:test';
import { LambdaDBClient, HTTPClient, SDKValidationError } from '../dist/esm/index.js';
import { queryCollectionRequestBodyToJSON, queryCollectionResponseFromJSON } from '../dist/esm/models/operations/querycollection.js';

const facets = { tags: { buckets: [{ value: '한글', count: 2147483648 }] } };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
for (const download of [false, true]) {
  for (const safe of [false, true]) {
    test(`facets survive query, download=${download}, safe=${safe}`, async () => {
      let calls = 0;
      const collection = new LambdaDBClient({
        baseUrl: 'https://api.example', projectName: 'project', projectApiKey: 'key',
        httpClient: new HTTPClient({ fetcher: async request => {
          calls++;
          const body = JSON.parse(await request.text());
          assert.equal(body.size, download ? 1 : 0);
          assert.deepEqual(body.facets, { tags: { size: 3 } });
          assert.equal('query' in body, false);
          return json({ took: 1, total: download ? 1 : 0, docs: [], isDocsInline: !download,
            ...(download ? { docsUrl: 'https://files.example/docs' } : {}), facets });
        }}),
        transferClient: new HTTPClient({ fetcher: () => {
          calls++;
          return json([{ collection: 'items', doc: { id: '1' } }]);
        }}),
      }).collection('items');
      const input = { size: download ? 1 : 0, facets: { tags: { size: 3 } } };
      const result = safe ? await collection.querySafe(input) : await collection.query(input);
      if (safe) assert.equal(result.ok, true);
      const response = safe ? result.value : result;
      assert.deepEqual(response.facets, facets);
      assert.equal(response.docs.length, download ? 1 : 0);
      assert.equal(calls, download ? 2 : 1);
    });
  }
}
test('old query payloads omit facets and empty facet specs preserve server defaults', () => {
  assert.equal('facets' in JSON.parse(queryCollectionRequestBodyToJSON({ query: {} })), false);
  assert.deepEqual(JSON.parse(queryCollectionRequestBodyToJSON({ size: 0, facets: { tags: {} } })).facets, { tags: {} });
  const result = queryCollectionResponseFromJSON(JSON.stringify({ took: 0, total: 0, docs: [], isDocsInline: true }));
  assert.equal(result.ok, true);
  assert.equal(result.value.facets, undefined);
});

for (const safe of [false, true]) {
  test(`facet defaults and five-field boundary reach the server, safe=${safe}`, async () => {
    const bodies = [];
    const collection = new LambdaDBClient({
      baseUrl: 'https://api.example', projectName: 'project', projectApiKey: 'key',
      httpClient: new HTTPClient({ fetcher: async request => {
        bodies.push(await request.json());
        return json({ took: 0, total: 0, docs: [], isDocsInline: true, facets });
      }}),
    }).collection('items');
    for (const size of [undefined, null, 1, 100]) {
      const input = { size: 0, facets: { a: { size }, b: {}, c: {}, d: {}, e: {} } };
      const result = safe ? await collection.querySafe(input) : await collection.query(input);
      if (safe) assert.equal(result.ok, true);
      assert.deepEqual(bodies.at(-1).facets, JSON.parse(JSON.stringify(input.facets)));
      assert.deepEqual((safe ? result.value : result).facets, facets);
    }
    assert.equal(bodies.length, 4);
  });

  test(`invalid facet requests fail before network I/O, safe=${safe}`, async () => {
    let calls = 0;
    const collection = new LambdaDBClient({
      baseUrl: 'https://api.example', projectName: 'project', projectApiKey: 'key',
      httpClient: new HTTPClient({ fetcher: () => {
        calls++;
        return json({ took: 0, total: 0, docs: [], isDocsInline: true });
      }}),
    }).collection('items');
    const inputs = [
      { size: 0 },
      { size: 0, facets: {} },
      { facets: { a: {}, b: {}, c: {}, d: {}, e: {}, f: {} } },
      ...[0, 101, 1.5, '10'].map(size => ({ facets: { tags: { size } } })),
    ];
    for (const input of inputs) {
      if (safe) {
        const result = await collection.querySafe(input);
        assert.equal(result.ok, false);
        assert.ok(result.error instanceof SDKValidationError);
      } else {
        await assert.rejects(collection.query(input), SDKValidationError);
      }
    }
    assert.equal(calls, 0);
  });
}
