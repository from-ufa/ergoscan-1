/**
 * eUTXO box graph for GET /v1/graph/tx/:id
 */
import { estimateFee, type RawTx } from "./balls.js";

export type GraphNodeKind = "tx" | "box-spent" | "box-created" | "box-data";
export type GraphEdgeKind = "spend" | "create" | "data";

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  x: number;
  y: number;
  value?: number;
  assets?: unknown[];
  ergoTree?: string;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: GraphEdgeKind;
};

export type BoxGraph = {
  txId: string;
  fee: number;
  size: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  spent: number;
  created: number;
  dataReads: number;
};

function short(id: string, n = 8): string {
  return id.slice(0, n);
}

function stackY(i: number, n: number): number {
  if (n <= 1) return 0.5;
  return (i + 1) / (n + 1);
}

export function buildBoxGraph(tx: RawTx): BoxGraph {
  const txId = tx.id;
  const txNodeId = `tx:${txId}`;
  const inputs = tx.inputs ?? [];
  const outputs = tx.outputs ?? [];
  const dataInputs = tx.dataInputs ?? [];

  const nodes: GraphNode[] = [
    {
      id: txNodeId,
      kind: "tx",
      label: short(txId, 10),
      x: 0.5,
      y: 0.5,
    },
  ];
  const edges: GraphEdge[] = [];

  inputs.forEach((box, i) => {
    const id = String(box.boxId ?? `in-${i}`);
    nodes.push({
      id,
      kind: "box-spent",
      label: short(id),
      x: 0.12,
      y: stackY(i, inputs.length),
      value: Number(box.value ?? 0) || 0,
      assets: box.assets ?? [],
      ergoTree: box.ergoTree,
    });
    edges.push({
      id: `e-spend-${i}`,
      from: id,
      to: txNodeId,
      kind: "spend",
    });
  });

  outputs.forEach((box, i) => {
    const id = String(box.boxId ?? `out-${i}`);
    nodes.push({
      id,
      kind: "box-created",
      label: short(id),
      x: 0.88,
      y: stackY(i, outputs.length),
      value: Number(box.value ?? 0) || 0,
      assets: box.assets ?? [],
      ergoTree: box.ergoTree,
    });
    edges.push({
      id: `e-create-${i}`,
      from: txNodeId,
      to: id,
      kind: "create",
    });
  });

  dataInputs.forEach((box, i) => {
    const id = String(box.boxId ?? `data-${i}`);
    nodes.push({
      id,
      kind: "box-data",
      label: short(id),
      x: 0.12,
      y: 0.08 + stackY(i, Math.max(1, dataInputs.length)) * 0.2,
      value: Number(box.value ?? 0) || 0,
      assets: box.assets ?? [],
      ergoTree: box.ergoTree,
    });
    edges.push({
      id: `e-data-${i}`,
      from: id,
      to: txNodeId,
      kind: "data",
    });
  });

  return {
    txId,
    fee: estimateFee(tx),
    size: Number(tx.size ?? 0) || 0,
    nodes,
    edges,
    spent: inputs.length,
    created: outputs.length,
    dataReads: dataInputs.length,
  };
}
