import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { ChannelsProps } from "./channels.types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";

function makeProps(overrides: Record<string, unknown> = {}): ChannelsProps {
  return {
    configSaving: false,
    configSchemaLoading: false,
    configFormDirty: false,
    configForm: {
      channels: {
        discord: {
          enabled: true,
        },
      },
    },
    configSchema: {
      type: "object",
      properties: {
        channels: {
          type: "object",
          properties: {
            discord: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    configUiHints: {},
    onConfigPatch: vi.fn(),
    onConfigSave: vi.fn(),
    onConfigReload: vi.fn(),
    ...overrides,
  } as unknown as ChannelsProps;
}

describe("channel config section", () => {
  it("keeps channel settings collapsed by default", () => {
    const container = document.createElement("div");
    render(renderChannelConfigSection({ channelId: "discord", props: makeProps() }), container);

    const details = container.querySelector<HTMLDetailsElement>("details.cfg-group--advanced");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Save",
    );
    const reloadButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Reload",
    );
    expect(saveButton?.className).toContain("primary");
    expect(reloadButton?.className).toContain("quiet");
  });

  it("expands channel settings when form is dirty", () => {
    const container = document.createElement("div");
    render(
      renderChannelConfigSection({
        channelId: "discord",
        props: makeProps({ configFormDirty: true }),
      }),
      container,
    );

    const details = container.querySelector<HTMLDetailsElement>("details.cfg-group--advanced");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(true);
  });
});
