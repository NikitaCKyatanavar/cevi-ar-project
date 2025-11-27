/* components.js
   Implements:
   - ring-manager system for busy/focused state
   - ring-focus component: click to focus, animate toward camera, scale, and return exactly to original slot
   - drag-rotate component: cumulative Y-axis-only rotation; proportional to drag distance
   All animations use easing (non-linear). No external interaction libraries used.
*/

AFRAME.registerSystem('ring-manager', {
  init: function () {
    this.busy = false;       // true while any ring is animating or focused
    this.focusedEl = null;   // currently focused element
  },
  setBusy: function (v) { this.busy = !!v; },
  isBusy: function () { return this.busy; },
  setFocused: function (el) { this.focusedEl = el; },
  getFocused: function () { return this.focusedEl; },
  clearFocused: function () { this.focusedEl = null; }
});

/* ring-focus component:
   - Stores original position, scale, rotation
   - On click: if manager not busy -> animate to a target in front of camera, scale up, and set focused
   - When close event fired: animate back to original transform exactly, reset rotation to original
   - Prevents other rings from being clicked while animating or focused
*/
AFRAME.registerComponent('ring-focus', {
  init: function () {
    this.manager = this.el.sceneEl.systems['ring-manager'];
    this.originalPos = this.el.object3D.position.clone();
    this.originalScale = this.el.object3D.scale.clone();
    this.originalRot = this.el.object3D.rotation.clone();

    this.isFocused = false;
    this.isAnimating = false;

    this.onClick = this.onClick.bind(this);
    this.onClose = this.onClose.bind(this);

    // Listen for clicks/taps on this entity
    this.el.addEventListener('click', this.onClick);
    // Listen for global close event from UI
    window.addEventListener('close-focused-ring', this.onClose);
  },

  onClick: function (evt) {
    // If busy or this already focused/animating, ignore
    if (this.manager.isBusy()) return;
    if (this.isFocused || this.isAnimating) return;

    // Set busy lock
    this.manager.setBusy(true);
    this.isAnimating = true;
    this.manager.setFocused(this.el);

    // Compute target position: in front of camera with a small offset
    const cameraEl = this.el.sceneEl.querySelector('[camera]');
    const camPos = new THREE.Vector3();
    cameraEl.object3D.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    cameraEl.object3D.getWorldDirection(camDir);

    const target = camPos.clone().add(camDir.multiplyScalar(1.6)); // distance in front
    // ensure a little above center
    target.y = Math.max(target.y, this.originalPos.y + 1.2);

    const startPos = this.el.object3D.position.clone();
    const startScale = this.el.object3D.scale.clone();
    const targetScale = startScale.clone().multiplyScalar(1.45);

    const duration = 600; // ms
    const t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic

    const animate = (time) => {
      const t = Math.min(1, (time - t0) / duration);
      const e = ease(t);
      // lerp position & scale
      this.el.object3D.position.lerpVectors(startPos, target, e);
      this.el.object3D.scale.lerpVectors(startScale, targetScale, e);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.isFocused = true;
        this.manager.setBusy(false);
        window.dispatchEvent(new Event('show-close-button'));
      }
    };
    requestAnimationFrame(animate);

    // prevent click event from propagating to scene background
    if (evt && evt.stopPropagation) evt.stopPropagation();
  },

  onClose: function (evt) {
    // Only respond if this element is the focused one
    if (!this.isFocused) return;
    if (this.manager.isBusy()) return;

    this.manager.setBusy(true);
    this.isAnimating = true;

    const startPos = this.el.object3D.position.clone();
    const endPos = this.originalPos.clone();

    const startScale = this.el.object3D.scale.clone();
    const endScale = this.originalScale.clone();

    const startRot = this.el.object3D.rotation.clone();
    const endRot = this.originalRot.clone();

    const duration = 600;
    const t0 = performance.now();
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic

    const animateBack = (time) => {
      const t = Math.min(1, (time - t0) / duration);
      const e = ease(t);
      this.el.object3D.position.lerpVectors(startPos, endPos, e);
      this.el.object3D.scale.lerpVectors(startScale, endScale, e);
      // lerp Euler rotation components (keeps orientation consistent)
      this.el.object3D.rotation.x = THREE.MathUtils.lerp(startRot.x, endRot.x, e);
      this.el.object3D.rotation.y = THREE.MathUtils.lerp(startRot.y, endRot.y, e);
      this.el.object3D.rotation.z = THREE.MathUtils.lerp(startRot.z, endRot.z, e);

      if (t < 1) requestAnimationFrame(animateBack);
      else {
        // Reset state
        this.isAnimating = false;
        this.isFocused = false;
        this.manager.setBusy(false);
        this.manager.clearFocused();
        window.dispatchEvent(new Event('hide-close-button'));
      }
    };
    requestAnimationFrame(animateBack);

    // stop propagation so clicking close button won't click background
    if (evt && evt.stopPropagation) evt.stopPropagation();
  },

  remove: function () {
    this.el.removeEventListener('click', this.onClick);
    window.removeEventListener('close-focused-ring', this.onClose);
  }
});

/* drag-rotate component:
   - Y-axis only
   - cumulative rotation persisted between drags
   - rotation speed proportional to drag distance (sensitivity adjustable)
   - works with mouse and touch
*/
AFRAME.registerComponent('drag-rotate', {
  schema: { sensitivity: { type: 'number', default: 0.012 } },

  init: function () {
    this.dragging = false;
    this.startX = 0;
    this.startYaw = this.el.object3D.rotation.y;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.el.addEventListener('mousedown', this.onPointerDown);
    this.el.addEventListener('touchstart', this.onPointerDown, { passive: true });
    window.addEventListener('mouseup', this.onPointerUp);
    window.addEventListener('touchend', this.onPointerUp);
  },

  onPointerDown: function (evt) {
    // Prevent starting drag if an animation is running
    if (this.el.sceneEl.systems['ring-manager'].isBusy()) return;

    this.dragging = true;
    this.startX = (evt.touches && evt.touches[0]) ? evt.touches[0].clientX : evt.clientX;
    this.startYaw = this.el.object3D.rotation.y;

    // prevent the event from causing a click on the scene
    if (evt.stopPropagation) evt.stopPropagation();
  },

  onPointerMove: function (evt) {
    if (!this.dragging) return;
    const clientX = (evt.touches && evt.touches[0]) ? evt.touches[0].clientX : evt.clientX;
    const dx = clientX - this.startX;
    // cumulative rotation: add delta to startYaw
    this.el.object3D.rotation.y = this.startYaw + dx * this.data.sensitivity;
  },

  onPointerUp: function () {
    this.dragging = false;
  },

  tick: function () {
    // Attach move listeners during a drag to support smooth dragging
    if (this.dragging && !this._attached) {
      window.addEventListener('mousemove', this.onPointerMove);
      window.addEventListener('touchmove', this.onPointerMove, { passive: true });
      this._attached = true;
    } else if (!this.dragging && this._attached) {
      window.removeEventListener('mousemove', this.onPointerMove);
      window.removeEventListener('touchmove', this.onPointerMove);
      this._attached = false;
    }
  },

  remove: function () {
    this.el.removeEventListener('mousedown', this.onPointerDown);
    this.el.removeEventListener('touchstart', this.onPointerDown);
    window.removeEventListener('mouseup', this.onPointerUp);
    window.removeEventListener('touchend', this.onPointerUp);
    if (this._attached) {
      window.removeEventListener('mousemove', this.onPointerMove);
      window.removeEventListener('touchmove', this.onPointerMove);
    }
  }
});
