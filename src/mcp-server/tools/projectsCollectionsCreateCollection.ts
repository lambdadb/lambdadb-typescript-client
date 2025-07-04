/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */

import { projectsCollectionsCreateCollection } from "../../funcs/projectsCollectionsCreateCollection.js";
import * as operations from "../../models/operations/index.js";
import { formatResult, ToolDefinition } from "../tools.js";

const args = {
  request: operations.CreateCollectionRequest$inboundSchema,
};

export const tool$projectsCollectionsCreateCollection: ToolDefinition<
  typeof args
> = {
  name: "projects-collections-create-collection",
  description: `Create an collection.`,
  args,
  tool: async (client, args, ctx) => {
    const [result, apiCall] = await projectsCollectionsCreateCollection(
      client,
      args.request,
      { fetchOptions: { signal: ctx.signal } },
    ).$inspect();

    if (!result.ok) {
      return {
        content: [{ type: "text", text: result.error.message }],
        isError: true,
      };
    }

    const value = result.value;

    return formatResult(value, apiCall);
  },
};
