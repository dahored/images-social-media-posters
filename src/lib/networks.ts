import { readDataSafe, writeData } from "./data";
import { generateId, now } from "./utils";
import type { Network, NetworksData, NetworkFormat } from "@/types/network";

const FILE = "networks.json";

async function load(): Promise<NetworksData> {
  return readDataSafe<NetworksData>(FILE, { networks: [] });
}

async function save(data: NetworksData): Promise<void> {
  await writeData(FILE, data);
}

export async function listNetworks(): Promise<Network[]> {
  const data = await load();
  return data.networks;
}

export async function getNetwork(id: string): Promise<Network | null> {
  const data = await load();
  return data.networks.find((n) => n.id === id) ?? null;
}

export async function createNetwork(
  input: Omit<Network, "id" | "builtin" | "createdAt" | "updatedAt">
): Promise<Network> {
  const data = await load();
  const network: Network = {
    ...input,
    id: generateId(),
    builtin: false,
    createdAt: now(),
    updatedAt: now(),
  };
  data.networks.push(network);
  await save(data);
  return network;
}

export async function updateNetwork(
  id: string,
  updates: Partial<Pick<Network, "name" | "icon" | "defaultStyleHint" | "formats">>
): Promise<Network | null> {
  const data = await load();
  const idx = data.networks.findIndex((n) => n.id === id);
  if (idx === -1) return null;

  const network = data.networks[idx];
  // Builtin networks: only allow editing defaultStyleHint
  if (network.builtin) {
    if (updates.defaultStyleHint !== undefined) {
      network.defaultStyleHint = updates.defaultStyleHint;
    }
  } else {
    Object.assign(network, updates);
  }
  network.updatedAt = now();
  await save(data);
  return network;
}

export async function deleteNetwork(id: string): Promise<boolean> {
  const data = await load();
  const idx = data.networks.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  if (data.networks[idx].builtin) return false;
  data.networks.splice(idx, 1);
  await save(data);
  return true;
}

export async function addFormat(
  networkId: string,
  format: Omit<NetworkFormat, "id">
): Promise<NetworkFormat | null> {
  const data = await load();
  const network = data.networks.find((n) => n.id === networkId);
  if (!network || network.builtin) return null;
  const newFormat: NetworkFormat = { ...format, id: generateId() };
  network.formats.push(newFormat);
  network.updatedAt = now();
  await save(data);
  return newFormat;
}
