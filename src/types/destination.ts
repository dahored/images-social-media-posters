export type DestinationKind = "download-zip" | "download-png" | "telegram";

export interface PublishResult {
  destination: DestinationKind;
  timestamp: string;
  success: boolean;
  messageId?: string;
  error?: string;
}
