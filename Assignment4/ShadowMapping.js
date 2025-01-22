// ////////////////////////////////////////////////////////////////////////
// //  Shadow Mapping
// //
var gl;
var canvas;
var matrixStack = [];

var flagAnimate = false;

var renderShader;
var aNormalLocation;
var aPositionLocation;
var uMMatrixLocation;
var uPMatrixLocation;
var uVMatrixLocation;
var uLVMatrixLocation;
var uColorLocation;
var uShadowLocation;

var shadowShader;
var aPositionLocationShadow;
var uMMatrixLocationShadow;
var uPMatrixLocationShadow;
var uVMatrixLocationShadow;
var uDiffuseTermShadow;

var FBO;
var depthTexture;

var spBuf;
var spIndexBuf;
var spNormalBuf;
var cubeBuf;
var cubeIndexBuf;
var cubeNormalBuf;
var teaPotBuf;
var teaPotNormalBuf;
var teaPotIndexBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];

var teaPotJSON = "teapot.json";

var vMatrix = mat4.create(); 
var mMatrix = mat4.create(); 
var pMatrix = mat4.create(); 
var lvMatrix = mat4.create(); 

var vMatrixShadow = mat4.create(); 
var mMatrixShadow = mat4.create(); 
var pMatrixShadow = mat4.create(); 

var depthTextureSize = 785;
var uLPosition = [0.25, 0.35, 0];
var eyePos = [0, 0.25, 0.15];
var degree = 0.0;
var objColor = [1.0, 1.0, 1.0, 1.0];
var defaultEyePos =  [0, 0.25, 0.15];

// Pass 1 shadow pass shaders
const vertexShadowPassShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

void main() {
  gl_Position = uPMatrix*uVMatrix*uMMatrix*vec4(aPosition,1.0);
}`;

const fragShadowPassShaderCode = `#version 300 es
precision highp float;

uniform vec4 diffuseTerm;

out vec4 fragColor;

void main() {
    fragColor = diffuseTerm;
}`;

// Pass 2 render pass shaders
const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform mat4 uLVMatrix;

out mat4 vMatrix;
out vec3 vPosInEyeSpace;
out vec3 normalEyeSpace;
out vec4 shadowTextureCoord;

void main() 
{
	gl_PointSize = 5.0;
	gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aPosition, 1.0);
	vPosInEyeSpace = vec3(uVMatrix * uMMatrix * vec4(aPosition, 1.0));
	vMatrix=uVMatrix;
	mat3 normalTransformMatrix = mat3(uVMatrix * uMMatrix);
	normalEyeSpace = vec3(normalize(normalTransformMatrix * aNormal));
	const mat4 textureTransformMat = 
  mat4(0.5, 0.0, 0.0, 0.0,
		0.0, 0.5, 0.0, 0.0,
		0.0, 0.0, 0.5, 0.0,
		0.5, 0.5, 0.5, 1.0);
	mat4 lightProjectionMat = textureTransformMat * uPMatrix * uLVMatrix * uMMatrix;
	shadowTextureCoord = lightProjectionMat * vec4(aPosition, 1.0);
}`;

const fragShaderCode = `#version 300 es
precision highp float;

in vec3 vPosInEyeSpace;
in vec3 normalEyeSpace;
in mat4 vMatrix;
in vec4 shadowTextureCoord;

uniform sampler2D uSdhadow;
uniform vec4 objColor;
uniform vec3 uLPosition;

out vec4 fragColor;
	
void main() {
	vec3 lVector = normalize(vec3(vMatrix * vec4(uLPosition, 1.0))  - vPosInEyeSpace);
	vec3 rVector = normalize(-reflect(lVector, normalEyeSpace));
	vec3 vVector = normalize(-vPosInEyeSpace);
  
  vec3 amb = vec3(0.15);
	vec3 diff= vec3(max(dot(normalEyeSpace, lVector), 0.0)* objColor);
	vec3 spec = vec3(1.0*pow(max(dot(vVector, rVector), 0.0), 32.0));

	vec3 projectedTexCoord = (shadowTextureCoord.xyz) / (shadowTextureCoord.w);
	float shadowFactor = projectedTexCoord.z - 0.008 > texture(uSdhadow, projectedTexCoord.xy).r ? 0.4 : 1.0;

	fragColor = vec4(shadowFactor * vec3(vec4(diff + spec, 1.0)) + amb, 1.0);
}`;


function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders(vertexShaderCode, fragShaderCode) {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function initSphere(nslices, nstacks, radius) {
  for (var i = 0; i <= nslices; i++) {
    var angle = (i * Math.PI) / nslices;
    var comp1 = Math.sin(angle);
    var comp2 = Math.cos(angle);

    for (var j = 0; j <= nstacks; j++) {
      var phi = (j * 2 * Math.PI) / nstacks;
      var comp3 = Math.sin(phi);
      var comp4 = Math.cos(phi);

      var xcood = comp4 * comp1;
      var ycoord = comp2;
      var zcoord = comp3 * comp1;

      spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
      spNormals.push(xcood, ycoord, zcoord);
    }
  }

  for (var i = 0; i < nslices; i++) {
    for (var j = 0; j < nstacks; j++) {
      var id1 = i * (nstacks + 1) + j;
      var id2 = id1 + nstacks + 1;

      spIndicies.push(id1, id2, id1 + 1);
      spIndicies.push(id2, id2 + 1, id1 + 1);
    }
  }
}

function initSphereBuffer() {
  var nslices = 50;
  var nstacks = 50;
  var radius = 0.5;

  initSphere(nslices, nstacks, radius);

  spBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = spVerts.length / 3;

  spIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = spIndicies.length;

  spNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = spNormals.length / 3;
}

function drawSphere(pass = 2) {
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
	gl.vertexAttribPointer(aPositionLocation, spBuf.itemSize, gl.FLOAT, false, 0, 0);
	
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
	if (pass == 1){
		gl.uniformMatrix4fv(uMMatrixLocationShadow, false, mMatrixShadow);
		gl.uniformMatrix4fv(uVMatrixLocationShadow, false, vMatrixShadow);
		gl.uniformMatrix4fv(uPMatrixLocationShadow, false, pMatrixShadow);
		gl.uniform4fv(uDiffuseTermShadow, objColor);
	}
  else {
    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.vertexAttribPointer(aNormalLocation,spNormalBuf.itemSize,gl.FLOAT,false,0,0);
  
    gl.uniform4fv(uColorLocation, objColor);
    gl.uniform3fv(uLightLocation, uLPosition);
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uLVMatrixLocation, false, lvMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  }
	gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

function initCubeBuffer() {
  var vertices = [
      // Front face
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      // Back face
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
      // Top face
      -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      // Bottom face
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
      // Right face
      0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
      // Left face
      -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  ];
  cubeBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  cubeBuf.itemSize = 3;
  cubeBuf.numItems = vertices.length / 3;

  var normals = [
      // Front face
      0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
      // Back face
      0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
      // Top face
      0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
      // Bottom face
      0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
      // Right face
      1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
      // Left face
      -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];
  cubeNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  cubeNormalBuf.itemSize = 3;
  cubeNormalBuf.numItems = normals.length / 3;

  var indices = [
      0, 1, 2, 0, 2, 3, // Front face
      4, 5, 6, 4, 6, 7, // Back face
      8, 9, 10, 8, 10, 11, // Top face
      12, 13, 14, 12, 14, 15, // Bottom face
      16, 17, 18, 16, 18, 19, // Right face
      20, 21, 22, 20, 22, 23, // Left face
  ];
  cubeIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);
  gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
  );
  cubeIndexBuf.itemSize = 1;
  cubeIndexBuf.numItems = indices.length;
}

function drawCube(pass) {
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
	gl.vertexAttribPointer(aPositionLocation,cubeBuf.itemSize,gl.FLOAT,false,0,0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

	if (pass == 1){
		gl.uniformMatrix4fv(uMMatrixLocationShadow, false, mMatrixShadow);
		gl.uniformMatrix4fv(uVMatrixLocationShadow, false, vMatrixShadow);
		gl.uniformMatrix4fv(uPMatrixLocationShadow, false, pMatrixShadow);
		gl.uniform4fv(uDiffuseTermShadow, objColor);
	}
  else{
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.vertexAttribPointer(aNormalLocation,cubeNormalBuf.itemSize,gl.FLOAT,false,0,0);
  
    gl.uniform4fv(uColorLocation, objColor);
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uLVMatrixLocation, false, lvMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    gl.uniform3fv(uLightLocation, uLPosition);
  }
	gl.drawElements(gl.TRIANGLES, cubeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);

}

function initTeaPot() {
  // Fetch API is used to make HTTP requests and process responses
  fetch(teaPotJSON, {
      headers: {
          'Content-Type': 'application/json'
      }
  })
  .then(response => {
      return response.json();
  })
  .then(data => {
    initTeaPotBuffer(data);
  })
}

function initTeaPotBuffer(data) {
    teaPotBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teaPotBuf);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(data.vertexPositions),
        gl.STATIC_DRAW
    );
    teaPotBuf.itemSize = 3;
    teaPotBuf.numItems = data.vertexPositions.length / 3;

    teaPotNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teaPotNormalBuf);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(data.vertexNormals),
        gl.STATIC_DRAW
    );
    teaPotNormalBuf.itemSize = 3;
    teaPotNormalBuf.numItems = data.vertexNormals.length / 3;

    teaPotIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teaPotIndexBuf);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(data.indices),
        gl.STATIC_DRAW
    );
    teaPotIndexBuf.itemSize = 1;
    teaPotIndexBuf.numItems = data.indices.length;
    drawScene();
}


function drawTeaPot(pass) 
{
	gl.bindBuffer(gl.ARRAY_BUFFER, teaPotBuf);
	gl.vertexAttribPointer(aPositionLocation, teaPotBuf.itemSize, gl.FLOAT, false, 0, 0);
	
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teaPotIndexBuf);
  if (pass == 1){
      gl.uniformMatrix4fv(uMMatrixLocationShadow, false, mMatrixShadow);
      gl.uniformMatrix4fv(uVMatrixLocationShadow, false, vMatrixShadow);
      gl.uniformMatrix4fv(uPMatrixLocationShadow, false, pMatrixShadow);
      gl.uniform4fv(uDiffuseTermShadow, objColor);
    }
    else{ 
        gl.bindBuffer(gl.ARRAY_BUFFER, teaPotNormalBuf);
	      gl.vertexAttribPointer(aNormalLocation,teaPotNormalBuf.itemSize,gl.FLOAT,false,0,0);
        gl.uniform4fv(uColorLocation, objColor);
	      gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
	      gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
	      gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
	      gl.uniformMatrix4fv(uLVMatrixLocation, false, lvMatrix);
	      gl.uniform3fv(uLightLocation, uLPosition);
      }
	gl.drawElements(gl.TRIANGLES,teaPotIndexBuf.numItems,gl.UNSIGNED_INT,0);
}

function initDepthFBO() {
  depthTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.texImage2D(
      gl.TEXTURE_2D, 
      0, 
      gl.DEPTH_COMPONENT24, 
      depthTextureSize, 
      depthTextureSize, 
      0, 
      gl.DEPTH_COMPONENT, 
      gl.UNSIGNED_INT, 
      null 
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  FBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
  FBO.width = depthTextureSize;
  FBO.height = depthTextureSize;
  
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

  var FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (FBOstatus != gl.FRAMEBUFFER_COMPLETE)
      console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use FBO");
}


function drawObjects(mMatrix, pass)
{ 
  mat4.identity(mMatrix);
	mMatrix = mat4.translate(mMatrix, [0, 0, 0]);
	mMatrix = mat4.scale(mMatrix, [0.27, 0.02, 0.33]);
  objColor = [0.4, 0.4, 0.4, 1.0];
	drawCube(pass);
	mMatrix = mat4.scale(mMatrix, [4, 60, 3]);
	mMatrix = mat4.translate(mMatrix, [0.033, 0.042, 0.075]);
	mMatrix = mat4.scale(mMatrix, [0.07 , 0.07, 0.07]);
  objColor = [0.0, 0.4, 0.576, 1.0];
	drawSphere(pass);
	mMatrix = mat4.scale(mMatrix, [15, 15, 15]);
	mMatrix = mat4.translate(mMatrix, [-0.053, 0.01, -0.125]);
	mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0, 1, 0]);
	mMatrix = mat4.scale(mMatrix, [0.005, 0.005, 0.005]);
  objColor = [0.18, 0.8, 0.53, 1.0];
	drawTeaPot(pass);
}

function drawScene() 
{
	animate = function()
	{
		// Shadow pass
		gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		gl.clearColor(0, 0, 0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(shadowShader);
		
		mMatrixShadow = mat4.identity(mMatrixShadow);
		pMatrixShadow = mat4.identity(pMatrixShadow);
		mat4.perspective(50, 1.0, 0.1, 1000, pMatrixShadow);
		
		vMatrixShadow = mat4.identity(vMatrixShadow);
		vMatrixShadow = mat4.lookAt(uLPosition, [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], vMatrixShadow);
		
		lvMatrix = vMatrixShadow;
		
		gl.enableVertexAttribArray(aPositionLocationShadow);
    drawObjects(mMatrixShadow, 1);
		gl.disableVertexAttribArray(aPositionLocationShadow);
		
		// Render pass 
		mMatrix = mat4.identity(mMatrix);
		pMatrix = mat4.identity(pMatrix);
		mat4.perspective(60, 1.0, 0.1, 1000, pMatrix);
		
		vMatrix = mat4.identity(vMatrix);
		vMatrix = mat4.lookAt(eyePos, [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], vMatrix);
        
		if (flagAnimate)
		{
			const cosTheta = Math.cos(degToRad(degree));
      const sinTheta = Math.sin(degToRad(degree));
      eyePos[0] = defaultEyePos[0] * cosTheta - defaultEyePos[2] * sinTheta;
      eyePos[2] = defaultEyePos[0] * sinTheta + defaultEyePos[2] * cosTheta;
      mat4.lookAt(eyePos, [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], vMatrix);
			degree += 0.1;
		}
		
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		gl.clearColor(0, 0, 0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(renderShader);
		gl.enableVertexAttribArray(aPositionLocation);
		gl.enableVertexAttribArray(aNormalLocation);
		
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, depthTexture);
		gl.uniform1i(uShadowLocation, 0);
		
    drawObjects(mMatrix, 2);
		
		gl.disableVertexAttribArray(aPositionLocation);
		gl.disableVertexAttribArray(aNormalLocation);
		
		if (flagAnimate)
			animationId = requestAnimationFrame(animate);
	}
	animate();
}

function webGLStart() 
{
	canvas = document.getElementById("shadow_mapping");
	initGL(canvas);
	gl.enable(gl.DEPTH_TEST);

	shadowShader = initShaders(vertexShadowPassShaderCode, fragShadowPassShaderCode);
	aPositionLocationShadow = gl.getAttribLocation(shadowShader, "aPosition");
	uMMatrixLocationShadow = gl.getUniformLocation(shadowShader, "uMMatrix");
	uVMatrixLocationShadow = gl.getUniformLocation(shadowShader, "uVMatrix");
	uPMatrixLocationShadow = gl.getUniformLocation(shadowShader, "uPMatrix");
	uDiffuseTermShadow = gl.getUniformLocation(shadowShader, "diffuseTerm");

	renderShader = initShaders(vertexShaderCode, fragShaderCode);
	aNormalLocation = gl.getAttribLocation(renderShader, "aNormal");
	aPositionLocation = gl.getAttribLocation(renderShader, "aPosition");
	uColorLocation = gl.getUniformLocation(renderShader, "objColor");
	uLightLocation = gl.getUniformLocation(renderShader, "uLPosition");
	uMMatrixLocation = gl.getUniformLocation(renderShader, "uMMatrix");
	uPMatrixLocation = gl.getUniformLocation(renderShader, "uPMatrix");
	uVMatrixLocation = gl.getUniformLocation(renderShader, "uVMatrix");
	uLVMatrixLocation = gl.getUniformLocation(renderShader, "uLVMatrix");
	uShadowLocation = gl.getUniformLocation(renderShader, "uSdhadow");
	
	initDepthFBO();
	initSphereBuffer();
	initCubeBuffer();
	initTeaPot();

  const light = document.getElementById('lightSlider');
  light.addEventListener('input', () => {
      uLPosition[2] = light.value;
      const currentAnimateStatus = flagAnimate;
      flagAnimate = false; 
      drawScene();
      flagAnimate = currentAnimateStatus;
  });

  const animation = document.getElementById('animate');
  animation.addEventListener('input', () => {
      flagAnimate = animation.checked;
      drawScene(); 
  });

}