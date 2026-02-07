import { html, nothing } from "lit";
import type { DiscordStatus } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { formatAgo } from "../format.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { renderChannelHeader } from "./channels.shared.ts";

export function renderDiscordCard(params: {
  props: ChannelsProps;
  discord?: DiscordStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, discord, accountCountLabel } = params;

  return html`
    <div class="card">
      ${renderChannelHeader({
        channelId: "discord",
        props,
        fallbackTitle: "Discord",
        fallbackSub: "Bot status and channel configuration.",
        actions: html`<button class="btn quiet btn--sm" @click=${() => props.onRefresh(true)}>
          Probe
        </button>`,
      })}
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${discord?.configured ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${discord?.running ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${discord?.lastStartAt ? formatAgo(discord.lastStartAt) : "n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${discord?.lastProbeAt ? formatAgo(discord.lastProbeAt) : "n/a"}</span>
        </div>
      </div>

      ${
        discord?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${discord.lastError}
          </div>`
          : nothing
      }

      ${
        discord?.probe
          ? html`
              <details class="cfg-group cfg-group--advanced" style="margin-top: 12px;">
                <summary>Latest probe</summary>
                <div class="cfg-group__body">
                  <div class="callout">
                    Probe ${discord.probe.ok ? "ok" : "failed"} ·
                    ${discord.probe.status ?? ""} ${discord.probe.error ?? ""}
                  </div>
                </div>
              </details>
            `
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "discord", props })}
    </div>
  `;
}
