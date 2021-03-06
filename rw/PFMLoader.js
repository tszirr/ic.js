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
	
	function decode_utf8( uintBuffer, offset, endOffset ) {
		if (typeof TextDecoder !== 'undefined')
			return new TextDecoder().decode(
				uintBuffer.slice( offset, endOffset )
			)
		else {
			var cs = uintBuffer.subarray( offset, endOffset ).values();
			cs = String.fromCharCode(cs);
			cs = escape(cs);
			return decodeURIComponent();
		}
	}
	function parseString( uintBuffer, cursor ) {
		var endOffset = cursor.value;
		while ( uintBuffer[ endOffset ] > 32 ) {
			endOffset++;
		}
		var stringValue = decode_utf8( uintBuffer, cursor.value, endOffset );
		cursor.value = endOffset + 1;
		return stringValue;
	}
	var headerString = parseString( charBuffer, cursor );

	var channelCount;
	var floatFormat = true;
	if (headerString == 'PF')
		channelCount = 3;
	else if (headerString == 'Pf')
		channelCount = 1;
	else if (headerString == 'P6') {
		channelCount = 3;
		floatFormat = false;
	} else if (headerString == 'P5') {
		channelCount = 1;
		floatFormat = false;
	} else
		throw 'Invalid PFM header string: ' + headerString;

	var pfmHeader = { channels: channelCount };

	pfmHeader.width = Number( parseString( charBuffer, cursor ) );
	pfmHeader.height = Number( parseString( charBuffer, cursor ) );

	var dataBytes, dataType;
	
	if (floatFormat) {	
		var ratio = Number( parseString( charBuffer, cursor ) );
		if (ratio >= 0)
			throw 'Big endian PFM not currently supported';
		pfmHeader.scale = Math.abs(ratio);

		try {
			dataBytes = new Float32Array( buffer, cursor.value );
		}
		catch(err) {
			// in case unaligned access is forbidden ...
			dataBytes = new Float32Array( buffer.slice(cursor.value), 0 );
		}
		dataType = THREE.FloatType;
	} else {
		pfmHeader.scale = 1;
		pfmHeader.maxVal = Number( parseString( charBuffer, cursor ) );

		dataBytes = new Uint8Array( buffer, cursor.value );
		dataType = pfmHeader.maxVal < 256 ? THREE.UnsignedByteType : THREE.UnsignedShortType;
	}

	return {
		header: pfmHeader,
		width: pfmHeader.width,
		height: pfmHeader.height,
		data: dataBytes,
		format: channelCount == 3 ? THREE.RGBFormat : THREE.LuminanceFormat,
		type: dataType
	};
};

THREE.PFMLoader.prototype.serializeRGBtoPF = function ( image, rgbData ) {
	function encode_utf8(s) {
		if (typeof TextEncoder !== 'undefined')
			return new TextEncoder().encode(s);
		else {
			var chars = unescape(encodeURIComponent(s));
			var buf = new Uint8Array(chars.length);
			for (var i = 0; i < chars.length; i++) {
				buf[i] = chars.charCodeAt(i);
			}
			return buf;
		}
	}

	var headerString = "PF\n" + image.width + ' ' + image.height + "\n-1.0\n";
	var headerBytes = encode_utf8(headerString);

	var rgbElementCount = 3 * image.width * image.height;

	if (rgbData.length == 4 * image.width * image.height && rgbData instanceof Float32Array) {
		var rgbaData = rgbData;
		rgbData = new Float32Array(rgbElementCount);
		for (var i = 0, j = 0; j < rgbElementCount; i+=4, j+=3) {
			rgbData[j] = rgbaData[i];
			rgbData[j+1] = rgbaData[i+1];
			rgbData[j+2] = rgbaData[i+2];
		}
	}

	if (rgbData.byteLength != 4 * rgbElementCount)
		throw 'Invalid PF data encoding, must be 3-channel 32 bit rgb floating-point data'

	return new Blob([headerBytes, rgbData]);
}
