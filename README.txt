Jewellery Box — A-Frame Assessment
==================================

What's included
---------------
- index.html : Main A-Frame scene
- components.js : All custom ECS-style components and a simple ring-manager system
- README.txt : This file

How it meets the assessment requirements
---------------------------------------
1. Visual fidelity:
   - Materials use metalness & roughness to simulate metallic rings.
   - Multiple lights + environment component improve reflections (requires internet to fetch env).
2. Initial state:
   - All rings sit stationary inside a box at load.
3. Focus Interaction:
   - Click a ring to animate it toward the camera and scale up.
   - A DOM 'Close' button appears (top-right) to return ring.
4. Return Interaction:
   - Close button animates ring back to its original position, rotation and scale.
5. State Management:
   - ring-manager system exposes busy flag; when busy, other clicks are ignored.
6. Advanced interactions:
   - drag-rotate component implements Y-axis-only, cumulative rotation proportional to drag.

How to run locally
------------------
1. Unzip the project.
2. Open index.html in a modern browser (Chrome/Edge/Firefox).
3. For best visual fidelity, run with internet access so the environment component can load remote assets.

Notes & future improvements
---------------------------
- Replace torus primitives with optimized glTF ring models for production; store them in /assets and change entities to <a-gltf-model>.
- For higher-fidelity PBR reflections, add an HDRI environment map and use aframe-extras or a custom shader.
- Add AR/3D model licensing and optimized textures.

If you want, I can:
- Replace torus rings with three glb models (you must provide the .glb files or allow me to fetch public models).
- Generate a ZIP with sample glb files included (if you permit me to fetch them).

Good luck! — Nikita, you can submit this project as your assessment.
