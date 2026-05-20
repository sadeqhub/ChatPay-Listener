export interface InstagramWebhookPayload {
  object: string;
  entry?: InstagramWebhookEntry[];
}

export interface InstagramWebhookEntry {
  id: string;
  time?: number;
  messaging?: InstagramMessagingEvent[];
}

export interface InstagramMessagingEvent {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: InstagramMessage;
  postback?: InstagramPostback;
  reaction?: unknown;
  standby?: unknown;
}

export interface InstagramMessage {
  mid: string;
  text?: string;
  is_echo?: boolean;
  is_deleted?: boolean;
  is_unsupported?: boolean;
  attachments?: unknown[];
}

export interface InstagramPostback {
  mid?: string;
  title?: string;
  payload?: string;
}
