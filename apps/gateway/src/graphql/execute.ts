import {
  graphql,
  parse,
  specifiedRules,
  validate,
  buildSchema,
  type GraphQLSchema,
} from "graphql";
import { GRAPHQL_MAX_BODY, GRAPHQL_SDL } from "./schema.js";
import { depthError, documentDepth } from "./depth.js";
import { graphqlRoot, type GraphqlCtx } from "./resolvers.js";

let schema: GraphQLSchema | null = null;

export function graphqlSchema(): GraphQLSchema {
  if (!schema) schema = buildSchema(GRAPHQL_SDL);
  return schema;
}

export function parseGraphqlBody(raw: unknown): {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
} | { error: string } {
  if (raw == null || typeof raw !== "object") return { error: "body must be JSON" };
  const o = raw as Record<string, unknown>;
  const query = typeof o.query === "string" ? o.query : "";
  if (!query.trim()) return { error: "query required" };
  if (query.length > GRAPHQL_MAX_BODY) return { error: "query too large" };
  const variables =
    o.variables && typeof o.variables === "object" && !Array.isArray(o.variables)
      ? (o.variables as Record<string, unknown>)
      : undefined;
  const operationName = typeof o.operationName === "string" ? o.operationName : undefined;
  return { query, variables, operationName };
}

export async function runGraphql(
  query: string,
  variables: Record<string, unknown> | undefined,
  operationName: string | undefined,
  ctx: GraphqlCtx
) {
  let doc;
  try {
    doc = parse(query);
  } catch (e) {
    return { errors: [{ message: String(e).slice(0, 240) }] };
  }
  const deep = depthError(documentDepth(doc));
  if (deep) return { errors: [{ message: deep }] };
  const schemaNow = graphqlSchema();
  const val = validate(schemaNow, doc, specifiedRules);
  if (val.length) {
    return { errors: val.map((e) => ({ message: e.message })) };
  }
  return graphql({
    schema: schemaNow,
    source: query,
    rootValue: undefined,
    contextValue: ctx,
    variableValues: variables,
    operationName,
    fieldResolver(source, args, context, info) {
      const type = info.parentType.name;
      const bag = graphqlRoot as Record<string, Record<string, unknown>>;
      const resolver = bag[type]?.[info.fieldName];
      if (typeof resolver === "function") {
        return (resolver as (...a: unknown[]) => unknown)(source, args, context, info);
      }
      if (source && typeof source === "object") {
        return (source as Record<string, unknown>)[info.fieldName];
      }
      return undefined;
    },
  });
}
