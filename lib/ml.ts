import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabase } from "./supabase";

export interface RainfallPrediction { rawForecast: number; correctedForecast: number | null; modelName: string | null; modelVersion: string | null; improvementKnown: boolean; }
export interface ActiveModel { model_name: string; model_version: string; artifact: PortableModel; metrics: Record<string, unknown>; training_rows: number; }
type Node = { feature: number; threshold: number; left: number; right: number; value?: number };
type PortableModel = { format: "rainwatch-model/v1"; feature_names: string[]; imputer: number[]; kind: "linear" | "tree-ensemble"; intercept?: number; coefficients?: number[]; baseline?: number; learning_rate?: number; trees?: Node[][] };

const getActiveModel = unstable_cache(async (): Promise<ActiveModel | null> => {
  const db = getSupabase(); if (!db) return null;
  const { data, error } = await db.from("ml_models").select("model_name,model_version,artifact,metrics,training_rows").eq("active", true).maybeSingle();
  if (error || !data) return null;
  const artifact = data.artifact as PortableModel;
  return artifact?.format === "rainwatch-model/v1" ? { ...data, artifact } : null;
}, ["active-rainwatch-model"], { revalidate: 300 });

function valuesFor(model: PortableModel, values: Record<string, number | null>) {
  return model.feature_names.map((name, i) => Number.isFinite(values[name]) ? values[name]! : model.imputer[i]);
}
function treeValue(nodes: Node[], values: number[]) {
  let index = 0;
  while (nodes[index] && nodes[index].value === undefined) {
    const node = nodes[index]; index = values[node.feature] <= node.threshold ? node.left : node.right;
  }
  return nodes[index]?.value ?? 0;
}
export function runPortableModel(model: PortableModel, values: Record<string, number | null>) {
  const x = valuesFor(model, values);
  if (model.kind === "linear") return (model.intercept ?? 0) + x.reduce((sum, value, i) => sum + value * (model.coefficients?.[i] ?? 0), 0);
  return (model.baseline ?? 0) + (model.trees ?? []).reduce((sum, tree) => sum + treeValue(tree, x) * (model.learning_rate ?? 1), 0);
}
export async function predictRainfall(rawForecast: number, features: Record<string, number | null>): Promise<RainfallPrediction> {
  try {
    const model = await getActiveModel();
    if (!model) return { rawForecast, correctedForecast: null, modelName: null, modelVersion: null, improvementKnown: false };
    const corrected = Math.max(0, runPortableModel(model.artifact, features));
    const rawMae = Number(model.metrics.raw_mae), mlMae = Number(model.metrics.mae);
    return { rawForecast, correctedForecast: Number.isFinite(corrected) ? corrected : null, modelName: model.model_name, modelVersion: model.model_version, improvementKnown: Number.isFinite(rawMae) && Number.isFinite(mlMae) && mlMae < rawMae };
  } catch { return { rawForecast, correctedForecast: null, modelName: null, modelVersion: null, improvementKnown: false }; }
}
export async function activeModelMetadata() { return getActiveModel(); }
