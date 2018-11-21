/**
 * @author mrdoob / http://mrdoob.com/
 * @author Mugen87 / https://github.com/Mugen87
 */

THREE.PointerLockControls = function ( camera, domElement, standardClickSetup = true ) {

	this.domElement = domElement || document.body;
	this.isLocked = false;

	var scalingX = 4 / window.innerWidth;
	var scalingY = scalingX;
	
	var scope = this;

	this.movementScaling = function(xToRadians, optionalY = null) {
		if (!optionalY)
			optionalY = xToRadians;
		this.scalingX = xToRadians;
		this.scalingY = optionalY;
	}
	
	function onMouseMove( event ) {
		
		if ( scope.isLocked === false ) return;

		var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
		var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

		camera.rotateOnWorldAxis(new THREE.Vector3(0,1,0), -movementX * scalingX);
		camera.rotateX(-movementY * scalingY);
	}

	function onKeyDown( event ) {
		scope.dispatchEvent( event );
	}
	function onKeyUp( event ) {
		scope.dispatchEvent( event );
	}

	function onPointerlockChange() {

		if ( document.pointerLockElement === scope.domElement ) {
			scope.dispatchEvent( { type: 'lock' } );
			scope.isLocked = true;

		} else {
			scope.dispatchEvent( { type: 'unlock' } );
			scope.isLocked = false;
		}

	}

	function onPointerlockError() {
		console.error( 'THREE.PointerLockControls: Unable to use Pointer Lock API' );
	}

	var onClickLock;

	this.connect = function () {
		document.addEventListener( 'mousemove', onMouseMove, false );
		document.addEventListener( 'pointerlockchange', onPointerlockChange, false );
		document.addEventListener( 'pointerlockerror', onPointerlockError, false );
		document.addEventListener( 'keydown', onKeyDown, false );
		document.addEventListener( 'keyup', onKeyUp, false );

		if (standardClickSetup)
			this.domElement.addEventListener( 'click', onClickLock, false );	
	};

	this.disconnect = function () {
		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'pointerlockchange', onPointerlockChange, false );
		document.removeEventListener( 'pointerlockerror', onPointerlockError, false );
		document.removeEventListener( 'keydown', onKeyDown, false );
		document.removeEventListener( 'keyup', onKeyUp, false );
		if (standardClickSetup)
			document.removeEventListener( 'click', onClickLock, false );
	};

	this.dispose = function () {
		this.disconnect();
	};

	this.getObject = function () {
		return camera;
	};

	this.getDirection = function () {
		var v = new THREE.Vector3();
		camera.getWorldDirection(v);
		return v;

	}();

	this.lock = function () {
		this.domElement.requestPointerLock();
	};
	onClickLock = this.lock.bind(this);

	this.unlock = function () {
		document.exitPointerLock();
	};

	this.connect();
};

THREE.PointerLockControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.PointerLockControls.prototype.constructor = THREE.PointerLockControls;
