////////////////////////////////////////////////////////////////////////
//  3D Rendering and Shading
//

var gl;
var canvas;

var cuBuf;
var cuIndexBuf;
var cuNormalBuf;
var spBuf;
var spIndexBuf;
var spNormalBuf;

var matrixStack = [];

var aPositionLocation;
var aNormalLocation;
var uColorLocation;
var uLightPositionLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;

var spVerts = [];
var spIndicies = [];
var spNormals = [];

var degree0 = 0.0;
var degree1 = 0.0;
var degree2 = 0.0;
var degree3 = 0.0;
var degree4 = 0.0;
var degree5 = 0.0;
var prevMouseX = 0.0;
var prevMouseY = 0.0;
var sc = 0;

// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var uNormalMatrix = mat3.create(); // normal matrix

// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.0, 2.0];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];
var uLPosition = [5, 5, 5];
var objColor = [1.0, 1.0, 1.0];

// Flat vertex shader code
const flatVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out mat4 vMatrix;
out vec3 vPosInEyeSpace;

void main() {
  mat4 projectionModelView;
	projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  vMatrix = uVMatrix;
  gl_PointSize=5.0;
  vPosInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
}`;

// Flat fragment shader code
const flatFragShaderCode = `#version 300 es
precision mediump float;
in mat4 vMatrix;
in vec3 vPosInEyeSpace;
uniform vec3 objColor;
uniform vec3 uLPosition;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(cross(dFdx(vPosInEyeSpace), dFdy(vPosInEyeSpace)));
    // light vector
    vec3 lVector = normalize(uLPosition - vPosInEyeSpace); 
    // reflection vector
    vec3 rVector = normalize(-reflect(lVector, normal));
    // view vector
    vec3 vVector = normalize(-vPosInEyeSpace);

    vec3 amb = 0.15 * vec3(1.0, 1.0, 1.0);
    vec3 diff = 1.0 * max(dot(lVector, normal), 0.0) * objColor;
    vec3 spec = pow(max(dot(rVector, vVector), 0.0), 32.0) * vec3(1.0, 1.0, 1.0);
    fragColor = vec4(amb + diff + spec, 1.0);
}`;

// Gouraud vertex shader code
const perVertVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out vec3 normalEyeSpace;
out vec3 vPosInEyeSpace;

void main() {
  mat4 projectionModelView;
	projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  gl_PointSize=5.0;
  normalEyeSpace = normalize((transpose(inverse(mat3(uVMatrix * uMMatrix)))) * aNormal);
  vPosInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
}`;

// Gouraud fragment shader code
const perVertFragShaderCode = `#version 300 es
precision mediump float;
in vec3 vPosInEyeSpace;
in vec3 normalEyeSpace;
uniform vec3 objColor;
uniform vec3 uLPosition;

out vec4 fragColor;

void main() {
    // light vector
    vec3 lVector = normalize(uLPosition - vPosInEyeSpace); 
    // reflection vector
    vec3 rVector = normalize(-reflect(lVector, normalEyeSpace));
    // view vector
    vec3 vVector = normalize(-vPosInEyeSpace);

    vec3 amb = 0.15 * vec3(1.0, 1.0, 1.0);
    vec3 diff = 1.0 * max(dot(normalEyeSpace, lVector), 0.0) * objColor;
    vec3 spec = pow(max(dot(rVector, vVector), 0.0), 32.0) * vec3(1.0, 1.0, 1.0);
    fragColor = vec4(amb + diff + spec, 1.0);
}`;

// Phong vertex shader code
const perFragVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out vec3 normalEyeSpace;
out vec3 vPosInEyeSpace;

void main() {
  mat4 projectionModelView;
	projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  gl_PointSize=5.0;
  normalEyeSpace = normalize(mat3(uVMatrix * uMMatrix) * aNormal);
  vPosInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
}`;

// Phong fragment shader code
const perFragFragShaderCode = `#version 300 es
precision mediump float;
in mat4 vMatrix;
in vec3 vPosInEyeSpace;
in vec3 normalEyeSpace;
uniform vec3 objColor;
uniform vec3 uLPosition;

out vec4 fragColor;

void main() {
    // light vector
    vec3 lVector = normalize(uLPosition - vPosInEyeSpace); 
    // reflection vector
    vec3 rVector = normalize(-reflect(lVector, normalEyeSpace));
    // view vector
    vec3 vVector = normalize(-vPosInEyeSpace);

    vec3 amb = 0.15 * vec3(1.0, 1.0, 1.0);
    vec3 diff = max(dot(normalEyeSpace, lVector), 0.0) * objColor;
    vec3 spec = pow(max(dot(rVector, vVector), 0.0), 32.0) * vec3(1.0, 1.0, 1.0);
    fragColor = vec4(amb + diff + spec, 1.0);
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

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function initSphere(nslices, nstacks, radius) {
  var theta1, theta2;

  for (i = 0; i < nslices; i++) {
    spVerts.push(0);
    spVerts.push(-radius);
    spVerts.push(0);

    spNormals.push(0);
    spNormals.push(-1.0);
    spNormals.push(0);
  }

  for (j = 1; j < nstacks - 1; j++) {
    theta1 = (j * 2 * Math.PI) / nslices - Math.PI / 2;
    for (i = 0; i < nslices; i++) {
      theta2 = (i * 2 * Math.PI) / nslices;
      spVerts.push(radius * Math.cos(theta1) * Math.cos(theta2));
      spVerts.push(radius * Math.sin(theta1));
      spVerts.push(radius * Math.cos(theta1) * Math.sin(theta2));

      spNormals.push(Math.cos(theta1) * Math.cos(theta2));
      spNormals.push(Math.sin(theta1));
      spNormals.push(Math.cos(theta1) * Math.sin(theta2));
    }
  }

  for (i = 0; i < nslices; i++) {
    spVerts.push(0);
    spVerts.push(radius);
    spVerts.push(0);

    spNormals.push(0);
    spNormals.push(1.0);
    spNormals.push(0);
  }

  // setup the connectivity and indices
  for (j = 0; j < nstacks - 1; j++)
    for (i = 0; i <= nslices; i++) {
      var mi = i % nslices;
      var mi2 = (i + 1) % nslices;
      var idx = (j + 1) * nslices + mi;
      var idx2 = j * nslices + mi;
      var idx3 = j * nslices + mi2;
      var idx4 = (j + 1) * nslices + mi;
      var idx5 = j * nslices + mi2;
      var idx6 = (j + 1) * nslices + mi2;

      spIndicies.push(idx);
      spIndicies.push(idx2);
      spIndicies.push(idx3);
      spIndicies.push(idx4);
      spIndicies.push(idx5);
      spIndicies.push(idx6);
    }
}

function initSphereBuffer() {
  var nslices = 30; // use even number
  var nstacks = nslices / 2 + 1;
  var radius = 1.0;
  initSphere(nslices, nstacks, radius);

  spBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = nslices * nstacks;

  spNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = nslices * nstacks;

  spIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = (nstacks - 1) * 6 * (nslices + 1);
}
function drawSphere() {
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    spBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    spNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // Draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  gl.uniform3fv(uLightPositionLocation, uLPosition);
  gl.uniform3fv(uColorLocation, objColor);

  gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

// Cube generation function with normals
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
  cuBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cuBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  cuBuf.itemSize = 3;
  cuBuf.numItems = vertices.length / 3;

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
  cuNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cuNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  cuNormalBuf.itemSize = 3;
  cuNormalBuf.numItems = normals.length / 3;


  var indices = [
    0,
    1,
    2,
    0,
    2,
    3, // Front face
    4,
    5,
    6,
    4,
    6,
    7, // Back face
    8,
    9,
    10,
    8,
    10,
    11, // Top face
    12,
    13,
    14,
    12,
    14,
    15, // Bottom face
    16,
    17,
    18,
    16,
    18,
    19, // Right face
    20,
    21,
    22,
    20,
    22,
    23, // Left face
  ];
  cuIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cuIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );
  cuIndexBuf.itemSize = 1;
  cuIndexBuf.numItems = indices.length;
}

function drawCube() {
  gl.bindBuffer(gl.ARRAY_BUFFER, cuBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    cuBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, cuNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    cuNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cuIndexBuf);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  gl.uniform3fv(uLightPositionLocation, uLPosition);
  gl.uniform3fv(uColorLocation, objColor);

  gl.drawElements(gl.TRIANGLES, cuIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  //gl.drawArrays(gl.LINE_STRIP, 0, buf.numItems); // show lines
  //gl.drawArrays(gl.POINTS, 0, buf.numItems); // show points
}

//////////////////////////////////////////////////////////////////////
//Main drawing routine
function drawFlatScene() {

  shaderProgram = flatShaderProgram;
  gl.useProgram(shaderProgram);
  gl.viewport(0, 0, 450, 450);
  gl.scissor(0, 0, 450, 450);
  gl.clearColor(0.85, 0.85, 0.99, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //get locations of attributes and uniforms declared in the shader
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  uLightPositionLocation = gl.getUniformLocation(shaderProgram, 'uLPosition');
  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);

  initSphereBuffer();
  initCubeBuffer();

  gl.enable(gl.DEPTH_TEST);
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  //set up the model matrix
  mat4.identity(mMatrix);
  mat4.identity(uNormalMatrix);

  // transformations applied here on model matrix
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1), [1, 0, 0]);

  // rotation to get the default position
  mMatrix = mat4.rotate(mMatrix, 0.4, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, 0.2, [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, 0.1, [0, 0, 1]);

  mMatrix = mat4.translate(mMatrix, [0, -0.1, 0]);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 0.5, 0]);
  mMatrix = mat4.scale(mMatrix, [0.26, 0.26, 0.26]);

  // Now draw the sphere
  objColor = [0, 0.35, 0.62];
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.0, -0.145, 0]);
  mMatrix = mat4.scale(mMatrix, [0.45, 0.8, 0.5]);

  // Now draw the cube
  objColor = [0.69, 0.68, 0.49];
  drawCube();
  mMatrix = popMatrix(matrixStack);
}

function drawGouraudScene() {

  shaderProgram = perVertShaderProgram;
  gl.useProgram(shaderProgram);

  gl.viewport(450, 0, 450, 450);
  gl.scissor(450, 0, 450, 450);
  gl.clearColor(0.95, 0.85, 0.85, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //get locations of attributes and uniforms declared in the shader
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  uLightPositionLocation = gl.getUniformLocation(shaderProgram, 'uLPosition');
  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);
 
  initSphereBuffer();
  initCubeBuffer();

  gl.enable(gl.DEPTH_TEST);
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  //set up the model matrix
  mat4.identity(mMatrix);
  mat4.identity(uNormalMatrix);

  // transformations applied here on model matrix
  mMatrix = mat4.rotate(mMatrix, degToRad(degree2), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree3), [1, 0, 0]);

  // rotation to get the default position
  mMatrix = mat4.rotate(mMatrix, 0.05, [0, 1, 0]);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, -0.45, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.32, 0.32, 0.32]);

  objColor = [0.63, 0.63, 0.63];
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.35, -0.1, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.32, 0.32, 0.32]);
  mMatrix = mat4.rotate(mMatrix, 0.1, [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, -0.5, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, -0.32, [0, 1, 0]);

  objColor = [0, 0.65, 0];
  drawCube();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.18, 0.2, 0.25]);
  mMatrix = mat4.scale(mMatrix, [0.18, 0.18, 0.18]);

  objColor = [0.63, 0.63, 0.63];
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 0.38, 0.3]);
  mMatrix = mat4.scale(mMatrix, [0.18, 0.18, 0.18]);
  mMatrix = mat4.rotate(mMatrix, 0.35, [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, 0.75, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.15, [0, 1, 0]);

  objColor = [0, 0.65, 0];
  drawCube();

  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.1, 0.48, 0.4]);
  mMatrix = mat4.scale(mMatrix, [0.08, 0.08, 0.08]);

  objColor = [0.63, 0.63, 0.63];
  drawSphere();
  mMatrix = popMatrix(matrixStack);
}

function drawPhongScene() {

  shaderProgram = perFragShaderProgram;
  gl.useProgram(shaderProgram);

  gl.viewport(900, 0, 450, 450);
  gl.scissor(900, 0, 450, 450);
  gl.clearColor(0.85, 0.95, 0.85, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //get locations of attributes and uniforms declared in the shader
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  uLightPositionLocation = gl.getUniformLocation(shaderProgram, 'uLPosition');
  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);
 
  initSphereBuffer();
  initCubeBuffer();

  gl.enable(gl.DEPTH_TEST);
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  //set up the model matrix
  mat4.identity(mMatrix);
  mat4.identity(uNormalMatrix);

  // transformations applied here on model matrix
  mMatrix = mat4.rotate(mMatrix, degToRad(degree4), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree5), [1, 0, 0]);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, -0.6, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);

  objColor = [0, 0.69, 0.14];
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.01, -0.38, 0.1]);
  mMatrix = mat4.rotate(mMatrix,degToRad(45), [1, 1, 1]);
  mMatrix = mat4.rotate(mMatrix, -0.6, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.1, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, -0.1, [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [1.35, 0.03, 0.25]);

  objColor = [0.7, 0.2, 0.01];
  drawCube();

  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.35, -0.21, 0.4]);
  mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 0.15]);

  objColor = [0.31, 0.11, 0.62];
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.35, -0.21, -0.2]);
  mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 0.15]);

  objColor = [0.13, 0.43, 0.5];
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.35, -0.07, 0.45]);
  mMatrix = mat4.rotate(mMatrix, degToRad(135), [1, 1, 1]);
  mMatrix = mat4.rotate(mMatrix, -1.45, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.6, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, 0.1, [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.6, 0.03, 0.3]);

  objColor = [0.63, 0.63, 0.0];
  drawCube();

  mMatrix = popMatrix(matrixStack)

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.35, -0.06, -0.2]);
  mMatrix = mat4.rotate(mMatrix, degToRad(135), [1, 1, 1]);
  mMatrix = mat4.rotate(mMatrix, -1.45, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.6, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, 0.1, [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.6, 0.03, 0.3]);

  objColor = [0.19, 0.63, 0.5];
  drawCube();

  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.35, 0.085, 0.4]);
  mMatrix = mat4.scale(mMatrix, [0.14, 0.14, 0.14]);

  objColor = [0.67, 0, 0.67];
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.35, 0.125, -0.2]);
  mMatrix = mat4.scale(mMatrix, [0.17, 0.17, 0.17]);

  objColor = [0.51, 0.37, 0.11];
  drawSphere();
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.01, 0.265, 0.1]);
  mMatrix = mat4.rotate(mMatrix, degToRad(45), [1, 1, 1]);
  mMatrix = mat4.rotate(mMatrix, -0.52, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.12, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, -0.25, [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [1.3, 0.03, 0.25]);

  objColor = [0.8, 0.2, 0.06];
  drawCube();

  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 0.48, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);

  objColor = [0.42, 0.42, 0.6];
  drawSphere();
  mMatrix = popMatrix(matrixStack);
}

function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);

  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    prevMouseX = event.clientX;
    prevMouseY = canvas.height - event.clientY;
    var lim = prevMouseY <= 400 && prevMouseY >= -50;
    if (prevMouseX >= 50 && prevMouseX <= 500 && lim) sc = 1;
    else if (prevMouseX >= 500 && prevMouseX <= 950 && lim) sc = 2;
    else if (prevMouseX >= 950 && prevMouseX <= 1400 && lim) sc = 3;
  }
}

function onMouseMove(event) {
  // make mouse interaction only within canvas
  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    var mouseX = event.clientX;
    var diffX1 = mouseX - prevMouseX;
    prevMouseX = mouseX;

    var mouseY = canvas.height - event.clientY;
    var diffY2 = mouseY - prevMouseY;
    prevMouseY = mouseY;

    var lim = mouseY <= 400 && mouseY >= -50;
    if (sc == 1 && mouseX >= 50 && mouseX <= 500 && lim) {
        degree0 = degree0 + diffX1 / 5;
        degree1 = degree1 - diffY2 / 5;
    }
    else if (sc == 2 && mouseX >= 500 && mouseX <= 950 && lim) {
        degree2 = degree2 + diffX1 / 5;
        degree3 = degree3 - diffY2 / 5;
    }
    else if (sc == 3 && mouseX >= 950 && mouseX <= 1400 && lim) {
        degree4 = degree4 + diffX1 / 5;
        degree5 = degree5 - diffY2 / 5;
    }
    drawFlatScene();
    drawGouraudScene();
    drawPhongScene();
  }
}

function onMouseUp(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("3DRenderShader");
  document.addEventListener("mousedown", onMouseDown, false);

  // Control Light Position
  const light = document.getElementById("light");

  let lightX = parseFloat(light.value);

  light.addEventListener('input', (event) => {
    lightX = parseFloat(event.target.value);
    uLPosition[0] = lightX;
    drawFlatScene();
    drawGouraudScene();
    drawPhongScene();
  });

  // Control Camera Position
  const camera = document.getElementById("camera");

  let cameraZ = parseFloat(camera.value);
  
  camera.addEventListener('input', (event) => {
    cameraZ = parseFloat(event.target.value);
    eyePos[2] = cameraZ;
    drawFlatScene();
    drawGouraudScene();
    drawPhongScene();
  });

  // initialize WebGL
  initGL(canvas);

  gl.enable(gl.SCISSOR_TEST);
  // initialize shader program
  flatShaderProgram = initShaders(flatVertexShaderCode, flatFragShaderCode);
  perVertShaderProgram = initShaders(perVertVertexShaderCode, perVertFragShaderCode);
  perFragShaderProgram = initShaders(perFragVertexShaderCode, perFragFragShaderCode);

  drawFlatScene();
  drawGouraudScene();
  drawPhongScene();
}