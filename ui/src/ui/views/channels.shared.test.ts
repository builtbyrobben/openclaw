import { render } from "lit";
import { describe, expect, it } from "vitest";
import type { ChannelsProps } from "./channels.types.ts";
import { renderChannelHeader } from "./channels.shared.ts";

function makeProps(overrides: Record<string, unknown> = {}): ChannelsProps {
  return {
    snapshot: null,
    ...overrides,
  } as unknown as ChannelsProps;
}

describe("channel header", () => {
  it("renders docs guide links from channel metadata", () => {
    const container = document.createElement("div");
    const props = makeProps({
      snapshot: {
        ts: Date.now(),
        channelOrder: ["discord"],
        channelLabels: { discord: "Discord" },
        channels: {},
        channelAccounts: {},
        channelDefaultAccountId: {},
        channelMeta: [
          {
            id: "discord",
            label: "Discord",
            detailLabel: "Discord Bot",
            description: "Bot status and channel configuration.",
            docsPath: "/channels/discord",
          },
        ],
      },
    });

    render(
      renderChannelHeader({
        channelId: "discord",
        props,
        fallbackTitle: "Discord",
        fallbackSub: "Fallback summary",
      }),
      container,
    );

    expect(container.textContent).toContain("Bot status and channel configuration.");
    const guideLink = container.querySelector("a.btn.quiet");
    expect(guideLink?.getAttribute("href")).toBe("https://docs.openclaw.ai/channels/discord");
  });
});
