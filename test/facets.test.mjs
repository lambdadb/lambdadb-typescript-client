import assert from 'node:assert/strict';
import test from 'node:test';
import { LambdaDBClient, HTTPClient } from '../dist/esm/index.js';
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
