THREE.FirstPersonControls = function (controls) {
	var moveForward = false;
	var moveBackward = false;
	var moveLeft = false;
	var moveRight = false;
	var moveUp = false;
	var moveDown = false;
	var moveSlow = false;
	var moveSteady = false;
	
	this.baseVelocity = 64;
	this.relativeVelocity = 1;
	this.velocity = new THREE.Vector3();

	var keyHandler = function ( event, value ) {

		switch ( event.keyCode ) {

			case 38: // up
			case 87: // w
				moveForward = value
				break;

			case 37: // left
			case 65: // a
				moveLeft = value;
				break;

			case 40: // down
			case 83: // s
				moveBackward = value;
				break;

			case 39: // right
			case 68: // d
				moveRight = value;
				break;

			case 32: // space
				moveUp = value;
				break;
			case 81: // Q
				moveDown = value;
				break;

			case 0x10: // Shift
				moveSlow = value;
				break;
			case 60: // Less
				moveSteady = value;
				break;
				
			case 80: // P
				if (value) {
					document.getElementById( 'print-output' ).innerHTML = JSON.stringify( camera.toJSON() );
				}
				break;
		}

	};
	var onKeyDown = function ( event ) {
		return keyHandler(event, true);
	};
	var onKeyUp = function ( event ) {
		return keyHandler(event, false);
	};
	controls.addEventListener( 'keydown', onKeyDown );
	controls.addEventListener( 'keyup', onKeyUp );
	
	this.update = function(delta) {
		this.velocity.x = Number( moveRight ) - Number( moveLeft );
		this.velocity.y = Number( moveUp ) - Number( moveDown );
		this.velocity.z = Number( moveBackward ) - Number( moveForward );
		
		if (moveSlow) {
			this.relativeVelocity *= Math.pow(.2, delta);
		} else if (!moveSteady) {
			if (this.relativeVelocity < 1)
				this.relativeVelocity *= Math.pow(4, delta);
			else
				this.relativeVelocity = 1;
		}
		this.velocity.multiplyScalar(this.relativeVelocity * this.baseVelocity);
		
		controls.getObject().translateOnAxis(this.velocity, delta);
	}
	
	this.getObject = function () {
		return controls.getObject();
	};
}

THREE.FirstPersonControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.FirstPersonControls.prototype.constructor = THREE.FirstPersonControls;
