import {
  Kind,
  type DefinitionNode,
  type DocumentNode,
  type SelectionNode,
  type SelectionSetNode,
} from "graphql";
import { GRAPHQL_MAX_DEPTH } from "./schema.js";

function walkSet(
  set: SelectionSetNode | undefined,
  fragments: Map<string, SelectionSetNode>,
  depth: number,
  seen: Set<string>
): number {
  if (!set) return depth;
  let max = depth;
  for (const sel of set.selections as SelectionNode[]) {
    if (sel.kind === Kind.FIELD) {
      max = Math.max(max, walkSet(sel.selectionSet, fragments, depth + 1, seen));
    } else if (sel.kind === Kind.INLINE_FRAGMENT) {
      max = Math.max(max, walkSet(sel.selectionSet, fragments, depth, seen));
    } else if (sel.kind === Kind.FRAGMENT_SPREAD) {
      const name = sel.name.value;
      if (seen.has(name)) continue;
      seen.add(name);
      max = Math.max(max, walkSet(fragments.get(name), fragments, depth, seen));
    }
  }
  return max;
}

export function documentDepth(doc: DocumentNode): number {
  const fragments = new Map<string, SelectionSetNode>();
  const ops: DefinitionNode[] = [];
  for (const def of doc.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(def.name.value, def.selectionSet);
    } else if (def.kind === Kind.OPERATION_DEFINITION) {
      ops.push(def);
    }
  }
  let max = 0;
  for (const op of ops) {
    if (op.kind === Kind.OPERATION_DEFINITION) {
      max = Math.max(max, walkSet(op.selectionSet, fragments, 0, new Set()));
    }
  }
  return max;
}

export function depthError(depth: number): string | null {
  if (depth > GRAPHQL_MAX_DEPTH) {
    return `query too deep (${depth} > ${GRAPHQL_MAX_DEPTH})`;
  }
  return null;
}
