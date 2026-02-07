import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { analyzeConfigSchema, renderConfigForm } from "./views/config-form.ts";

const rootSchema = {
  type: "object",
  properties: {
    gateway: {
      type: "object",
      properties: {
        auth: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
      },
    },
    allowFrom: {
      type: "array",
      items: { type: "string" },
    },
    mode: {
      type: "string",
      enum: ["off", "token"],
    },
    enabled: {
      type: "boolean",
    },
    bind: {
      anyOf: [{ const: "auto" }, { const: "lan" }, { const: "tailnet" }, { const: "loopback" }],
    },
  },
};

describe("config form renderer", () => {
  it("renders inputs and patches values", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "gateway.auth.token": { label: "Gateway Token", sensitive: true },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: {},
        onPatch,
      }),
      container,
    );

    const tokenInput: HTMLInputElement | null = container.querySelector("input[type='password']");
    expect(tokenInput).not.toBeNull();
    if (!tokenInput) {
      return;
    }
    tokenInput.value = "abc123";
    tokenInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["gateway", "auth", "token"], "abc123");

    const tokenButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".cfg-segmented__btn"),
    ).find((btn) => btn.textContent?.trim() === "token");
    expect(tokenButton).not.toBeUndefined();
    tokenButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["mode"], "token");

    const checkbox: HTMLInputElement | null = container.querySelector("input[type='checkbox']");
    expect(checkbox).not.toBeNull();
    if (!checkbox) {
      return;
    }
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["enabled"], true);
  });

  it("adds and removes array entries", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { allowFrom: ["+1"] },
        onPatch,
      }),
      container,
    );

    const addButton = container.querySelector(".cfg-array__add");
    expect(addButton).not.toBeUndefined();
    addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["allowFrom"], ["+1", ""]);

    const removeButton = container.querySelector(".cfg-array__item-remove");
    expect(removeButton).not.toBeUndefined();
    removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["allowFrom"], []);
  });

  it("renders union literals as select options", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { bind: "auto" },
        onPatch,
      }),
      container,
    );

    const tailnetButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".cfg-segmented__btn"),
    ).find((btn) => btn.textContent?.trim() === "tailnet");
    expect(tailnetButton).not.toBeUndefined();
    tailnetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["bind"], "tailnet");
  });

  it("renders map fields from additionalProperties", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        slack: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { slack: { channelA: "ok" } },
        onPatch,
      }),
      container,
    );

    const removeButton = container.querySelector(".cfg-map__item-remove");
    expect(removeButton).not.toBeUndefined();
    removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["slack"], {});
  });

  it("shows contextual map-key guidance for discord guild maps", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        channels: {
          type: "object",
          properties: {
            discord: {
              type: "object",
              properties: {
                guilds: {
                  type: "object",
                  additionalProperties: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { channels: { discord: { guilds: { "123456789012345678": "on" } } } },
        onPatch,
      }),
      container,
    );

    const addButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".cfg-map__add"),
    ).find((button) => button.textContent?.includes("Add Guild"));
    expect(addButton).toBeDefined();
    expect(container.textContent).toContain("Use Discord guild IDs");
    expect(
      container
        .querySelector<HTMLInputElement>(".cfg-map__item-key input")
        ?.getAttribute("placeholder"),
    ).toBe("123456789012345678");
  });

  it("uses singular add labels for arrays with named hints", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        owners: {
          type: "array",
          items: { type: "string" },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          owners: { label: "Owners" },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: { owners: [] },
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("Add Owner");
    expect(container.textContent).toContain("Each owner expects text.");
  });

  it("applies fallback hints when backend uiHints are missing", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        channels: {
          type: "object",
          properties: {
            discord: {
              type: "object",
              properties: {
                allowBots: { type: "boolean" },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { channels: { discord: { allowBots: true } } },
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("Allow replies to bot-authored messages");
    expect(container.textContent).toContain("bot-to-bot reply loops");
    const docsLink = container.querySelector("a.cfg-field__docs");
    expect(docsLink?.getAttribute("href")).toBe("https://docs.openclaw.ai/gateway/configuration");
  });

  it("supports wildcard uiHints for map entries", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        plugins: {
          type: "object",
          properties: {
            entries: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "plugins.entries.*.enabled": { label: "Plugin Enabled" },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: { plugins: { entries: { "voice-call": { enabled: true } } } },
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("Plugin Enabled");
  });

  it("groups fields by uiHints and collapses advanced groups", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        server: {
          type: "object",
          properties: {
            host: { type: "string" },
            port: { type: "number" },
            token: { type: "string" },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "server.host": { group: "Connection" },
          "server.port": { group: "Connection" },
          "server.token": { group: "Security", advanced: true },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: { server: { host: "localhost", port: 8080, token: "secret" } },
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("Connection");
    const advancedGroup = Array.from(
      container.querySelectorAll("details.cfg-group--advanced"),
    ).find((el) => el.textContent?.includes("Security"));
    expect(advancedGroup).toBeDefined();
    expect((advancedGroup as HTMLDetailsElement).open).toBe(false);
  });

  it("collapses deep nested objects by default", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        gateway: {
          type: "object",
          properties: {
            nested: {
              type: "object",
              properties: {
                actions: {
                  type: "object",
                  properties: {
                    enabled: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { gateway: { nested: { actions: { enabled: true } } } },
        onPatch,
      }),
      container,
    );

    const deepObject = Array.from(container.querySelectorAll("details.cfg-object")).find((el) => {
      const title = el.querySelector(".cfg-object__title")?.textContent?.trim();
      return title === "Actions";
    });
    expect(deepObject).toBeDefined();
    expect((deepObject as HTMLDetailsElement).open).toBe(false);
  });

  it("surfaces impact warnings and applies quick fixes", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        channels: {
          type: "object",
          properties: {
            discord: {
              type: "object",
              properties: {
                actions: {
                  type: "object",
                  properties: {
                    roles: { type: "boolean" },
                    permissions: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "channels.discord.actions.roles": {
            docsPath: "/channels/discord",
            impacts: [
              {
                relation: "requires",
                when: "truthy",
                targetPath: "channels.discord.actions.permissions",
                targetWhen: "truthy",
                message: "Role management depends on permissions actions being enabled.",
                fixValue: true,
                fixLabel: "Enable permissions",
              },
            ],
          },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: {
          channels: {
            discord: {
              actions: {
                roles: true,
                permissions: false,
              },
            },
          },
        },
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain(
      "Role management depends on permissions actions being enabled.",
    );
    const docsLink = container.querySelector("a.cfg-field__docs");
    expect(docsLink?.getAttribute("href")).toBe("https://docs.openclaw.ai/channels/discord");

    const fixButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Enable permissions",
    );
    expect(fixButton).toBeDefined();
    fixButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["channels", "discord", "actions", "permissions"], true);
  });

  it("flags unsupported unions", () => {
    const schema = {
      type: "object",
      properties: {
        mixed: {
          anyOf: [{ type: "string" }, { type: "object", properties: {} }],
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).toContain("mixed");
  });

  it("supports nullable types", () => {
    const schema = {
      type: "object",
      properties: {
        note: { type: ["string", "null"] },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).not.toContain("note");
  });

  it("ignores untyped additionalProperties schemas", () => {
    const schema = {
      type: "object",
      properties: {
        channels: {
          type: "object",
          properties: {
            whatsapp: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
              },
            },
          },
          additionalProperties: {},
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).not.toContain("channels");
  });

  it("flags additionalProperties true", () => {
    const schema = {
      type: "object",
      properties: {
        extra: {
          type: "object",
          additionalProperties: true,
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).toContain("extra");
  });
});
