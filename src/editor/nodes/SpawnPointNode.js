import { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import EditorNodeMixin from "./EditorNodeMixin";
import spawnPointModelUrl from "../../assets/spawn-point.glb";
import eventToMessage from "../utils/eventToMessage";

let spawnPointHelperModel = null;

export default class SpawnPointNode extends EditorNodeMixin(Object3D) {
  static legacyComponentName = "spawn-point";

  static nodeName = "Spawn Point";

  static async load() {
    const { scene } = await new Promise((resolve, reject) => {
      new GLTFLoader().load(spawnPointModelUrl, resolve, null, e => {
        reject(new Error(`Error loading SpawnPointNode helper with url: ${spawnPointModelUrl}. ${eventToMessage(e)}`));
      });
    });

    scene.traverse(child => {
      if (child.isMesh) {
        child.layers.set(1);
      }
    });

    spawnPointHelperModel = scene;
  }

  constructor(editor) {
    super(editor);

    if (spawnPointHelperModel) {
      this.helper = spawnPointHelperModel.clone();
      this.add(this.helper);
    } else {
      console.warn("SpawnPointNode: helper model was not loaded before creating a new SpawnPointNode");
      this.helper = null;
    }
  }

  copy(source, recursive = true) {
    if (recursive) {
      this.remove(this.helper);
    }

    super.copy(source, recursive);

    if (recursive) {
      const helperIndex = source.children.findIndex(child => child === source.helper);

      if (helperIndex !== -1) {
        this.helper = this.children[helperIndex];
      }
    }

    return this;
  }

  serialize() {
    return super.serialize({
      "spawn-point": {}
    });
  }

  prepareForExport() {
    super.prepareForExport();
    this.remove(this.helper);
    this.addGLTFComponent("spawn-point", {});
  }
}
