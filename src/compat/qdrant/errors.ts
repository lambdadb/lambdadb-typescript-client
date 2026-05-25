export class QdrantCompatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QdrantCompatError";
  }
}

export class UnsupportedQdrantFeatureError extends QdrantCompatError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UnsupportedQdrantFeatureError";
  }
}

export class QdrantCompatValidationError extends QdrantCompatError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QdrantCompatValidationError";
  }
}
