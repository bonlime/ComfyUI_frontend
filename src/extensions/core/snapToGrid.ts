import { app } from "../../scripts/app";
import {
  LGraphCanvas,
  LGraphNode,
  LGraphGroup,
  LiteGraph,
} from "@comfyorg/litegraph";

// Shift + drag/resize to snap to grid

/** Rounds a Vector2 in-place to the current CANVAS_GRID_SIZE. */
function roundVectorToGrid(vec) {
  vec[0] =
    LiteGraph.CANVAS_GRID_SIZE *
    Math.round(vec[0] / LiteGraph.CANVAS_GRID_SIZE);
  vec[1] =
    LiteGraph.CANVAS_GRID_SIZE *
    Math.round(vec[1] / LiteGraph.CANVAS_GRID_SIZE);
  return vec;
}

app.registerExtension({
  name: "Comfy.SnapToGrid",
  init() {
    // Add setting to control grid size
    app.ui.settings.addSetting({
      id: "Comfy.SnapToGrid.GridSize",
      name: "Grid Size",
      type: "slider",
      attrs: {
        min: 1,
        max: 500,
      },
      tooltip:
        "When dragging and resizing nodes while holding shift they will be aligned to the grid, this controls the size of that grid.",
      defaultValue: LiteGraph.CANVAS_GRID_SIZE,
      onChange(value) {
        LiteGraph.CANVAS_GRID_SIZE = +value;
      },
    });

    // After moving a node, if the shift key is down align it to grid
    const onNodeMoved = app.canvas.onNodeMoved;
    app.canvas.onNodeMoved = function (node) {
      const r = onNodeMoved?.apply(this, arguments);

      if (app.shiftDown) {
        // Ensure all selected nodes are realigned
        for (const id in this.selected_nodes) {
          this.selected_nodes[id].alignToGrid();
        }
      }

      return r;
    };

    // When a node is added, add a resize handler to it so we can fix align the size with the grid
    const onNodeAdded = app.graph.onNodeAdded;
    app.graph.onNodeAdded = function (node) {
      const onResize = node.onResize;
      node.onResize = function () {
        if (app.shiftDown) {
          roundVectorToGrid(node.size);
        }
        return onResize?.apply(this, arguments);
      };
      return onNodeAdded?.apply(this, arguments);
    };

    // Draw a preview of where the node will go if holding shift and the node is selected
    // @ts-ignore
    const origDrawNode = LGraphCanvas.prototype.drawNode;
    // @ts-ignore
    LGraphCanvas.prototype.drawNode = function (node, ctx) {
      if (
        app.shiftDown &&
        this.node_dragged &&
        node.id in this.selected_nodes
      ) {
        const [x, y] = roundVectorToGrid([...node.pos]);
        const shiftX = x - node.pos[0];
        let shiftY = y - node.pos[1];

        let w, h;
        if (node.flags.collapsed) {
          // @ts-ignore
          w = node._collapsed_width;
          h = LiteGraph.NODE_TITLE_HEIGHT;
          shiftY -= LiteGraph.NODE_TITLE_HEIGHT;
        } else {
          w = node.size[0];
          h = node.size[1];
          // @ts-ignore
          let titleMode = node.constructor.title_mode;
          if (
            titleMode !== LiteGraph.TRANSPARENT_TITLE &&
            titleMode !== LiteGraph.NO_TITLE
          ) {
            h += LiteGraph.NODE_TITLE_HEIGHT;
            shiftY -= LiteGraph.NODE_TITLE_HEIGHT;
          }
        }
        const f = ctx.fillStyle;
        ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
        ctx.fillRect(shiftX, shiftY, w, h);
        ctx.fillStyle = f;
      }

      return origDrawNode.apply(this, arguments);
    };

    /**
     * The currently moving, selected group only. Set after the `selected_group` has actually started
     * moving.
     */
    let selectedAndMovingGroup: LGraphGroup | null = null;

    /**
     * Handles moving a group; tracking when a group has been moved (to show the ghost in `drawGroups`
     * below) as well as handle the last move call from LiteGraph's `processMouseUp`.
     */
    // @ts-ignore
    const groupMove = LGraphGroup.prototype.move;
    // @ts-ignore
    LGraphGroup.prototype.move = function (deltax, deltay, ignore_nodes) {
      const v = groupMove.apply(this, arguments);
      // When we've started moving, set `selectedAndMovingGroup` as LiteGraph sets `selected_group`
      // too eagerly and we don't want to behave like we're moving until we get a delta.
      if (
        !selectedAndMovingGroup &&
        app.canvas.selected_group === this &&
        (deltax || deltay)
      ) {
        selectedAndMovingGroup = this;
      }

      // LiteGraph will call group.move both on mouse-move as well as mouse-up though we only want
      // to snap on a mouse-up which we can determine by checking if `app.canvas.last_mouse_dragging`
      // has been set to `false`. Essentially, this check here is the equivilant to calling an
      // `LGraphGroup.prototype.onNodeMoved` if it had existed.
      if (app.canvas.last_mouse_dragging === false && app.shiftDown) {
        // After moving a group (while app.shiftDown), snap all the child nodes and, finally,
        //  align the group itself.
        this.recomputeInsideNodes();
        for (const node of this._nodes) {
          node.alignToGrid();
        }
        // @ts-ignore
        LGraphNode.prototype.alignToGrid.apply(this);
      }
      return v;
    };

    /**
     * Handles drawing a group when, snapping the size when one is actively being resized tracking and/or
     * drawing a ghost box when one is actively being moved. This mimics the node snapping behavior for
     * both.
     */
    // @ts-ignore
    const drawGroups = LGraphCanvas.prototype.drawGroups;
    // @ts-ignore
    LGraphCanvas.prototype.drawGroups = function (canvas, ctx) {
      if (this.selected_group && app.shiftDown) {
        if (this.selected_group_resizing) {
          // @ts-ignore
          roundVectorToGrid(this.selected_group.size);
        } else if (selectedAndMovingGroup) {
          // @ts-ignore
          const [x, y] = roundVectorToGrid([...selectedAndMovingGroup.pos]);
          const f = ctx.fillStyle;
          const s = ctx.strokeStyle;
          ctx.fillStyle = "rgba(100, 100, 100, 0.33)";
          ctx.strokeStyle = "rgba(100, 100, 100, 0.66)";
          // @ts-ignore
          ctx.rect(x, y, ...selectedAndMovingGroup.size);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = f;
          ctx.strokeStyle = s;
        }
      } else if (!this.selected_group) {
        selectedAndMovingGroup = null;
      }
      return drawGroups.apply(this, arguments);
    };

    /** Handles adding a group in a snapping-enabled state. */
    // @ts-ignore
    const onGroupAdd = LGraphCanvas.onGroupAdd;
    // @ts-ignore
    LGraphCanvas.onGroupAdd = function () {
      const v = onGroupAdd.apply(app.canvas, arguments);
      if (app.shiftDown) {
        // @ts-ignore
        const lastGroup = app.graph._groups[app.graph._groups.length - 1];
        if (lastGroup) {
          // @ts-ignore
          roundVectorToGrid(lastGroup.pos);
          // @ts-ignore
          roundVectorToGrid(lastGroup.size);
        }
      }
      return v;
    };
  },
});
