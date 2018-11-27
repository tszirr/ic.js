/**
 * @author Richard M. / https://github.com/richardmonette
 *
 * OpenEXR loader which, currently, supports reading 16 bit half data, in either
 * uncompressed or PIZ wavelet compressed form.
 *
 * Referred to the original Industrial Light & Magic OpenEXR implementation and the TinyEXR / Syoyo Fujita
 * implementation, so I have preserved their copyright notices.
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

THREE.EXRLoader.prototype.PIZReader = function() {

	const USHORT_RANGE = (1 << 16);
	const BITMAP_SIZE = (USHORT_RANGE >> 3);

	const HUF_ENCBITS = 16;  // literal (value) bit length
	const HUF_DECBITS = 14;  // decoding bit size (>= 8)

	const HUF_ENCSIZE = (1 << HUF_ENCBITS) + 1;  // encoding table size
	const HUF_DECSIZE = 1 << HUF_DECBITS;        // decoding table size
	const HUF_DECMASK = HUF_DECSIZE - 1;

	const SHORT_ZEROCODE_RUN = 59;
	const LONG_ZEROCODE_RUN = 63;
	const SHORTEST_LONG_RUN = 2 + LONG_ZEROCODE_RUN - SHORT_ZEROCODE_RUN;
	const LONGEST_LONG_RUN = 255 + SHORTEST_LONG_RUN;

	const INT32_SIZE = 4;
	const INT16_SIZE = 2;
	const INT8_SIZE = 1;

	function parseUint32( dataView, offset ) {

		var Uint32 = dataView.getUint32(offset.value, true);

		offset.value = offset.value + INT32_SIZE;

		return Uint32;

	}

	function parseUint8Array( uInt8Array, offset ) {

		var Uint8 = uInt8Array[offset.value];

		offset.value = offset.value + INT8_SIZE;

		return Uint8;

	}

	function parseUint8( dataView, offset ) {

		var Uint8 = dataView.getUint8(offset.value);

		offset.value = offset.value + INT8_SIZE;

		return Uint8;

	}

	// https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
	function decodeFloat16( binary ) {

		var exponent = ( binary & 0x7C00 ) >> 10,
			fraction = binary & 0x03FF;

		return ( binary >> 15 ? - 1 : 1 ) * (
			exponent ?
				(
					exponent === 0x1F ?
						fraction ? NaN : Infinity :
						Math.pow( 2, exponent - 15 ) * ( 1 + fraction / 0x400 )
				) :
				6.103515625e-5 * ( fraction / 0x400 )
		);

	}

	function parseUint16( dataView, offset ) {

		var Uint16 = dataView.getUint16( offset.value, true );

		offset.value += INT16_SIZE;

		return Uint16;

	}
	
	function reverseLutFromBitmap( bitmap, lut ) {

		var k = 0;

		for ( var i = 0; i < USHORT_RANGE; ++ i ) {

			if ( ( i == 0 ) || ( bitmap[ i >> 3 ] & ( 1 << ( i & 7 ) ) ) ) {

				lut[ k ++ ] = i;

			}

		}

		var n = k - 1;

		while ( k < USHORT_RANGE ) lut[ k ++ ] = 0;

		return n;

	}

	function hufClearDecTable( hdec ) {

		for ( var i = 0; i < HUF_DECSIZE; i ++ ) {

			hdec[ i ] = {};
			hdec[ i ].len = 0;
			hdec[ i ].lit = 0;
			hdec[ i ].p = null;

		}

	}

	const getBitsReturn = { l: 0, c: 0, lc: 0 };

	function getBits( nBits, c, lc, uInt8Array, inOffset ) {

		while ( lc < nBits ) {

			c = ( c << 8 ) | parseUint8Array( uInt8Array, inOffset );
			lc += 8;

		}

		lc -= nBits;

		getBitsReturn.l = ( c >> lc ) & ( ( 1 << nBits ) - 1 );
		getBitsReturn.c = c;
		getBitsReturn.lc = lc;
	}

	const hufTableBuffer = new Array( 59 );

	function hufCanonicalCodeTable( hcode ) {

		for ( var i = 0; i <= 58; ++ i ) hufTableBuffer[ i ] = 0;
		for ( var i = 0; i < HUF_ENCSIZE; ++ i ) hufTableBuffer[ hcode[ i ] ] += 1;

		var c = 0;

		for ( var i = 58; i > 0; -- i ) {

			var nc = ( ( c + hufTableBuffer[ i ] ) >> 1 );
			hufTableBuffer[ i ] = c;
			c = nc;

		}

		for ( var i = 0; i < HUF_ENCSIZE; ++ i ) {

			var l = hcode[ i ];
			if ( l > 0 ) hcode[ i ] = l | ( hufTableBuffer[ l ] ++ << 6 );

		}

	}

	function hufUnpackEncTable( uInt8Array, inDataView, inOffset, ni, im, iM, hcode ) {

		var p = inOffset;
		var c = 0;
		var lc = 0;

		for ( ; im <= iM; im ++ ) {

			if ( p.value - inOffset.value > ni ) return false;

			getBits( 6, c, lc, uInt8Array, p );

			var l = getBitsReturn.l;
			c = getBitsReturn.c;
			lc = getBitsReturn.lc;

			hcode[ im ] = l;

			if ( l == LONG_ZEROCODE_RUN ) {

				if ( p.value - inOffset.value > ni ) {

					throw 'Something wrong with hufUnpackEncTable';

				}

				getBits( 8, c, lc, uInt8Array, p );

				var zerun = getBitsReturn.l + SHORTEST_LONG_RUN;
				c = getBitsReturn.c;
				lc = getBitsReturn.lc;

				if ( im + zerun > iM + 1 ) {

					throw 'Something wrong with hufUnpackEncTable';

				}

				while ( zerun -- ) hcode[ im ++ ] = 0;

				im --;

			} else if ( l >= SHORT_ZEROCODE_RUN ) {

				var zerun = l - SHORT_ZEROCODE_RUN + 2;

				if ( im + zerun > iM + 1 ) {

					throw 'Something wrong with hufUnpackEncTable';

				}

				while ( zerun -- ) hcode[ im ++ ] = 0;

				im --;

			}

		}

		hufCanonicalCodeTable( hcode );

	}

	function hufLength( code ) { return code & 63; }

	function hufCode( code ) { return code >> 6; }

	function hufBuildDecTable( hcode, im, iM, hdecod ) {

		for ( ; im <= iM; im ++ ) {

			var c = hufCode( hcode[ im ] );
			var l = hufLength( hcode[ im ] );

			if ( c >> l ) {

				throw 'Invalid table entry';

			}

			if ( l > HUF_DECBITS ) {

				var pl = hdecod[ ( c >> ( l - HUF_DECBITS ) ) ];

				if ( pl.len ) {

					throw 'Invalid table entry';

				}

				pl.lit ++;

				if ( pl.p ) {

					var p = pl.p;
					pl.p = new Array( pl.lit );

					for ( var i = 0; i < pl.lit - 1; ++ i ) {

						pl.p[ i ] = p[ i ];

					}

				} else {

					pl.p = new Array( 1 );

				}

				pl.p[ pl.lit - 1 ] = im;

			} else if ( l ) {

				var plOffset = 0;

				for ( var i = 1 << ( HUF_DECBITS - l ); i > 0; i -- ) {

					var pl = hdecod[ ( c << ( HUF_DECBITS - l ) ) + plOffset ];

					if ( pl.len || pl.p ) {

						throw 'Invalid table entry';

					}

					pl.len = l;
					pl.lit = im;

					plOffset ++;

				}

			}

		}

		return true;

	}

	const getCharReturn = { c: 0, lc: 0 };

	function getChar( c, lc, uInt8Array, inOffset ) {

		c = ( c << 8 ) | parseUint8Array( uInt8Array, inOffset );
		lc += 8;

		getCharReturn.c = c;
		getCharReturn.lc = lc;

	}

	const getCodeReturn = { c: 0, lc: 0 };

	function getCode( po, rlc, c, lc, uInt8Array, inDataView, inOffset, outBuffer, outBufferOffset, outBufferEndOffset ) {

		if ( po == rlc ) {

			if ( lc < 8 ) {

				getChar( c, lc, uInt8Array, inOffset );
				c = getCharReturn.c;
				lc = getCharReturn.lc;

			}

			lc -= 8;

			var cs = ( c >> lc );
			var cs = new Uint8Array([cs])[0];

			if ( outBufferOffset.value + cs > outBufferEndOffset ) {

				return false;

			}

			var s = outBuffer[ outBufferOffset.value - 1 ];

			while ( cs-- > 0 ) {

				outBuffer[ outBufferOffset.value ++ ] = s;

			}

		} else if ( outBufferOffset.value < outBufferEndOffset ) {

			outBuffer[ outBufferOffset.value ++ ] = po;

		} else {

			return false;

		}

		getCodeReturn.c = c;
		getCodeReturn.lc = lc;

	}

	var NBITS = 16;
	var A_OFFSET = 1 << ( NBITS - 1 );
	var M_OFFSET = 1 << ( NBITS - 1 );
	var MOD_MASK = ( 1 << NBITS ) - 1;

	function UInt16( value ) {

		return ( value & 0xFFFF );

	}

	function Int16( value ) {

		var ref = UInt16( value );
		return ( ref > 0x7FFF ) ? ref - 0x10000 : ref;

	}

	const wdec14Return = { a: 0, b: 0 };

	function wdec14( l, h ) {

		var ls = Int16( l );
		var hs = Int16( h );

		var hi = hs;
		var ai = ls + ( hi & 1 ) + ( hi >> 1 );

		var as = ai;
		var bs = ai - hi;

		wdec14Return.a = as;
		wdec14Return.b = bs;

	}

	function wav2Decode( j, buffer, nx, ox, ny, oy, mx ) {

		var n = ( nx > ny ) ? ny : nx;
		var p = 1;
		var p2;

		while ( p <= n ) p <<= 1;

		p >>= 1;
		p2 = p;
		p >>= 1;

		while ( p >= 1 ) {

			var py = 0;
			var ey = py + oy * ( ny - p2 );
			var oy1 = oy * p;
			var oy2 = oy * p2;
			var ox1 = ox * p;
			var ox2 = ox * p2;
			var i00, i01, i10, i11;

			for ( ; py <= ey; py += oy2 ) {

				var px = py;
				var ex = py + ox * ( nx - p2 );

				for ( ; px <= ex; px += ox2 ) {

					var p01 = px + ox1;
					var p10 = px + oy1;
					var p11 = p10 + ox1;

					wdec14( buffer[ px + j ], buffer[ p10 + j ] );

					i00 = wdec14Return.a;
					i10 = wdec14Return.b;

					wdec14( buffer[ p01 + j ], buffer[ p11 + j ] );

					i01 = wdec14Return.a;
					i11 = wdec14Return.b;

					wdec14( i00, i01 );

					buffer[ px + j ] = wdec14Return.a;
					buffer[ p01 + j ] = wdec14Return.b;

					wdec14( i10, i11 );

					buffer[ p10 + j ] = wdec14Return.a;
					buffer[ p11 + j ] = wdec14Return.b;

				}

				if ( nx & p ) {

					var p10 = px + oy1;

					wdec14( buffer[ px + j ], buffer[ p10 + j ] );

					i00 = wdec14Return.a;
					buffer[ p10 + j ] = wdec14Return.b;

					buffer[ px + j ] = i00;

				}

			}

			if ( ny & p ) {

				var px = py;
				var ex = py + ox * ( nx - p2 );

				for ( ; px <= ex; px += ox2 ) {

					var p01 = px + ox1;

					wdec14( buffer[ px + j ], buffer[ p01 + j ] );

					i00 = wdec14Return.a;
					buffer[ p01 + j ] = wdec14Return.b;

					buffer[ px + j ] = i00;

				}

			}

			p2 = p;
			p >>= 1;

		}

		return py;

	}

	function hufDecode( encodingTable, decodingTable, uInt8Array, inDataView, inOffset, ni, rlc, no, outBuffer, outOffset ) {

		var c = 0;
		var lc = 0;
		var outBufferEndOffset = no;
		var inOffsetEnd = Math.trunc( inOffset.value + ( ni + 7 ) / 8 );

		while ( inOffset.value < inOffsetEnd ) {

			getChar( c, lc, uInt8Array, inOffset );

			c = getCharReturn.c;
			lc = getCharReturn.lc;

			while ( lc >= HUF_DECBITS ) {

				var index = ( c >> ( lc - HUF_DECBITS ) ) & HUF_DECMASK;
				var pl = decodingTable[ index ];

				if ( pl.len ) {

					lc -= pl.len;

					getCode( pl.lit, rlc, c, lc, uInt8Array, inDataView, inOffset, outBuffer, outOffset, outBufferEndOffset );

					c = getCodeReturn.c;
					lc = getCodeReturn.lc;

				} else {

					if ( ! pl.p ) {

						throw 'hufDecode issues';

					}

					var j;

					for ( j = 0; j < pl.lit; j ++ ) {

						var l = hufLength( encodingTable[ pl.p[ j ] ] );

						while ( lc < l && inOffset.value < inOffsetEnd ) {

							getChar( c, lc, uInt8Array, inOffset );

							c = getCharReturn.c;
							lc = getCharReturn.lc;

						}

						if ( lc >= l ) {

							if ( hufCode( encodingTable[ pl.p[ j ] ] ) == ( ( c >> ( lc - l ) ) & ( ( 1 << l ) - 1 ) ) ) {

								lc -= l;

								getCode( pl.p[ j ], rlc, c, lc, uInt8Array, inDataView, inOffset, outBuffer, outOffset, outBufferEndOffset );

								c = getCodeReturn.c;
								lc = getCodeReturn.lc;

								break;

							}

						}

					}

					if ( j == pl.lit ) {

						throw 'hufDecode issues';

					}

				}

			}

		}

		var i = ( 8 - ni ) & 7;

		c >>= i;
		lc -= i;

		while ( lc > 0 ) {

			var pl = decodingTable[ ( c << ( HUF_DECBITS - lc ) ) & HUF_DECMASK ];

			if ( pl.len ) {

				lc -= pl.len;

				getCode( pl.lit, rlc, c, lc, uInt8Array, inDataView, inOffset, outBuffer, outOffset, outBufferEndOffset );

				c = getCodeReturn.c;
				lc = getCodeReturn.lc;

			} else {

				throw 'hufDecode issues';

			}

		}

		return true;

	}

	function hufUncompress( uInt8Array, inDataView, inOffset, nCompressed, outBuffer, outOffset, nRaw ) {

		var initialInOffset = inOffset.value;

		var im = parseUint32( inDataView, inOffset );
		var iM = parseUint32( inDataView, inOffset );

		inOffset.value += 4;

		var nBits = parseUint32( inDataView, inOffset );

		inOffset.value += 4;

		if ( im < 0 || im >= HUF_ENCSIZE || iM < 0 || iM >= HUF_ENCSIZE ) {

			throw 'Something wrong with HUF_ENCSIZE';

		}

		var freq = new Array( HUF_ENCSIZE );
		var hdec = new Array( HUF_DECSIZE );

		hufClearDecTable( hdec );

		var ni = nCompressed - ( inOffset.value - initialInOffset );

		hufUnpackEncTable( uInt8Array, inDataView, inOffset, ni, im, iM, freq );

		if ( nBits > 8 * ( nCompressed - ( inOffset.value - initialInOffset ) ) ) {

			throw 'Something wrong with hufUncompress';

		}

		hufBuildDecTable( freq, im, iM, hdec );

		hufDecode( freq, hdec, uInt8Array, inDataView, inOffset, nBits, iM, nRaw, outBuffer, outOffset );

	}

	function applyLut( lut, data, nData ) {

		for ( var i = 0; i < nData; ++ i ) {

			data[ i ] = lut[ data[ i ] ];

		}

	}

	this.decompress = function( outBuffer, outOffset, uInt8Array, inDataView, inOffset, tmpBufSize, num_channels, exrChannelInfos, dataWidth, num_lines ) {

		var bitmap = new Uint8Array( BITMAP_SIZE );

		var minNonZero = parseUint16( inDataView, inOffset );
		var maxNonZero = parseUint16( inDataView, inOffset );

		if ( maxNonZero >= BITMAP_SIZE ) {

			throw 'Something is wrong with PIZ_COMPRESSION BITMAP_SIZE';

		}

		if ( minNonZero <= maxNonZero ) {

			for ( var i = 0; i < maxNonZero - minNonZero + 1; i ++ ) {

				bitmap[ i + minNonZero ] = parseUint8( inDataView, inOffset );

			}

		}

		var lut = new Uint16Array( USHORT_RANGE );
		var maxValue = reverseLutFromBitmap( bitmap, lut );

		var length = parseUint32( inDataView, inOffset );

		hufUncompress( uInt8Array, inDataView, inOffset, length, outBuffer, outOffset, tmpBufSize );

		var pizChannelData = new Array( num_channels );

		var outBufferEnd = 0;

		for ( var i = 0; i < num_channels; i ++ ) {

			var exrChannelInfo = exrChannelInfos[ i ];

			var pixelSize = 2; // assumes HALF_FLOAT

			pizChannelData[ i ] = {};
			pizChannelData[ i ][ 'start' ] = outBufferEnd;
			pizChannelData[ i ][ 'end' ] = pizChannelData[ i ][ 'start' ];
			pizChannelData[ i ][ 'nx' ] = dataWidth;
			pizChannelData[ i ][ 'ny' ] = num_lines;
			pizChannelData[ i ][ 'size' ] = 1;

			outBufferEnd += pizChannelData[ i ].nx * pizChannelData[ i ].ny * pizChannelData[ i ].size;

		}

		var fooOffset = 0;

		for ( var i = 0; i < num_channels; i ++ ) {

			for ( var j = 0; j < pizChannelData[ i ].size; ++ j ) {

				fooOffset += wav2Decode(
					j + fooOffset,
					outBuffer,
					pizChannelData[ i ].nx,
					pizChannelData[ i ].size,
					pizChannelData[ i ].ny,
					pizChannelData[ i ].nx * pizChannelData[ i ].size,
					maxValue
				);

			}

		}

		applyLut( lut, outBuffer, outBufferEnd );

		return true;

	}
}
