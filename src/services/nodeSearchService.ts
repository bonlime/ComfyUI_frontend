import { ComfyNodeDef } from "@/types/apiTypes";
import { getNodeSource } from "@/types/nodeSource";
import Fuse, { IFuseOptions, FuseSearchOptions } from "fuse.js";
import _ from "lodash";

export const SYSTEM_NODE_DEFS: ComfyNodeDef[] = [
  {
    name: "PrimitiveNode",
    display_name: "Primitive",
    category: "utils",
    input: { required: {}, optional: {} },
    output: ["*"],
    output_name: ["connect to widget input"],
    output_is_list: [false],
    python_module: "nodes",
    description: "Primitive values like numbers, strings, and booleans.",
  },
  {
    name: "Reroute",
    display_name: "Reroute",
    category: "utils",
    input: { required: { "": ["*"] }, optional: {} },
    output: ["*"],
    output_name: [""],
    output_is_list: [false],
    python_module: "nodes",
    description: "Reroute the connection to another node.",
  },
  {
    name: "Note",
    display_name: "Note",
    category: "utils",
    input: { required: {}, optional: {} },
    output: [],
    output_name: [],
    output_is_list: [],
    python_module: "nodes",
    description: "Node that add notes to your project",
  },
];

export class FuseSearch<T> {
  private fuse: Fuse<T>;
  public readonly data: T[];

  constructor(
    data: T[],
    options?: IFuseOptions<T>,
    createIndex: boolean = true
  ) {
    this.data = data;
    const index =
      createIndex && options?.keys
        ? Fuse.createIndex(options.keys, data)
        : undefined;
    this.fuse = new Fuse(data, options, index);
  }

  public search(query: string, options?: FuseSearchOptions): T[] {
    if (!query || query === "") {
      return [...this.data];
    }
    return this.fuse.search(query, options).map((result) => result.item);
  }
}

export type FilterAndValue<T = string> = [NodeFilter<T>, T];

export abstract class NodeFilter<FilterOptionT = string> {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly invokeSequence: string;
  public abstract readonly longInvokeSequence: string;
  public readonly fuseSearch: FuseSearch<FilterOptionT>;

  constructor(nodeDefs: ComfyNodeDef[], options?: IFuseOptions<FilterOptionT>) {
    this.fuseSearch = new FuseSearch(this.getAllNodeOptions(nodeDefs), options);
  }

  private getAllNodeOptions(nodeDefs: ComfyNodeDef[]): FilterOptionT[] {
    return [
      ...new Set(
        nodeDefs.reduce((acc, nodeDef) => {
          return [...acc, ...this.getNodeOptions(nodeDef)];
        }, [])
      ),
    ];
  }

  public abstract getNodeOptions(node: ComfyNodeDef): FilterOptionT[];

  public matches(node: ComfyNodeDef, value: FilterOptionT): boolean {
    return this.getNodeOptions(node).includes(value);
  }
}

export class InputTypeFilter extends NodeFilter<string> {
  public readonly id: string = "input";
  public readonly name = "Input Type";
  public readonly invokeSequence = "i";
  public readonly longInvokeSequence = "input";

  public override getNodeOptions(node: ComfyNodeDef): string[] {
    const inputs = {
      ...(node.input.required || {}),
      ...(node.input.optional || {}),
    };
    return Object.values(inputs).map((input) => {
      const [inputType, inputSpec] = input;
      return typeof inputType === "string" ? inputType : "COMBO";
    });
  }
}

export class OutputTypeFilter extends NodeFilter<string> {
  public readonly id: string = "output";
  public readonly name = "Output Type";
  public readonly invokeSequence = "o";
  public readonly longInvokeSequence = "output";

  public override getNodeOptions(node: ComfyNodeDef): string[] {
    const outputs = node.output || [];
    // "custom_nodes.was-node-suite-comfyui"
    // has a custom node with an output that is not an array.
    // https://github.com/WASasquatch/was-node-suite-comfyui/pull/440
    if (!(outputs instanceof Array)) {
      console.error("Invalid output type", node);
      return [];
    }
    return outputs.map((output) => {
      return typeof output === "string" ? output : output[0];
    });
  }
}

export class NodeSourceFilter extends NodeFilter<string> {
  public readonly id: string = "source";
  public readonly name = "Source";
  public readonly invokeSequence = "s";
  public readonly longInvokeSequence = "source";

  public override getNodeOptions(node: ComfyNodeDef): string[] {
    return [getNodeSource(node.python_module).displayText];
  }
}

export class NodeCategoryFilter extends NodeFilter<string> {
  public readonly id: string = "category";
  public readonly name = "Category";
  public readonly invokeSequence = "c";
  public readonly longInvokeSequence = "category";

  public override getNodeOptions(node: ComfyNodeDef): string[] {
    return [node.category];
  }
}

export class NodeSearchService {
  public readonly nodeFuseSearch: FuseSearch<ComfyNodeDef>;
  public readonly nodeFilters: NodeFilter<string>[];

  constructor(data: ComfyNodeDef[]) {
    this.nodeFuseSearch = new FuseSearch(data, {
      keys: ["name", "display_name", "description"],
      includeScore: true,
      threshold: 0.6,
      shouldSort: true,
    });

    const filterSearchOptions = {
      includeScore: true,
      threshold: 0.6,
      shouldSort: true,
    };

    this.nodeFilters = [
      new InputTypeFilter(data, filterSearchOptions),
      new OutputTypeFilter(data, filterSearchOptions),
      new NodeCategoryFilter(data, filterSearchOptions),
    ];

    if (data[0].python_module !== undefined) {
      this.nodeFilters.push(new NodeSourceFilter(data, filterSearchOptions));
    }
  }

  public endsWithFilterStartSequence(query: string): boolean {
    return query.endsWith(":");
  }

  public searchNode(
    query: string,
    filters: FilterAndValue<string>[] = [],
    options?: FuseSearchOptions
  ): ComfyNodeDef[] {
    const matchedNodes = this.nodeFuseSearch.search(query);

    const results = matchedNodes.filter((node) => {
      return _.every(filters, (filterAndValue) => {
        const [filter, value] = filterAndValue;
        return filter.matches(node, value);
      });
    });

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  public getFilterById(id: string): NodeFilter<string> | undefined {
    return this.nodeFilters.find((filter) => filter.id === id);
  }
}
