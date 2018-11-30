/**
 * @author Richard M. / https://github.com/richardmonette
 * This version contains some additional modifications, adding ZIP decoding,
 * full-precision FLOATs and basic EXR writing.
 * Also, PIZ decoding conformance and performance have been improved.
 * @author Tobias Z. / https://github.com/tszirr/ic.js
 *
 * OpenEXR loader which, currently, supports reading 16-bit half and 32-bit float
 * data, in either uncompressed, PIZ-wavelet-compressed, or ZIP-compressed form.
 * Also, basic uncompressed FLOAT image writing is supported.
 *
 * Referred to the original Industrial Light & Magic OpenEXR implementation and the
 * TinyEXR / Syoyo Fujita implementation, so I have preserved their copyright notices:
 */

// /*
// Copyright (c) 2014 - 2017, Syoyo Fujita
// All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the Syoyo Fujita nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// */

// // TinyEXR contains some OpenEXR code, which is licensed under ------------

// ///////////////////////////////////////////////////////////////////////////
// //
// // Copyright (c) 2002, Industrial Light & Magic, a division of Lucas
// // Digital Ltd. LLC
// //
// // All rights reserved.
// //
// // Redistribution and use in source and binary forms, with or without
// // modification, are permitted provided that the following conditions are
// // met:
// // *       Redistributions of source code must retain the above copyright
// // notice, this list of conditions and the following disclaimer.
// // *       Redistributions in binary form must reproduce the above
// // copyright notice, this list of conditions and the following disclaimer
// // in the documentation and/or other materials provided with the
// // distribution.
// // *       Neither the name of Industrial Light & Magic nor the names of
// // its contributors may be used to endorse or promote products derived
// // from this software without specific prior written permission.
// //
// // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// // "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// // LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// // A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// // OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// // SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// // LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// // DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// // THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// // (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// // OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// //
// ///////////////////////////////////////////////////////////////////////////

// // End of OpenEXR license -------------------------------------------------

THREE.EXRLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
	this.totalDecodingTime = 0;

};

THREE.EXRLoader.prototype = Object.create( THREE.DataTextureLoader.prototype );

THREE.EXRLoader.prototype._parser = function ( buffer ) {

	const BYTES_PER_HALF = 2;

	const ULONG_SIZE = 8;
	const FLOAT32_SIZE = 4;
	const INT32_SIZE = 4;
	const INT16_SIZE = 2;
	const INT8_SIZE = 1;

	function decode_utf8( uintBuffer, offset, endOffset ) {
		if (TextDecoder)
			return new TextDecoder().decode(
				uintBuffer.slice( offset, endOffset )
			)
		else
			return decodeURIComponent(escape(String.fromCharCode( uintBuffer.subarray( offset, endOffset ).values() )));
	}

	function parseNullTerminatedString( buffer, offset ) {

		var uintBuffer = new Uint8Array( buffer );
		var endOffset = 0;

		while ( uintBuffer[ offset.value + endOffset ] != 0 ) {
			endOffset += 1;
		}

		var stringValue = decode_utf8( uintBuffer, offset.value, offset.value + endOffset );

		offset.value = offset.value + endOffset + 1;

		return stringValue;

	}

	function parseFixedLengthString( buffer, offset, size ) {

		var stringValue = decode_utf8( new Uint8Array( buffer ), offset.value, offset.value + size );

		offset.value = offset.value + size;

		return stringValue;

	}

	function parseUlong( dataView, offset ) {

		var uLong = dataView.getUint32(offset.value, true);

		offset.value = offset.value + ULONG_SIZE;

		return uLong;

	}

	function parseUint32( dataView, offset ) {

		var Uint32 = dataView.getUint32(offset.value, true);

		offset.value = offset.value + INT32_SIZE;

		return Uint32;

	}

	function parseUint8( dataView, offset ) {

		var Uint8 = dataView.getUint8(offset.value);

		offset.value = offset.value + INT8_SIZE;

		return Uint8;

	}

	function parseFloat32( dataView, offset ) {

		var float = dataView.getFloat32(offset.value, true);

		offset.value += FLOAT32_SIZE;

		return float;

	}

	// https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
	function decodeFloat16( binary ) {

		var exponent = ( binary & 0x7C00 ) >>> 10,
			fraction = ( binary & 0x03FF ) >>> 0;

		return ( binary >>> 15 ? - 1 : 1 ) * (
			exponent ?
				(
					exponent === 0x1F ?
						fraction ? NaN : Infinity :
						Math.pow( 2, exponent - 15 ) * ( 1 + fraction / 0x400 )
				) :
				6.103515625e-5 * ( fraction / 0x400 )
		);

	}

	function parseChlist( dataView, buffer, offset, size ) {

		var startOffset = offset.value;
		var channels = [];

		while ( offset.value < ( startOffset + size - 1 ) ) {

			var name = parseNullTerminatedString( buffer, offset );
			var pixelType = parseUint32( dataView, offset ); // TODO: Cast this to UINT, HALF or FLOAT
			var pLinear = parseUint8( dataView, offset );
			offset.value += 3; // reserved, three chars
			var xSampling = parseUint32( dataView, offset );
			var ySampling = parseUint32( dataView, offset );

			channels.push( {
				name: name,
				pixelType: pixelType,
				pLinear: pLinear,
				xSampling: xSampling,
				ySampling: ySampling
			} );

		}

		offset.value += 1;

		return channels;

	}

	function parseChromaticities( dataView, offset ) {

		var redX = parseFloat32( dataView, offset );
		var redY = parseFloat32( dataView, offset );
		var greenX = parseFloat32( dataView, offset );
		var greenY = parseFloat32( dataView, offset );
		var blueX = parseFloat32( dataView, offset );
		var blueY = parseFloat32( dataView, offset );
		var whiteX = parseFloat32( dataView, offset );
		var whiteY = parseFloat32( dataView, offset );

		return { redX: redX, redY: redY, greenX: greenX, greenY: greenY, blueX: blueX, blueY: blueY, whiteX: whiteX, whiteY: whiteY };

	}

	function parseCompression( dataView, offset ) {

		var compressionCodes = [
			'NO_COMPRESSION',
			'RLE_COMPRESSION',
			'ZIPS_COMPRESSION',
			'ZIP_COMPRESSION',
			'PIZ_COMPRESSION',
			'PXR24_COMPRESSION',
			'B44_COMPRESSION',
			'B44A_COMPRESSION',
			'DWAA_COMPRESSION',
			'DWAB_COMPRESSION'
		];

		var compression = parseUint8( dataView, offset );

		return compressionCodes[ compression ];

	}

	function parseBox2i( dataView, offset ) {

		var xMin = parseUint32( dataView, offset );
		var yMin = parseUint32( dataView, offset );
		var xMax = parseUint32( dataView, offset );
		var yMax = parseUint32( dataView, offset );

		return { xMin: xMin, yMin: yMin, xMax: xMax, yMax: yMax };

	}

	function parseLineOrder( dataView, offset ) {

		var lineOrders = [
			'INCREASING_Y',
			'DECREASING_Y'
		];

		var lineOrder = parseUint8( dataView, offset );

		return lineOrders[ lineOrder ];

	}

	function parseV2f( dataView, offset ) {

		var x = parseFloat32( dataView, offset );
		var y = parseFloat32( dataView, offset );

		return [ x, y ];

	}

	function parseValue( dataView, buffer, offset, type, size ) {

		if ( type === 'string' || type === 'iccProfile' ) {

			return parseFixedLengthString( buffer, offset, size );

		} else if ( type === 'chlist' ) {

			return parseChlist( dataView, buffer, offset, size );

		} else if ( type === 'chromaticities' ) {

			return parseChromaticities( dataView, offset );

		} else if ( type === 'compression' ) {

			return parseCompression( dataView, offset );

		} else if ( type === 'box2i' ) {

			return parseBox2i( dataView, offset );

		} else if ( type === 'lineOrder' ) {

			return parseLineOrder( dataView, offset );

		} else if ( type === 'float' ) {

			return parseFloat32( dataView, offset );

		} else if ( type === 'v2f' ) {

			return parseV2f( dataView, offset );

		} else if ( type === 'int' ) {

			return parseUint32( dataView, offset );

		} else {

			throw 'Cannot parse value for unsupported type: ' + type;

		}

	}

	var bufferDataView = new DataView(buffer);

	var EXRHeader = { headerSource: 'exr' };

	var magic = bufferDataView.getUint32( 0, true );
	var versionByteZero = bufferDataView.getUint8( 4, true );
	var fullMask = bufferDataView.getUint8( 5, true );

	if (magic != 0x01312F76)
		throw 'Not an EXR file, wrong magic number: ' + magic;

	// start of header

	var offset = { value: 8 }; // start at 8, after magic stuff

	var keepReading = true;

	while ( keepReading ) {

		var attributeName = parseNullTerminatedString( buffer, offset );

		if ( attributeName == 0 ) {

			keepReading = false;

		} else {

			var attributeType = parseNullTerminatedString( buffer, offset );
			var attributeSize = parseUint32( bufferDataView, offset );
			var attributeValue = parseValue( bufferDataView, buffer, offset, attributeType, attributeSize );

			EXRHeader[ attributeName ] = attributeValue;

		}

	}

	// offsets

	var dataWindowHeight = EXRHeader.dataWindow.yMax + 1;
	var scanlineBlockSize = 1; // 1 for NO_COMPRESSION

	if ( EXRHeader.compression === 'PIZ_COMPRESSION' ) {
		scanlineBlockSize = 32;
	}
	else if ( EXRHeader.compression === 'ZIP_COMPRESSION' ) {
		scanlineBlockSize = 16;
	}

	var numBlocks = dataWindowHeight / scanlineBlockSize;
	for ( var i = 0; i < numBlocks; i ++ ) {
		var scanlineOffset = parseUlong( bufferDataView, offset );
	}

	// we should be passed the scanline offset table, start reading pixel data

	var width = EXRHeader.dataWindow.xMax - EXRHeader.dataWindow.xMin + 1;
	var height = EXRHeader.dataWindow.yMax - EXRHeader.dataWindow.yMin + 1;
	var numChannels = EXRHeader.channels.length;

	var byteArray = new Float32Array( width * height * numChannels );

	var channelOffsets = {
		R: 0, X: 0,
		G: 1, Y: 1,
		B: 2, Z: 2,
		A: 3
	};
	var channelBytes = 0;
	for ( var ch of EXRHeader.channels ) {
		channelBytes += ch.pixelType * BYTES_PER_HALF;
	}

	var decodeStartTime = performance.now();

	if ( EXRHeader.compression === 'NO_COMPRESSION' ) {

		for ( var y = 0; y < height; y ++ ) {

			var y_scanline = parseUint32( bufferDataView, offset );
			var dataSize = parseUint32( bufferDataView, offset );

			for ( var channelID = 0; channelID < EXRHeader.channels.length; channelID ++ ) {

				var cOff = channelOffsets[ EXRHeader.channels[ channelID ].name ];
				cOff += (EXRHeader.dataWindow.yMax - y_scanline) * width * numChannels;
				var lOff = offset.value;

				if ( EXRHeader.channels[ channelID ].pixelType === 1 ) {
					// HALF
					for ( var x = 0; x < width; x++, lOff += INT16_SIZE ) {
						var val = decodeFloat16( bufferDataView.getUint16(lOff, true) );
						byteArray[ cOff + x * numChannels ] = val;
					}
				} else if ( EXRHeader.channels[ channelID ].pixelType === 2 ) {
					// FLOAT
					for ( var x = 0; x < width; x++, lOff += FLOAT32_SIZE ) {
						var val = bufferDataView.getFloat32(lOff, true);
						byteArray[ cOff + x * numChannels ] = val;
					}
				} else {
					throw 'EXRLoader._parser: unsupported pixelType ' + EXRHeader.channels[ channelID ].pixelType + '. Only pixelType is 1 (HALF) is supported.';
				}

				offset.value = lOff;
			}
		}

	} else if ( EXRHeader.compression === 'PIZ_COMPRESSION' && this.PIZReader ) {

		var pizReader = new this.PIZReader();
		var uInt8Array = new Uint8Array(buffer);

		for ( var scanlineBlockIdx = 0; scanlineBlockIdx < numBlocks; scanlineBlockIdx ++ ) {

			var y_block = parseUint32( bufferDataView, offset );
			var compressedLen = parseUint32( bufferDataView, offset );

			var fractionalBlockSize = Math.min(scanlineBlockSize, EXRHeader.dataWindow.yMax - y_block + 1);
			var uncompressedLen = fractionalBlockSize * width * channelBytes;

			var decodeOffset = { value: offset.value };
			offset.value += compressedLen;

			var tmpBuffer;
			if (compressedLen < uncompressedLen) {
				tmpBuffer = new Uint16Array( scanlineBlockSize * width * EXRHeader.channels.length );
				var tmpOffset = { value: 0 };
				pizReader.decompress( tmpBuffer, tmpOffset, tmpBuffer.byteLength
					, uInt8Array, bufferDataView, decodeOffset, numChannels, EXRHeader.channels
					, width, fractionalBlockSize );
			}
			else
				tmpBuffer = new Uint16Array( uInt8Array.slice(decodeOffset.value, uncompressedLen) );
			
			if (offset.value != decodeOffset.value)
				console.warn('decoder ended at ' + decodeOffset.value + ', should have ended ' + offset.value);

			for ( var y_local = 0; y_local < fractionalBlockSize; y_local++ ) {

				var y_global = EXRHeader.dataWindow.yMax - y_block;
				y_global -= y_local; // todo: what about decreasing Y, inside block?
				if (y_global < 0 || y_global >= height) continue;

				for ( var channelID = 0; channelID < EXRHeader.channels.length; channelID ++ ) {

					var cOff = channelOffsets[ EXRHeader.channels[ channelID ].name ];
					cOff += y_global * width * numChannels;
					var lOff = channelID * fractionalBlockSize * width + y_local * width;

					if ( EXRHeader.channels[ channelID ].pixelType === 1 ) {
						// HALF
						for ( var x = 0; x < width; x++, lOff++ ) {
							var val = decodeFloat16( tmpBuffer[ lOff ] );
							byteArray[ cOff + x * numChannels ] = val;
						}
					} else {
						throw 'EXRLoader._parser: unsupported pixelType ' + EXRHeader.channels[ channelID ].pixelType + '. Only pixelType is 1 (HALF) is supported for PIZ.';
					}
				}
			}
		}

	} else if ( EXRHeader.compression === 'ZIP_COMPRESSION' && pako ) {

		for ( var scanlineBlockIdx = 0; scanlineBlockIdx < numBlocks; scanlineBlockIdx++ ) {

			var y_block = parseUint32( bufferDataView, offset );
			var compressedLen = parseUint32( bufferDataView, offset );

			var fractionalBlockSize = Math.min(scanlineBlockSize, EXRHeader.dataWindow.yMax - y_block + 1);
			var uncompressedLen = fractionalBlockSize * width * channelBytes;

			var blockBuffer;
			if (compressedLen < uncompressedLen)
			{
				var predArray = pako.inflate(new Uint8Array(buffer, offset.value, compressedLen));
				var dataSize = predArray.length;
				var blockBuffer = new Uint8Array(dataSize);
				// OpenEXR predictor
				for (var i = 1; i < dataSize; i++) {
					predArray[i] = predArray[i-1] + predArray[i] - 128;
				}
				var data_split = Math.floor((dataSize + 1) / 2);
				for (var i = 0; 2*i < dataSize; i++)
					blockBuffer[2*i] = predArray[i];
				for (var i = 0; 2*i+1 < dataSize; i++)
					blockBuffer[2*i+1] = predArray[data_split+i];
			}
			else
				blockBuffer = uInt8Array.slice(offset.value, uncompressedLen);
			offset.value += compressedLen;

			for ( var y_local = 0; y_local < scanlineBlockSize; y_local++ ) {

				var y_global = EXRHeader.dataWindow.yMax - y_block;
				y_global -= y_local; // todo: what about decreasing Y, inside block?
				if (y_global < 0 || y_global >= height) continue;

				for ( var channelID = 0; channelID < EXRHeader.channels.length; channelID++ ) {

					var cOff = channelOffsets[ EXRHeader.channels[ channelID ].name ];
					cOff += y_global * width * numChannels;
					var lOff = channelID * width + y_local * width * numChannels;

					if ( EXRHeader.channels[ channelID ].pixelType === 1 ) {
						var halfBuffer = new Uint16Array( blockBuffer.buffer );
						// HALF
						for ( var x = 0; x < width; x++, lOff++ ) {
							var val = decodeFloat16( halfBuffer[ lOff ] );
							byteArray[ cOff + x * numChannels ] = val;
						}
					} else if ( EXRHeader.channels[ channelID ].pixelType === 2 ) {
						var floatBuffer = new Float32Array( blockBuffer.buffer );
						// FLOAT
						for ( var x = 0; x < width; x++, lOff++ ) {
							var val = floatBuffer[ lOff ];
							byteArray[ cOff + x * numChannels ] = val;
						}
					} else {
						throw 'EXRLoader._parser: unsupported pixelType ' + EXRHeader.channels[ channelID ].pixelType + '. Only pixelType is 1 (HALF) and 2 (FLOAT) is supported.';
					}
				}
			}
		}

	} else {

		throw 'EXRLoader._parser: ' + EXRHeader.compression + ' is unsupported';

	}

	var decodeTime = performance.now() - decodeStartTime;
	this.totalDecodingTime += decodeTime;
	console.log('Total time spent decoding: ' + this.totalDecodingTime + ', this time: ' + decodeTime);

	return {
		header: EXRHeader,
		width: width,
		height: height,
		data: byteArray,
		format: EXRHeader.channels.length == 4 ? THREE.RGBAFormat : THREE.RGBFormat,
		type: THREE.FloatType
	};

};

THREE.EXRLoader.prototype.serializeRGBAtoEXR = function ( image, rgbData, refHeader ) {
	var outputBlobs = [];

	var HALF_BYTES = 2;
	var FLOAT_BYTES = 4;
	var UINT_BYTES = 4;
	var ULONG_BYTES = 8;

	function encode_utf8(s) {
		if (TextEncoder)
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

	function writeUint8( dataView, cursor, value ) {
		if (dataView)
			dataView.setUint8( cursor.value, value, true );
		cursor.value += 1;
	}
	function writeUint32( dataView, cursor, value ) {
		if (dataView)
			dataView.setUint32( cursor.value, value, true );
		cursor.value += UINT_BYTES;
	}
	function writeFloat32( dataView, cursor, value ) {
		if (dataView)
			dataView.setFloat32( cursor.value, value, true );
		cursor.value += FLOAT_BYTES;
	}
	function writeNullTerminatedString( buffer, cursor, value ) {
		value = encode_utf8( value );
		if (buffer) {
			var byteBuffer = new Uint8Array( buffer )
			byteBuffer.set( value, cursor.value );
			byteBuffer[cursor.value + value.length] = 0;
		}
		cursor.value += value.length+1;
	}
	
	function writeBoxI( dataView, cursor, value ) {
		writeUint32( dataView, cursor, value.xMin );
		writeUint32( dataView, cursor, value.yMin );
		writeUint32( dataView, cursor, value.xMax );
		writeUint32( dataView, cursor, value.yMax );
	}
	function writeChlist( buffer, dataView, cursor, channels, pixelType ) {
		for (var channel of channels) {
			writeNullTerminatedString( buffer, cursor, channel );
			writeUint32( dataView, cursor, pixelType );
			writeUint8( dataView, cursor, 1 ); // pLinear
			writeUint8( dataView, cursor, 0 ); // reserved
			writeUint8( dataView, cursor, 0 ); // reserved
			writeUint8( dataView, cursor, 0 ); // reserved
			writeUint32( dataView, cursor, 1 ); // xSampling
			writeUint32( dataView, cursor, 1 ); // ySampling
		}
		writeUint8( dataView, cursor, 0 ); // terminate
	}
	function writeAttribute( buffer, dataView, cursor, name, type, writer ) {
		writeNullTerminatedString( buffer, cursor, name );
		writeNullTerminatedString( buffer, cursor, type || name );
		var sizeMarker = cursor.value;
		writeUint32( dataView, cursor, 0 ); // size, tbd
		var valueMarker = cursor.value;
		writer(cursor);
		writeUint32( dataView, { value: sizeMarker }, cursor.value - valueMarker ); // size
	}
	function writeAttributes( buffer, dataView, cursor, header ) {
		writeAttribute( buffer, dataView, cursor, 'channels', 'chlist', c => writeChlist(buffer, dataView, c, header.channels, header.pixelType) );
		writeAttribute( buffer, dataView, cursor, 'dataWindow', 'box2i', c => writeBoxI(dataView, c, header.dataWindow) );
		writeAttribute( buffer, dataView, cursor, 'compression', null, c => writeUint8(dataView, c, header.compression) );
		writeAttribute( buffer, dataView, cursor, 'lineOrder', null, c => writeUint8(dataView, c, header.lineOrder) );
		writeAttribute( buffer, dataView, cursor, 'pixelAspectRatio', 'float', c => writeFloat32(dataView, c, header.pixelAspectRatio) );
		writeAttribute( buffer, dataView, cursor, 'displayWindow', 'box2i', c => writeBoxI(dataView, c, header.displayWindow) );
		writeAttribute( buffer, dataView, cursor, 'screenWindowWidth', 'float', c => writeFloat32(dataView, c, header.screenWindowWidth) );
		writeAttribute( buffer, dataView, cursor, 'screenWindowCenter', 'v2f', function(c) {
			writeFloat32(dataView, c, header.screenWindowCenter[0]);
			writeFloat32(dataView, c, header.screenWindowCenter[1]);
		} );
		writeUint8( dataView, cursor, 0 );
	}

	if (!refHeader)
		refHeader = { };
	else
		console.log(refHeader);
	
	var header = {
		channels: refHeader.channels || [ 'A', 'B', 'G', 'R' ],
		dataWindow: refHeader.dataWindow || { xMin: 0, xMax: image.width-1, yMin: 0, yMax: image.height-1 },
		compression: 0, // NO_COMPRESSION
		lineOrder: 1, // DECREASING_Y
		pixelAspectRatio: refHeader.pixelAspectRatio || 1,
		screenWindowWidth: refHeader.screenWindowWidth || 1,
		screenWindowCenter: refHeader.screenWindowCenter || [0, 0],
	};

	var rgbChannelCount = Math.round( rgbData.length / (image.width * image.height) );
	if (rgbData instanceof Float32Array && rgbData.length == image.width * image.height * rgbChannelCount) {
		header.channels.length = Math.min(rgbChannelCount, header.channels.length);
		header.pixelType = 2; // FLOAT
		header.pixelTypeBytes = FLOAT_BYTES; // FLOAT
	}
	else
		throw 'Invalid PF data encoding, must be (up to) 4-channel 32-bit floating-point data';
	// simplified header w/ only channel names
	for (var i = 0; i < header.channels.length; ++i) {
		header.channels[i] = header.channels[i].name || header.channels[i];
	}

	if (header.dataWindow.xMax - header.dataWindow.xMin != image.width-1)
		header.dataWindow.xMax = header.dataWindow.xMin + image.width-1;
	if (header.dataWindow.yMax - header.dataWindow.yMin != image.height-1)
		header.dataWindow.yMax = header.dataWindow.yMin + image.height-1;
	header.displayWindow = refHeader.displayWindow || header.dataWindow;

	console.log(header);

	var cursor = { value: 8 };
	writeAttributes( null, null, cursor, header );
	var headerSize = cursor.value;
	{
		var buffer = new ArrayBuffer(headerSize);
		var dataView = new DataView(buffer);
		
		cursor.value = 0;
		writeUint32( dataView, cursor, 0x01312F76 ); // magic number
		writeUint32( dataView, cursor, 0 ); // mask
		dataView.setUint8( 4, 2, true ); // version
	
		writeAttributes( buffer, dataView, cursor, header );
		outputBlobs.push(buffer);
	}

	// scanline table
	var scanlineBlockSize = 1;
	var numBlocks = Math.ceil(image.height / scanlineBlockSize);
	var offsetTableBuffer = new Uint32Array( numBlocks * (ULONG_BYTES / UINT_BYTES) );
	outputBlobs.push(offsetTableBuffer);
	cursor.value += offsetTableBuffer.byteLength;

	var channelOffsets = {
		R: 0, X: 0,
		G: 1, Y: 1,
		B: 2, Z: 2,
		A: 3
	};

	// data
	var dataCursor = 0;
	for (var blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
		// offset table entry
		offsetTableBuffer[2*(numBlocks-blockIdx)-2] = cursor.value;
		offsetTableBuffer[2*(numBlocks-blockIdx)-1] = 0;
		// block header storage
		var scanlineHeaderBuffer = new Uint32Array(2);
		outputBlobs.push(scanlineHeaderBuffer);
		cursor.value += scanlineHeaderBuffer.byteLength;
		// uncompressed block data
		var interleavedBlock = rgbData.subarray(dataCursor, dataCursor + scanlineBlockSize * image.width * rgbChannelCount);
		var uncompressedBlock = new Float32Array(scanlineBlockSize * image.width * header.channels.length);
		for (var c = 0; c < header.channels.length; c++) {
			var cOff = channelOffsets[ header.channels[c] ];
			for (var x = 0; x < image.width; x++) {
				uncompressedBlock[c * image.width + x] = interleavedBlock[x * rgbChannelCount + cOff];
			}
		}
		dataCursor += interleavedBlock.length;
		// data block
		var blockBuffer = uncompressedBlock;
		outputBlobs.push( blockBuffer );
		cursor.value += blockBuffer.byteLength;
		// block header information
		scanlineHeaderBuffer[0] = header.dataWindow.yMax - blockIdx * scanlineBlockSize;
		scanlineHeaderBuffer[1] = blockBuffer.byteLength;
	}
	
	return new Blob(outputBlobs);
}
