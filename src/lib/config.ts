import { readDataSafe, writeData } from "./data";

export interface AppConfig {
  telegram?: {
    botToken: string;
    defaultChatId: string;
  };
}

const FILE = "config.json";

export async function getConfig(): Promise<AppConfig> {
  return readDataSafe<AppConfig>(FILE, {});
}

export async function updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getConfig();
  const updated: AppConfig = { ...current, ...updates };
  await writeData(FILE, updated);
  return updated;
}
