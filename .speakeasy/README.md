# .speakeasy — reference only

This directory contains **legacy Speakeasy configuration and generated OpenAPI artifacts**. They are kept for reference only.

- **We no longer run Speakeasy in CI.** The SDK is maintained manually. See [docs/OPENAPI_UPDATE.md](../docs/OPENAPI_UPDATE.md).
- **Do not** re-enable the old `sdk_generation.yaml` workflow; it would overwrite hand-maintained code and the collection-scoped client.

If you need to update the SDK from a new OpenAPI spec, follow the instructions in `docs/OPENAPI_UPDATE.md`.
