import { $el } from "../ui";
import { api } from "../api";
import { ComfyDialog } from "./dialog";
import type { ComfyApp } from "../app";
import type { Setting, SettingParams } from "@/types/settingTypes";

export class ComfySettingsDialog extends ComfyDialog<HTMLDialogElement> {
  app: ComfyApp;
  settingsValues: any;
  settingsLookup: Record<string, Setting>;

  constructor(app: ComfyApp) {
    super();
    const frontendVersion = window["__COMFYUI_FRONTEND_VERSION__"];
    this.app = app;
    this.settingsValues = {};
    this.settingsLookup = {};
    this.element = $el(
      "dialog",
      {
        id: "comfy-settings-dialog",
        parent: document.body,
      },
      [
        $el("table.comfy-modal-content.comfy-table", [
          $el(
            "caption",
            { textContent: `Settings (v${frontendVersion})` },
            $el("button.comfy-btn", {
              type: "button",
              textContent: "\u00d7",
              onclick: () => {
                this.element.close();
              },
            })
          ),
          $el("tbody", { $: (tbody) => (this.textElement = tbody) }),
          $el("button", {
            type: "button",
            textContent: "Close",
            style: {
              cursor: "pointer",
            },
            onclick: () => {
              this.element.close();
            },
          }),
        ]),
      ]
    ) as HTMLDialogElement;
  }

  get settings() {
    return Object.values(this.settingsLookup);
  }

  #dispatchChange<T>(id: string, value: T, oldValue?: T) {
    this.dispatchEvent(
      new CustomEvent(id + ".change", {
        detail: {
          value,
          oldValue,
        },
      })
    );
  }

  async load() {
    if (this.app.storageLocation === "browser") {
      this.settingsValues = localStorage;
    } else {
      this.settingsValues = await api.getSettings();
    }

    // Trigger onChange for any settings added before load
    for (const id in this.settingsLookup) {
      const value = this.settingsValues[this.getId(id)];
      this.settingsLookup[id].onChange?.(value);
      this.#dispatchChange(id, value);
    }
  }

  getId(id: string) {
    if (this.app.storageLocation === "browser") {
      id = "Comfy.Settings." + id;
    }
    return id;
  }

  getSettingValue<T>(id: string, defaultValue?: T): T {
    let value = this.settingsValues[this.getId(id)];
    if (value != null) {
      if (this.app.storageLocation === "browser") {
        try {
          value = JSON.parse(value) as T;
        } catch (error) {}
      }
    }
    return value ?? defaultValue;
  }

  async setSettingValueAsync(id: string, value: any) {
    const json = JSON.stringify(value);
    localStorage["Comfy.Settings." + id] = json; // backwards compatibility for extensions keep setting in storage

    let oldValue = this.getSettingValue(id, undefined);
    this.settingsValues[this.getId(id)] = value;

    if (id in this.settingsLookup) {
      this.settingsLookup[id].onChange?.(value, oldValue);
    }
    this.#dispatchChange(id, value, oldValue);

    await api.storeSetting(id, value);
  }

  setSettingValue(id: string, value: any) {
    this.setSettingValueAsync(id, value).catch((err) => {
      alert(`Error saving setting '${id}'`);
      console.error(err);
    });
  }

  refreshSetting(id: string) {
    const value = this.getSettingValue(id);
    this.settingsLookup[id].onChange?.(value);
    this.#dispatchChange(id, value);
  }

  addSetting(params: SettingParams) {
    const {
      id,
      name,
      type,
      defaultValue,
      onChange,
      attrs = {},
      tooltip = "",
      options = undefined,
    } = params;
    if (!id) {
      throw new Error("Settings must have an ID");
    }

    if (id in this.settingsLookup) {
      throw new Error(`Setting ${id} of type ${type} must have a unique ID.`);
    }

    let skipOnChange = false;
    let value = this.getSettingValue(id);
    if (value == null) {
      if (this.app.isNewUserSession) {
        // Check if we have a localStorage value but not a setting value and we are a new user
        const localValue = localStorage["Comfy.Settings." + id];
        if (localValue) {
          value = JSON.parse(localValue);
          this.setSettingValue(id, value); // Store on the server
        }
      }
      if (value == null) {
        value = defaultValue;
      }
    }

    // Trigger initial setting of value
    if (!skipOnChange) {
      onChange?.(value, undefined);
    }

    this.settingsLookup[id] = {
      id,
      onChange,
      name,
      render: () => {
        if (type === "hidden") return;

        const setter = (v) => {
          if (onChange) {
            onChange(v, value);
          }

          this.setSettingValue(id, v);
          value = v;
        };
        value = this.getSettingValue(id, defaultValue);

        let element;
        const htmlID = id.replaceAll(".", "-");

        const labelCell = $el("td", [
          $el("label", {
            for: htmlID,
            classList: [tooltip !== "" ? "comfy-tooltip-indicator" : ""],
            textContent: name,
          }),
        ]);

        if (typeof type === "function") {
          element = type(name, setter, value, attrs);
        } else {
          switch (type) {
            case "boolean":
              element = $el("tr", [
                labelCell,
                $el("td", [
                  $el("input", {
                    id: htmlID,
                    type: "checkbox",
                    checked: value,
                    onchange: (event) => {
                      const isChecked = event.target.checked;
                      if (onChange !== undefined) {
                        onChange(isChecked);
                      }
                      this.setSettingValue(id, isChecked);
                    },
                  }),
                ]),
              ]);
              break;
            case "number":
              element = $el("tr", [
                labelCell,
                $el("td", [
                  $el("input", {
                    type,
                    value,
                    id: htmlID,
                    oninput: (e) => {
                      setter(e.target.value);
                    },
                    ...attrs,
                  }),
                ]),
              ]);
              break;
            case "slider":
              element = $el("tr", [
                labelCell,
                $el("td", [
                  $el(
                    "div",
                    {
                      style: {
                        display: "grid",
                        gridAutoFlow: "column",
                      },
                    },
                    [
                      $el("input", {
                        ...attrs,
                        value,
                        type: "range",
                        oninput: (e) => {
                          setter(e.target.value);
                          e.target.nextElementSibling.value = e.target.value;
                        },
                      }),
                      $el("input", {
                        ...attrs,
                        value,
                        id: htmlID,
                        type: "number",
                        style: { maxWidth: "4rem" },
                        oninput: (e) => {
                          setter(e.target.value);
                          e.target.previousElementSibling.value =
                            e.target.value;
                        },
                      }),
                    ]
                  ),
                ]),
              ]);
              break;
            case "combo":
              element = $el("tr", [
                labelCell,
                $el("td", [
                  $el(
                    "select",
                    {
                      oninput: (e) => {
                        setter(e.target.value);
                      },
                    },
                    (typeof options === "function"
                      ? options(value)
                      : options || []
                    ).map((opt) => {
                      if (typeof opt === "string") {
                        opt = { text: opt };
                      }
                      const v = opt.value ?? opt.text;
                      return $el("option", {
                        value: v,
                        textContent: opt.text,
                        selected: value + "" === v + "",
                      });
                    })
                  ),
                ]),
              ]);
              break;
            case "text":
            default:
              if (type !== "text") {
                console.warn(
                  `Unsupported setting type '${type}, defaulting to text`
                );
              }

              element = $el("tr", [
                labelCell,
                $el("td", [
                  $el("input", {
                    value,
                    id: htmlID,
                    oninput: (e) => {
                      setter(e.target.value);
                    },
                    ...attrs,
                  }),
                ]),
              ]);
              break;
          }
        }
        if (tooltip) {
          element.title = tooltip;
        }

        return element;
      },
    } as Setting;

    const self = this;
    return {
      get value() {
        return self.getSettingValue(id, defaultValue);
      },
      set value(v) {
        self.setSettingValue(id, v);
      },
    };
  }

  show() {
    this.textElement.replaceChildren(
      $el(
        "tr",
        {
          style: { display: "none" },
        },
        [$el("th"), $el("th", { style: { width: "33%" } })]
      ),
      ...this.settings
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => s.render())
        .filter(Boolean)
    );
    this.element.showModal();
  }
}
