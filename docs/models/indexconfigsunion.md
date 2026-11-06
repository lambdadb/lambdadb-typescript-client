# IndexConfigsUnion

Every variant accepts an optional `description` ([`FieldDescription`](#fielddescription)).

## Supported Types

### `models.IndexConfigsText`

```typescript
const value: models.IndexConfigsText = {
  type: "text",
  description: "Book title as printed on the cover",
};
```

### `models.IndexConfigsVector`

```typescript
const value: models.IndexConfigsVector = {
  type: "vector",
  dimensions: 1536,
};
```

### `models.IndexConfigsNativeEmbeddingVector`

```typescript
const value: models.IndexConfigsNativeEmbeddingVector = {
  type: "vector",
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    sourceField: "body",
  },
};
```

The legacy `models.IndexConfigsManagedEmbeddingVector` with explicit
`managedEmbedding: true` remains supported. See [Native embeddings](../native-embeddings.md).

### `models.IndexConfigs`

```typescript
const value: models.IndexConfigs = {
  type: "datetime",
};
```

### `models.IndexConfigs`

```typescript
const value: models.IndexConfigs = {
  type: "datetime",
};
```

### `models.IndexConfigs`

```typescript
const value: models.IndexConfigs = {
  type: "datetime",
};
```

### `models.IndexConfigs`

```typescript
const value: models.IndexConfigs = {
  type: "datetime",
};
```

### `models.IndexConfigs`

```typescript
const value: models.IndexConfigs = {
  type: "datetime",
};
```

### `models.IndexConfigs`

```typescript
const value: models.IndexConfigs = {
  type: "datetime",
};
```

### `models.IndexConfigsObject`

```typescript
const value: models.IndexConfigsObject = {
  type: "object",
  description: "Publisher details",
  objectIndexConfigs: {
    pages: { type: "long", description: "Page count" },
  },
};
```

## FieldDescription

`description?: string | null` on every variant, including nested
`objectIndexConfigs` children. Up to 255 characters; longer values fail locally
with `SDKValidationError`. It never affects indexing. Collection reads return
it only when set. On create, omitting it, `null`, or `""` leaves the field
without a description. On update, omitting it or `null` keeps the stored
description, `""` clears it, and any other value replaces it; it is the only
setting of an existing field that an update may change. The server-managed `id`
field does not accept a description. The SDK sends the value as supplied and
omits the key when it is undefined.
