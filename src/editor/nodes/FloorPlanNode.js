import EditorNodeMixin from "./EditorNodeMixin";
import { Mesh, MeshBasicMaterial, Box3, Vector3, PlaneBufferGeometry, Object3D } from "three";
import FloorPlan from "../objects/FloorPlan";
import ModelNode from "./ModelNode";
import GroundPlaneNode from "./GroundPlaneNode";
import BoxColliderNode from "./BoxColliderNode";
import mergeMeshGeometries from "../utils/mergeMeshGeometries";
import RecastClient from "../recast/RecastClient";
import HeightfieldClient from "../heightfield/HeightfieldClient";
import SpawnPointNode from "../nodes/SpawnPointNode";

const recastClient = new RecastClient();
const heightfieldClient = new HeightfieldClient();

export default class FloorPlanNode extends EditorNodeMixin(FloorPlan) {
  static nodeName = "Floor Plan";

  static legacyComponentName = "floor-plan";

  static disableTransform = true;

  static canAddNode(editor) {
    return editor.scene.findNodeByType(FloorPlanNode) === null;
  }

  static async deserialize(editor, json) {
    const node = await super.deserialize(editor, json);

    const {
      autoCellSize,
      cellSize,
      cellHeight,
      agentHeight,
      agentRadius,
      agentMaxClimb,
      agentMaxSlope,
      regionMinSize,
      maxTriangles,
      forceTrimesh
    } = json.components.find(c => c.name === "floor-plan").props;

    node.autoCellSize = autoCellSize;
    node.cellSize = cellSize;
    node.cellHeight = cellHeight;
    node.agentHeight = agentHeight;
    node.agentRadius = agentRadius;
    node.agentMaxClimb = agentMaxClimb;
    node.agentMaxSlope = agentMaxSlope;
    node.regionMinSize = regionMinSize;
    node.maxTriangles = maxTriangles || 1000;
    node.forceTrimesh = forceTrimesh || false;

    return node;
  }

  constructor(editor) {
    super(editor);
    this.autoCellSize = true;
    this.cellSize = 0.166;
    this.cellHeight = 0.1;
    this.agentHeight = 1.7;
    this.agentRadius = 0.5;
    this.agentMaxClimb = 0.3;
    this.agentMaxSlope = 45;
    this.regionMinSize = 4;
    this.maxTriangles = 1000;
    this.forceTrimesh = false;
    this.heightfieldMesh = null;
  }

  onSelect() {
    if (this.navMesh) {
      this.navMesh.visible = true;
    }

    if (this.trimesh) {
      this.trimesh.visible = true;
    }

    if (this.heightfieldMesh) {
      this.heightfieldMesh.visible = true;
    }
  }

  onDeselect() {
    if (this.navMesh) {
      this.navMesh.visible = false;
    }

    if (this.trimesh) {
      this.trimesh.visible = false;
    }

    if (this.heightfieldMesh) {
      this.heightfieldMesh.visible = false;
    }
  }

  async generate(signal) {
    window.scene = this;
    const collidableMeshes = [];
    const walkableMeshes = [];

    const groundPlaneNode = this.editor.scene.findNodeByType(GroundPlaneNode);

    if (groundPlaneNode && groundPlaneNode.walkable) {
      walkableMeshes.push(groundPlaneNode.walkableMesh);
    }

    const modelNodes = this.editor.scene.getNodesByType(ModelNode);

    for (const node of modelNodes) {
      const model = node.model;

      if (!model || !(node.collidable || node.walkable)) {
        continue;
      }

      model.traverse(child => {
        if (child.isMesh) {
          if (node.collidable) {
            collidableMeshes.push(child);
          }

          if (node.walkable) {
            walkableMeshes.push(child);
          }
        }
      });
    }

    const boxColliderNodes = this.editor.scene.getNodesByType(BoxColliderNode);

    for (const node of boxColliderNodes) {
      if (node.walkable) {
        const helperMesh = node.helper.object;
        const boxColliderMesh = new Mesh(helperMesh.geometry, new MeshBasicMaterial());
        boxColliderMesh.applyMatrix(node.matrixWorld);
        boxColliderMesh.updateMatrixWorld();
        walkableMeshes.push(boxColliderMesh);
      }
    }

    const walkableGeometry = mergeMeshGeometries(walkableMeshes);

    const box = new Box3().setFromBufferAttribute(walkableGeometry.attributes.position);
    const size = new Vector3();
    box.getSize(size);
    if (Math.max(size.x, size.y, size.z) > 2000) {
      throw new Error(
        `Scene is too large (${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}) ` +
          `to generate a floor plan.\n` +
          `You can un-check the "walkable" checkbox on models to exclude them from the floor plan.`
      );
    }

    const area = size.x * size.z;

    // Tuned to produce cell sizes from ~0.5 to ~1.5 for areas from ~200 to ~350,000.
    const cellSize = this.autoCellSize ? Math.pow(area, 1 / 3) / 50 : this.cellSize;

    const navGeometry = await recastClient.buildNavMesh(
      walkableGeometry,
      {
        cellSize,
        cellHeight: this.cellHeight,
        agentHeight: this.agentHeight,
        agentRadius: this.agentRadius,
        agentMaxClimb: this.agentMaxClimb,
        agentMaxSlope: this.agentMaxSlope,
        regionMinSize: this.regionMinSize
      },
      signal
    );

    const navMesh = new Mesh(navGeometry, new MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.2 }));

    this.setNavMesh(navMesh);

    if (this.editor.selected === this) {
      navMesh.visible = true;
    }

    const collidableGeometry = mergeMeshGeometries(collidableMeshes);

    let heightfield = null;
    if (!this.forceTrimesh) {
      const spawnPoints = this.editor.scene.getNodesByType(SpawnPointNode);

      let minY = Number.POSITIVE_INFINITY;
      for (let j = 0; j < spawnPoints.length; j++) {
        minY = Math.min(minY, spawnPoints[j].position.y);
      }
      heightfield = await heightfieldClient.buildHeightfield(
        collidableGeometry,
        { minY: minY, agentHeight: this.agentHeight, triangleThreshold: this.maxTriangles },
        signal
      );
    }

    if (heightfield !== null) {
      this.setTrimesh(null);
      this.setHeightfield(heightfield);

      if (this.heightfieldMesh) {
        this.remove(this.heightfieldMesh);
      }

      const segments = heightfield.data[0].length;
      const heightfieldMeshGeometry = new PlaneBufferGeometry(
        heightfield.width,
        heightfield.length,
        segments - 1,
        segments - 1
      );
      heightfieldMeshGeometry.rotateX(-Math.PI / 2);
      const vertices = heightfieldMeshGeometry.attributes.position.array;

      for (let i = 0, j = 0, l = vertices.length; i < l / 3; i++, j += 3) {
        vertices[j + 1] = heightfield.data[Math.floor(i / segments)][i % segments];
      }

      const heightfieldMesh = new Mesh(
        heightfieldMeshGeometry,
        new MeshBasicMaterial({ wireframe: true, color: 0xffff00 })
      );
      heightfieldMesh.name = "HeightfieldMesh";

      this.heightfieldMesh = heightfieldMesh;

      this.add(heightfieldMesh);

      this.heightfieldMesh.layers.set(1);
      heightfieldMesh.position.set(heightfield.offset.x, 0, heightfield.offset.z);

      if (this.editor.selected !== this) {
        this.heightfieldMesh.visible = false;
      }
    } else {
      const trimesh = new Mesh(collidableGeometry, new MeshBasicMaterial({ wireframe: true, color: 0xff0000 }));

      this.setTrimesh(trimesh);
      if (this.heightfieldMesh) {
        this.remove(this.heightfieldMesh);
      }

      if (this.editor.selected === this) {
        trimesh.visible = true;
      }
    }

    return this;
  }

  copy(source, recursive = true) {
    if (recursive) {
      this.remove(this.heightfieldMesh);
    }

    super.copy(source, recursive);

    if (recursive) {
      const heightfieldMeshIndex = source.children.findIndex(child => child === source.heightfieldMesh);

      if (heightfieldMeshIndex !== -1) {
        this.heightfieldMesh = this.children[heightfieldMeshIndex];
      }
    }

    this.autoCellSize = source.autoCellSize;
    this.cellSize = source.cellSize;
    this.cellHeight = source.cellHeight;
    this.agentHeight = source.agentHeight;
    this.agentRadius = source.agentRadius;
    this.agentMaxClimb = source.agentMaxClimb;
    this.agentMaxSlope = source.agentMaxSlope;
    this.regionMinSize = source.regionMinSize;
    this.maxTriangles = source.maxTriangles;
    this.forceTrimesh = source.forceTrimesh;
    return this;
  }

  serialize() {
    return super.serialize({
      "floor-plan": {
        autoCellSize: this.autoCellSize,
        cellSize: this.cellSize,
        cellHeight: this.cellHeight,
        agentHeight: this.agentHeight,
        agentRadius: this.agentRadius,
        agentMaxClimb: this.agentMaxClimb,
        agentMaxSlope: this.agentMaxSlope,
        regionMinSize: this.regionMinSize,
        maxTriangles: this.maxTriangles,
        forceTrimesh: this.forceTrimesh
      }
    });
  }

  prepareForExport() {
    super.prepareForExport();

    if (this.heightfieldMesh) {
      this.remove(this.heightfieldMesh);
    }

    const navMeshMaterial = this.navMesh.material;
    navMeshMaterial.transparent = true;
    navMeshMaterial.opacity = 0;

    this.navMesh.name = "navMesh";
    this.navMesh.userData.gltfExtensions = {
      MOZ_hubs_components: {
        "nav-mesh": {},
        visible: { visible: false }
      }
    };

    if (this.trimesh) {
      this.trimesh.name = "trimesh";
      const trimeshMaterial = this.trimesh.material;
      trimeshMaterial.transparent = true;
      trimeshMaterial.opacity = 0;
      trimeshMaterial.wireframe = false;

      this.trimesh.userData.gltfExtensions = {
        MOZ_hubs_components: {
          trimesh: {},
          visible: { visible: false }
        }
      };
    }

    if (this.heightfield) {
      const heightfield = new Object3D();
      heightfield.name = "heightfield";
      heightfield.userData.gltfExtensions = {
        MOZ_hubs_components: {
          heightfield: this.heightfield
        }
      };
      this.add(heightfield);
    }
  }
}
