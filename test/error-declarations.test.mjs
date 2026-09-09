import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const packageName = "@functional-systems/lambdadb";
const gatewayErrors = [
  "PayloadTooLargeError",
  "BadGatewayError",
  "ServiceUnavailableError",
  "GatewayTimeoutError",
];

// Operation-level declarations must describe the classes returned by the
// response matchers, including their distinct meanings for HTTP 409.
const operations = [
  ["ListCollectionsError", "collectionsList", "LambdaDBClient", "listCollectionsSafe"],
  ["CreateCollectionError", "collectionsCreate", "LambdaDBClient", "createCollectionSafe", "ResourceAlreadyExistsError"],
  ["GetCollectionError", "collectionsGet", "CollectionHandle", "getSafe"],
  ["UpdateCollectionError", "collectionsUpdate", "CollectionHandle", "updateSafe", "CatalogConflictError"],
  ["DeleteCollectionError", "collectionsDelete", "CollectionHandle", "deleteSafe", "CatalogConflictError"],
  ["QueryCollectionError", "collectionsQuery", "CollectionHandle", "querySafe"],
  ["ListDocsError", "collectionsDocsListDocs", "CollectionDocs", "listSafe"],
  ["ListDocsError", "collectionsDocsListDocsExtended", "CollectionDocs", "listSafe"],
  ["UpsertDocsError", "collectionsDocsUpsert", "CollectionDocs", "upsertSafe"],
  ["UpdateDocsError", "collectionsDocsUpdate", "CollectionDocs", "updateSafe"],
  ["DeleteDocsError", "collectionsDocsDelete", "CollectionDocs", "deleteSafe"],
  ["FetchDocsError", "collectionsDocsFetch", "CollectionDocs", "fetchSafe"],
  ["GetBulkUpsertDocsError", "collectionsDocsGetBulkUpsert", "CollectionDocs", "getBulkUpsertSafe"],
  ["BulkUpsertDocsError", "collectionsDocsBulkUpsert", "CollectionDocs", "bulkUpsertSafe"],
];

for (const [dialect, extension] of [["esm", "mts"], ["commonjs", "cts"]]) {
  test(`${dialect} package declarations expose concrete operation error unions`, () => {
    const probePath = fileURLToPath(new URL(`../error-declaration-probe.${extension}`, import.meta.url));
    const checks = new Map();
    const source = [
      `import type * as SDK from "${packageName}";`,
      "type ErrorOf<T> = T extends { ok: false; error: infer E } ? E : never;",
    ];

    operations.forEach(([errorType, func, handle, method, conflict], index) => {
      source.push(`import type { ${func} } from "${packageName}/funcs/${func}.js";`);
      const probes = {
        [`Public${index}`]: `SDK.${errorType}`,
        [`Standalone${index}`]: `ErrorOf<Awaited<ReturnType<typeof ${func}>>>`,
        [`Safe${index}`]: `ErrorOf<Awaited<ReturnType<SDK.${handle}["${method}"]>>>`,
      };
      for (const [name, expression] of Object.entries(probes)) {
        source.push(`type ${name} = ${expression};`);
        checks.set(name, { label: `${errorType} / ${func} / ${name}`, conflict });
      }
    });

    const options = {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2020,
      strict: true,
      exactOptionalPropertyTypes: true,
      skipLibCheck: true,
      noEmit: true,
    };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (path, languageVersion, ...rest) => path === probePath
      ? ts.createSourceFile(path, source.join("\n"), languageVersion, true)
      : getSourceFile(path, languageVersion, ...rest);
    const program = ts.createProgram([probePath], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: () => host.getCurrentDirectory(),
      getNewLine: () => "\n",
    }));
    assert.ok(program.getSourceFiles().some((file) =>
      file.fileName.endsWith(`/dist/${dialect}/index.d.ts`)
    ), `package exports must resolve to ${dialect} declarations`);

    const checker = program.getTypeChecker();
    let checked = 0;
    for (const statement of program.getSourceFile(probePath).statements) {
      if (!ts.isTypeAliasDeclaration(statement)) continue;
      const check = checks.get(statement.name.text);
      if (!check) continue;

      // Extract<T, ErrorClass> and assignability checks can pass accidentally:
      // the error classes are structurally compatible. Inspect class symbols
      // in the resolved union to prove the concrete alternatives are declared.
      const type = checker.getTypeFromTypeNode(statement.type);
      assert.ok(type.isUnion(), check.label);
      const names = new Set(type.types.map((member) => member.getSymbol()?.getName()));
      for (const name of [...gatewayErrors, "LambdaDBError"]) {
        assert.ok(names.has(name), `${check.label} must declare ${name}`);
      }
      for (const name of ["CatalogConflictError", "ResourceAlreadyExistsError"]) {
        assert.equal(names.has(name), check.conflict === name,
          `${check.label}: unexpected or missing HTTP 409 alternative ${name}`);
      }
      checked += 1;
    }
    assert.equal(checked, operations.length * 3);
  });
}
