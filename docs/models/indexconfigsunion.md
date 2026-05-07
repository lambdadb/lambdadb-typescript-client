# IndexConfigsUnion


## Supported Types

### `models.IndexConfigsText`

```typescript
const value: models.IndexConfigsText = {
  type: "text",
};
```

### `models.IndexConfigsVector`

```typescript
const value: models.IndexConfigsVector = {
  type: "vector",
  dimensions: 435697,
};
```

### `models.IndexConfigsManagedEmbeddingVector`

```typescript
const value: models.IndexConfigsManagedEmbeddingVector = {
  type: "vector",
  managedEmbedding: true,
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    sourceField: "body",
  },
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
  objectIndexConfigs: {
    "key": "<value>",
  },
};
```
