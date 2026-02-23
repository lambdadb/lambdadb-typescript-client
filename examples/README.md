# @functional-systems/lambdadb Examples

Example scripts for the LambdaDB SDK. We use the **collection-scoped client** (`LambdaDBClient`).

## Prerequisites

- Node.js (v18 or higher)
- npm

## Setup

1. Copy `.env.template` to `.env`:
   ```bash
   cp .env.template .env
   ```

2. Edit `.env` and set `LAMBDADB_PROJECT_API_KEY` (or pass the key in code for testing).

## Running the Examples

From the **repository root** (so the local SDK is used):

```bash
npm run build && cd examples && npx tsx collectionsList.example.ts
```

Or from the `examples` directory:

```bash
npm run build && npx tsx collectionsList.example.ts
```

## Examples

| File | Description |
|------|-------------|
| `collectionsList.example.ts` | List all collections in the project (`client.listCollections()`) |
| `collectionScoped.example.ts` | Use a collection handle to get metadata and list docs (`client.collection(name)`) |

## Creating new examples

Duplicate an existing example file and replace the logic. Use `LambdaDBClient` and `client.collection(name)` for the recommended API.


