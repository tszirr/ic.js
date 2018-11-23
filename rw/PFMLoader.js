/**
 * PFM Loader
 */

THREE.PFMLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.PFMLoader.prototype = Object.create( THREE.DataTextureLoader.prototype );

THREE.PFMLoader.prototype._parser = function ( buffer ) {

	var charBuffer = new Uint8Array( buffer );
	var cursor = { value: 0 };

	function parseString( uintBuffer, cursor ) {
		var endOffset = cursor.value;
		while ( uintBuffer[ endOffset ] > 32 ) {
			endOffset++;
		}
		var stringValue = new TextDecoder().decode(
			uintBuffer.slice( cursor.value, endOffset )
		);
		cursor.value = endOffset + 1;
		return stringValue;
	}
	var headerString = parseString( charBuffer, cursor );

	var channelCount;
	if (headerString == 'PF')
		channelCount = 3;
	else if (headerString == 'Pf')
		channelCount = 1;
	else
		throw 'Invalid PFM header string: ' + headerString;

	var pfmHeader = { channels: channelCount };

	pfmHeader.width = Number( parseString( charBuffer, cursor ) );
	pfmHeader.height = Number( parseString( charBuffer, cursor ) );
	var ratio = Number( parseString( charBuffer, cursor ) );

	if (ratio >= 0)
		throw 'Big endian PFM not currently supported';
	pfmHeader.scale = Math.abs(ratio);

	var floatBuffer = new Float32Array( buffer, cursor.value );

	return {
		header: pfmHeader,
		width: pfmHeader.width,
		height: pfmHeader.height,
		data: floatBuffer,
		format: channelCount == 3 ? THREE.RGBFormat : THREE.LuminanceFormat,
		type: THREE.FloatType
	};
};
