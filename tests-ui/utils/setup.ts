import "../../src/scripts/api";

const fs = require("fs");
const path = require("path");
function* walkSync(dir: string): Generator<string> {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(path.join(dir, file.name));
    } else {
      yield path.join(dir, file.name);
    }
  }
}

export interface APIConfig {
  mockExtensions?: string[];
  mockNodeDefs?: Record<string, any>;
  settings?: Record<string, string>;
  userConfig?: { storage: "server" | "browser"; users?: Record<string, any>; migrated?: boolean };
  userData?: Record<string, any>;
}

/**
 * @typedef { import("./src/types/comfy").ComfyObjectInfo } ComfyObjectInfo
 */

/**
 * @param {{
 *   mockExtensions?: string[],
 *   mockNodeDefs?: Record<string, ComfyObjectInfo>,
*   settings?: Record<string, string>
*   userConfig?: {storage: "server" | "browser", users?: Record<string, any>, migrated?: boolean },
*   userData?: Record<string, any>
 * }} config
 */
export function mockApi(config: APIConfig = {}) {
  let { mockExtensions, mockNodeDefs, userConfig, settings, userData } = {
    settings: {},
    userData: {},
    ...config,
  };
  if (!mockExtensions) {
    mockExtensions = Array.from(walkSync(path.resolve("./src/extensions/core")))
      .filter((x) => x.endsWith(".js"))
      .map((x) => path.relative(path.resolve("./src/"), x).replace(/\\/g, "/"));
  }
  if (!mockNodeDefs) {
    mockNodeDefs = JSON.parse(fs.readFileSync(path.resolve("./tests-ui/data/object_info.json")));
  }

  const events = new EventTarget();
  const mockApi = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    getSystemStats: jest.fn(),
    getExtensions: jest.fn(() => mockExtensions),
    getNodeDefs: jest.fn(() => mockNodeDefs),
    init: jest.fn(),
    apiURL: jest.fn((x) => "src/" + x),
    fileURL: jest.fn((x) => "src/" + x),
    createUser: jest.fn((username) => {
      // @ts-ignore
      if(username in userConfig.users) {
        return { status: 400, json: () => "Duplicate" }
      }
      // @ts-ignore
      userConfig.users[username + "!"] = username;
      return { status: 200, json: () => username + "!" }
    }),
    getUserConfig: jest.fn(() => userConfig ?? { storage: "browser", migrated: false }),
    getSettings: jest.fn(() => settings),
    storeSettings: jest.fn((v) => Object.assign(settings, v)),
    getUserData: jest.fn((f) => {
      if (f in userData) {
        return { status: 200, json: () => userData[f] };
      } else {
        return { status: 404 };
      }
    }),
    storeUserData: jest.fn((file, data) => {
      userData[file] = data;
    }),
    listUserData: jest.fn(() => []),
  };
  jest.mock("../../src/scripts/api", () => ({
    get api() {
      return mockApi;
    },
  }));
}
