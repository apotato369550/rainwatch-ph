import "server-only";
import { sharedPrompt } from "./shared";
import { dashboardPrompt } from "./dashboard";
import { conditionsPrompt } from "./conditions";
import { seasonalPrompt } from "./seasonal";
import { environmentPrompt } from "./environment";
export const prompts = {
  dashboard: dashboardPrompt,
  conditions: conditionsPrompt,
  seasonal: seasonalPrompt,
  environment: environmentPrompt,
};
export { sharedPrompt };
