import { html, nothing } from "lit";
import type {
  ChannelAccountSnapshot,
  ChannelUiMetaEntry,
  ChannelsStatusSnapshot,
} from "../types.ts";
import type { ChannelKey, ChannelsProps } from "./channels.types.ts";

export function formatDuration(ms?: number | null) {
  if (!ms && ms !== 0) {
    return "n/a";
  }
  const sec = Math.round(ms / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return `${min}m`;
  }
  const hr = Math.round(min / 60);
  return `${hr}h`;
}

export function channelEnabled(key: ChannelKey, props: ChannelsProps) {
  const snapshot = props.snapshot;
  const channels = snapshot?.channels as Record<string, unknown> | null;
  if (!snapshot || !channels) {
    return false;
  }
  const channelStatus = channels[key] as Record<string, unknown> | undefined;
  const configured = typeof channelStatus?.configured === "boolean" && channelStatus.configured;
  const running = typeof channelStatus?.running === "boolean" && channelStatus.running;
  const connected = typeof channelStatus?.connected === "boolean" && channelStatus.connected;
  const accounts = snapshot.channelAccounts?.[key] ?? [];
  const accountActive = accounts.some(
    (account) => account.configured || account.running || account.connected,
  );
  return configured || running || connected || accountActive;
}

export function getChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
): number {
  return channelAccounts?.[key]?.length ?? 0;
}

export function renderChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
) {
  const count = getChannelAccountCount(key, channelAccounts);
  if (count < 2) {
    return nothing;
  }
  return html`<div class="account-count">Accounts (${count})</div>`;
}

function resolveChannelMetaMap(
  snapshot: ChannelsStatusSnapshot | null,
): Record<string, ChannelUiMetaEntry> {
  if (!snapshot?.channelMeta?.length) {
    return {};
  }
  return Object.fromEntries(snapshot.channelMeta.map((entry) => [entry.id, entry]));
}

export function resolveChannelMeta(
  snapshot: ChannelsStatusSnapshot | null,
  key: string,
): ChannelUiMetaEntry | null {
  return resolveChannelMetaMap(snapshot)[key] ?? null;
}

export function resolveChannelLabel(snapshot: ChannelsStatusSnapshot | null, key: string): string {
  const meta = resolveChannelMeta(snapshot, key);
  return meta?.label ?? snapshot?.channelLabels?.[key] ?? key;
}

export function resolveChannelDescription(
  snapshot: ChannelsStatusSnapshot | null,
  key: string,
  fallback: string,
): string {
  const meta = resolveChannelMeta(snapshot, key);
  return meta?.description?.trim() || fallback;
}

function toDocsUrl(path?: string): string | null {
  const raw = path?.trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (!raw.startsWith("/")) {
    return `https://docs.openclaw.ai/${raw}`;
  }
  return `https://docs.openclaw.ai${raw}`;
}

export function resolveChannelDocsUrl(
  snapshot: ChannelsStatusSnapshot | null,
  key: string,
): string | null {
  const meta = resolveChannelMeta(snapshot, key);
  return toDocsUrl(meta?.docsPath);
}

export function renderChannelHeader(params: {
  channelId: string;
  props: ChannelsProps;
  fallbackTitle: string;
  fallbackSub: string;
  actions?: unknown;
}) {
  const title =
    resolveChannelLabel(params.props.snapshot, params.channelId) ?? params.fallbackTitle;
  const description = resolveChannelDescription(
    params.props.snapshot,
    params.channelId,
    params.fallbackSub,
  );
  const docsUrl = resolveChannelDocsUrl(params.props.snapshot, params.channelId);

  return html`
    <div class="section-header">
      <div class="section-header__meta">
        <div class="card-title">${title}</div>
        <div class="card-sub">${description}</div>
      </div>
      <div class="section-header__actions">
        ${
          docsUrl
            ? html`
                <a class="btn quiet btn--sm" href=${docsUrl} target="_blank" rel="noreferrer">
                  Guide
                </a>
              `
            : nothing
        }
        ${params.actions ?? nothing}
      </div>
    </div>
  `;
}
