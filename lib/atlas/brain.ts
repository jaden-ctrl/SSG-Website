export type AtlasBrainContext = {
  version: string;
  status: "pending" | "loaded";
  instructions: string;
};

export const ATLAS_BRAIN_CONTEXT: AtlasBrainContext = {
  version: "pending-latest-ssg-brain",
  status: "pending",
  instructions: "",
};

export function getAtlasBrainContext(): AtlasBrainContext {
  return ATLAS_BRAIN_CONTEXT;
}
