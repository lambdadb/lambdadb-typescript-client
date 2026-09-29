import type {
  CollectionHandle,
  FacetBucket,
  FacetRequest,
  FacetResult,
  QueryCollectionInput,
} from "../../src/index.js";

export async function queryFacets(collection: CollectionHandle): Promise<FacetBucket[]> {
  const spec: FacetRequest = { size: null };
  const input: QueryCollectionInput = { size: 0, facets: { tags: spec } };
  const response = await collection.query(input);
  const safe = await collection.querySafe(input);
  if (safe.ok) {
    const safeFacet: FacetResult | undefined = safe.value.facets?.["tags"];
    return safeFacet?.buckets ?? [];
  }
  const facet: FacetResult | undefined = response.facets?.["tags"];
  return facet?.buckets ?? [];
}
