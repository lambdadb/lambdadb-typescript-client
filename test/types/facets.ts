import type {
  CollectionHandle,
  FacetBucket,
  FacetRequest,
  FacetResult,
  QueryCollectionInput,
} from "../../src/index.js";

export async function queryFacets(collection: CollectionHandle): Promise<FacetBucket[]> {
  const spec: FacetRequest = {};
  const input: QueryCollectionInput = { size: 0, facets: { tags: spec } };
  const response = await collection.query(input);
  const facet: FacetResult | undefined = response.facets?.["tags"];
  return facet?.buckets ?? [];
}
