# GetBulkUpsertDocsResponse

Required information for a presigned document upload.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | `string` | Yes | Presigned upload URL. |
| `type` | `"application/json"` | Yes | Value to use for `Content-Type`. |
| `httpMethod` | `"PUT"` | Yes | Upload method. |
| `objectKey` | `string` | Yes | Object key for the completion call. |
| `sizeLimitBytes` | `number` | Yes | Maximum object size. |
| `headers` | `Record<string, string>` | Yes | Signed headers to forward unchanged to the presigned PUT. |

Do not forward LambdaDB API authentication or API-only custom headers to the
presigned URL.
