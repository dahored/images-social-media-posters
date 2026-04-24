export interface NetworkFormat {
  id: string;
  name: string;
  ratios: NetworkRatio[];
}

export interface NetworkRatio {
  ratio: string;
  width: number;
  height: number;
  label: string;
}

export interface Network {
  id: string;
  name: string;
  icon: string;
  defaultStyleHint: string;
  formats: NetworkFormat[];
  builtin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NetworksData {
  networks: Network[];
}
