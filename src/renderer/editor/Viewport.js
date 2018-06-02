import THREE from "../vendor/three";
import SetPositionCommand from "./commands/SetPositionCommand";
import SetRotationCommand from "./commands/SetRotationCommand";
import SetScaleCommand from "./commands/SetScaleCommand";

/**
 * @author mrdoob / http://mrdoob.com/
 */

export default class Viewport {
  constructor(editor) {
    const signals = editor.signals;

    //

    let renderer = null;

    const canvas = editor.canvas;
    const camera = editor.camera;
    const scene = editor.scene;
    const sceneHelpers = editor.sceneHelpers;

    const objects = [];

    // helpers

    const grid = new THREE.GridHelper(30, 30, 0x444444, 0x888888);
    sceneHelpers.add(grid);

    const array = grid.geometry.attributes.color.array;

    for (let i = 0; i < array.length; i += 60) {
      for (let j = 0; j < 12; j++) {
        array[i + j] = 0.26;
      }
    }

    //

    const box = new THREE.Box3();

    const selectionBox = new THREE.BoxHelper();
    selectionBox.material.depthTest = false;
    selectionBox.material.transparent = true;
    selectionBox.visible = false;
    sceneHelpers.add(selectionBox);

    let objectPositionOnDown = null;
    let objectRotationOnDown = null;
    let objectScaleOnDown = null;

    function render() {
      sceneHelpers.updateMatrixWorld();
      scene.updateMatrixWorld();

      renderer.render(scene, camera);
      renderer.render(sceneHelpers, camera);
    }

    const transformControls = new THREE.TransformControls(camera, canvas);
    transformControls.addEventListener("change", function() {
      const object = transformControls.object;

      if (object !== undefined) {
        selectionBox.setFromObject(object);

        if (editor.helpers[object.id] !== undefined) {
          editor.helpers[object.id].update();
        }

        signals.refreshSidebarObject3D.dispatch(object);
      }

      render();
    });

    sceneHelpers.add(transformControls);

    // object picking

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // events

    function getIntersects(point, objects) {
      mouse.set(point.x * 2 - 1, -(point.y * 2) + 1);

      raycaster.setFromCamera(mouse, camera);

      return raycaster.intersectObjects(objects);
    }

    const onDownPosition = new THREE.Vector2();
    const onUpPosition = new THREE.Vector2();
    const onDoubleClickPosition = new THREE.Vector2();

    function getMousePosition(dom, x, y) {
      const rect = dom.getBoundingClientRect();
      return [(x - rect.left) / rect.width, (y - rect.top) / rect.height];
    }

    function handleClick() {
      if (onDownPosition.distanceTo(onUpPosition) === 0) {
        const intersects = getIntersects(onUpPosition, objects);

        if (intersects.length > 0) {
          const object = intersects[0].object;

          if (object.userData.object !== undefined) {
            // helper

            editor.select(object.userData.object);
          } else {
            editor.select(object);
          }
        } else {
          editor.select(null);
        }

        render();
      }
    }

    function onMouseUp(event) {
      const array = getMousePosition(canvas, event.clientX, event.clientY);
      onUpPosition.fromArray(array);

      handleClick();

      document.removeEventListener("mouseup", onMouseUp, false);
    }

    function onMouseDown(event) {
      event.preventDefault();

      const array = getMousePosition(canvas, event.clientX, event.clientY);
      onDownPosition.fromArray(array);

      document.addEventListener("mouseup", onMouseUp, false);
    }

    function onTouchEnd(event) {
      const touch = event.changedTouches[0];

      const array = getMousePosition(canvas, touch.clientX, touch.clientY);
      onUpPosition.fromArray(array);

      handleClick();

      document.removeEventListener("touchend", onTouchEnd, false);
    }

    function onTouchStart(event) {
      const touch = event.changedTouches[0];

      const array = getMousePosition(canvas, touch.clientX, touch.clientY);
      onDownPosition.fromArray(array);

      document.addEventListener("touchend", onTouchEnd, false);
    }

    function onDoubleClick(event) {
      const array = getMousePosition(canvas, event.clientX, event.clientY);
      onDoubleClickPosition.fromArray(array);

      const intersects = getIntersects(onDoubleClickPosition, objects);

      if (intersects.length > 0) {
        const intersect = intersects[0];

        signals.objectFocused.dispatch(intersect.object);
      }
    }

    canvas.addEventListener("mousedown", onMouseDown, false);
    canvas.addEventListener("touchstart", onTouchStart, false);
    canvas.addEventListener("dblclick", onDoubleClick, false);

    // controls need to be added *after* main logic,
    // otherwise controls.enabled doesn't work.

    const controls = new THREE.EditorControls(camera, canvas);
    controls.addEventListener("change", function() {
      transformControls.update();
      signals.cameraChanged.dispatch(camera);
    });

    transformControls.addEventListener("mouseDown", function() {
      const object = transformControls.object;

      objectPositionOnDown = object.position.clone();
      objectRotationOnDown = object.rotation.clone();
      objectScaleOnDown = object.scale.clone();

      controls.enabled = false;
    });
    transformControls.addEventListener("mouseUp", function() {
      const object = transformControls.object;

      if (object !== undefined) {
        switch (transformControls.getMode()) {
          case "translate":
            if (!objectPositionOnDown.equals(object.position)) {
              editor.execute(new SetPositionCommand(object, object.position, objectPositionOnDown));
            }

            break;

          case "rotate":
            if (!objectRotationOnDown.equals(object.rotation)) {
              editor.execute(new SetRotationCommand(object, object.rotation, objectRotationOnDown));
            }

            break;

          case "scale":
            if (!objectScaleOnDown.equals(object.scale)) {
              editor.execute(new SetScaleCommand(object, object.scale, objectScaleOnDown));
            }

            break;
        }
      }

      controls.enabled = true;
    });

    // signals

    signals.editorCleared.add(function() {
      controls.center.set(0, 0, 0);
      render();
    });

    signals.transformModeChanged.add(function(mode) {
      transformControls.setMode(mode);
    });

    signals.snapChanged.add(function(dist) {
      transformControls.setTranslationSnap(dist);
    });

    signals.spaceChanged.add(function(space) {
      transformControls.setSpace(space);
    });

    signals.rendererChanged.add(function(newRenderer) {
      renderer = newRenderer;

      renderer.autoClear = false;
      renderer.autoUpdateScene = false;
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);

      render();
    });

    signals.sceneGraphChanged.add(function() {
      render();
    });

    signals.cameraChanged.add(function() {
      render();
    });

    signals.objectSelected.add(function(object) {
      selectionBox.visible = false;
      transformControls.detach();

      if (object !== null && object !== scene && object !== camera) {
        box.setFromObject(object);

        if (box.isEmpty() === false) {
          selectionBox.setFromObject(object);
          selectionBox.visible = true;
        }

        transformControls.attach(object);
      }

      render();
    });

    signals.objectFocused.add(function(object) {
      controls.focus(object);
    });

    signals.geometryChanged.add(function(object) {
      if (object !== undefined) {
        selectionBox.setFromObject(object);
      }

      render();
    });

    signals.objectAdded.add(function(object) {
      object.traverse(function(child) {
        objects.push(child);
      });
    });

    signals.objectChanged.add(function(object) {
      if (editor.selected === object) {
        selectionBox.setFromObject(object);
        transformControls.update();
      }

      if (object instanceof THREE.PerspectiveCamera) {
        object.updateProjectionMatrix();
      }

      if (editor.helpers[object.id] !== undefined) {
        editor.helpers[object.id].update();
      }

      render();
    });

    signals.objectRemoved.add(function(object) {
      object.traverse(function(child) {
        objects.splice(objects.indexOf(child), 1);
      });
    });

    signals.helperAdded.add(function(object) {
      objects.push(object.getObjectByName("picker"));
    });

    signals.helperRemoved.add(function(object) {
      objects.splice(objects.indexOf(object.getObjectByName("picker")), 1);
    });

    signals.materialChanged.add(function() {
      render();
    });

    // fog

    signals.sceneBackgroundChanged.add(function(backgroundColor) {
      scene.background.setHex(backgroundColor);

      render();
    });

    let currentFogType = null;

    signals.sceneFogChanged.add(function(fogType, fogColor, fogNear, fogFar, fogDensity) {
      if (currentFogType !== fogType) {
        switch (fogType) {
          case "None":
            scene.fog = null;
            break;
          case "Fog":
            scene.fog = new THREE.Fog();
            break;
          case "FogExp2":
            scene.fog = new THREE.FogExp2();
            break;
        }

        currentFogType = fogType;
      }

      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.setHex(fogColor);
        scene.fog.near = fogNear;
        scene.fog.far = fogFar;
      } else if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setHex(fogColor);
        scene.fog.density = fogDensity;
      }

      render();
    });

    //

    signals.windowResize.add(function() {
      // TODO: Move this out?

      editor.DEFAULT_CAMERA.aspect = canvas.parentElement.offsetWidth / canvas.parentElement.offsetHeight;
      editor.DEFAULT_CAMERA.updateProjectionMatrix();

      camera.aspect = canvas.parentElement.offsetWidth / canvas.parentElement.offsetHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(canvas.parentElement.offsetWidth, canvas.parentElement.offsetHeight);

      render();
    });

    signals.showGridChanged.add(function(showGrid) {
      grid.visible = showGrid;
      render();
    });
  }
}
