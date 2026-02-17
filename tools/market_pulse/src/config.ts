import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SourceConfig {
  id: string;
  name: string;
  url: string;
  category: string;
  tags: string[];
  weight: number;
}

interface Config {
  sources: SourceConfig[];
  pain_keywords: string[];
  demand_keywords: string[];
  urgency_keywords: string[];
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;
  const yamlPath = join(__dirname, "..", "sources.yaml");
  const raw = readFileSync(yamlPath, "utf-8");
  _config = yaml.load(raw) as Config;
  return _config;
}

export type { SourceConfig, Config };
