////////////////////////////////////////////////////////////////////////
// 2D scene rendering
//

var gl;
var color;
var animation;
var matrixStack = [];

// mMatrix is called the model matrix, transforms objects
// from local object space to world space.
var mMatrix = mat4.create();
var uMMatrixLocation;
var aPositionLocation;
var uColorLoc;

let rotAngle = 0.0;
let fanRot = 0.0;
let distance0 = 0.0;
let distance1 = 0.0;
let direction0 = 1;
let direction1 = 1;

var circleBuf;
var circleIndexBuf;
var sqVertexPositionBuffer;
var sqVertexIndexBuffer;
var mode = 'solid';

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
uniform mat4 uMMatrix;

void main() {
  gl_Position = uMMatrix*vec4(aPosition,0.0,1.0);
  gl_PointSize = 4.0;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform vec4 color;

void main() {
  fragColor = color;
}`;

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

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

function initShaders() {
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

function initSquareBuffer() {
  // buffer for point locations
  const sqVertices = new Float32Array([
    0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  ]);
  sqVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
  sqVertexPositionBuffer.itemSize = 2;
  sqVertexPositionBuffer.numItems = 4;

  // buffer for point indices
  const sqIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  sqVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sqIndices, gl.STATIC_DRAW);
  sqVertexIndexBuffer.itemsize = 1;
  sqVertexIndexBuffer.numItems = 6;
}

function drawSquare(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.vertexAttribPointer(aPositionLocation, sqVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);

  gl.uniform4fv(uColorLoc, color);

  // now draw the square
  if(mode == 'point') {
    gl.drawElements(gl.POINTS, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  }  
  if(mode == 'wireframe') {
    gl.drawElements(gl.LINE_LOOP, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  }  
  if(mode == 'solid') {
    gl.drawElements(gl.TRIANGLES, sqVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  }  
}

function initTriangleBuffer() {
  // buffer for point locations
  const triangleVertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
  triangleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
  triangleBuf.itemSize = 2;
  triangleBuf.numItems = 3;

  // buffer for point indices
  const triangleIndices = new Uint16Array([0, 1, 2]);
  triangleIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW);
  triangleIndexBuf.itemsize = 1;
  triangleIndexBuf.numItems = 3;
}

function drawTriangle(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
  gl.vertexAttribPointer(aPositionLocation, triangleBuf.itemSize, gl.FLOAT, false, 0, 0);

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);

  gl.uniform4fv(uColorLoc, color);

  // now draw the triangle
  if(mode == 'point') {
    gl.drawElements(gl.POINTS, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  }  
  if(mode == 'wireframe') {
    gl.drawElements(gl.LINE_LOOP, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  }  
  if(mode == 'solid') {
    gl.drawElements(gl.TRIANGLES, triangleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  }  
}

function initCircleBuffer() {
  
  const circVertices = new Float32Array(2 * (101));  
  const circIndices = new Uint16Array(300);  
  
  circVertices[0] = 0.0;
  circVertices[1] = 0.0; 

  for (let i = 1; i <= 100; i++) {
    const angle = ((i - 1)/ 100) * 2 * Math.PI;
    circVertices[2 * i] = Math.cos(angle);
    circVertices[2 * i + 1] = Math.sin(angle);

    circIndices[3 * (i - 1)] = 0;
    circIndices[3 * (i - 1) + 1] = i;
    circIndices[3 * (i - 1) + 2] = (i + 1);   
  }
    circIndices[299] = 1;

  // buffer for point locations
  circleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, circVertices, gl.STATIC_DRAW);
  circleBuf.itemSize = 2;
  circleBuf.numItems = 101;

  // buffer for point indices
  circleIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, circIndices, gl.STATIC_DRAW);
  circleIndexBuf.itemsize = 1;
  circleIndexBuf.numItems = 300;
}

function drawCircle(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
  gl.vertexAttribPointer(aPositionLocation, circleBuf.itemSize, gl.FLOAT, false, 0, 0);

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);

  gl.uniform4fv(uColorLoc, color);

  // now draw the circle
  if(mode == 'point') {
    gl.drawElements(gl.POINTS, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  }  
  if(mode == 'wireframe') {
    gl.drawElements(gl.LINE_LOOP, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  }  
  if(mode == 'solid') {
    gl.drawElements(gl.TRIANGLES, circleIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  } 
}

function drawMoon(mMatrix, rotAngle) {
  // initialize the model matrix to identity matrix
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [1, 1, 1, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.1, 0.1, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  mMatrix = mat4.rotate(mMatrix, rotAngle, [0.0, 0.0, 1.0]);
  mMatrix = mat4.translate(mMatrix, [0.6, -0.8, 0]);
  pushMatrix(matrixStack, mMatrix);
  color = [1, 1, 1, 1];
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  mMatrix = mat4.scale(mMatrix, [0.005, 0.27, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
  mMatrix = popMatrix(matrixStack);
  
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  mMatrix = mat4.rotate(mMatrix, Math.PI / 2 + rotAngle, [0.0, 0.0, 1.0]);
  mMatrix = mat4.translate(mMatrix, [0.6, -0.8, 0]);
  pushMatrix(matrixStack, mMatrix);
  color = [1, 1, 1, 1];
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  mMatrix = mat4.scale(mMatrix, [0.005, 0.27, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
  mMatrix = popMatrix(matrixStack);
  
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  mMatrix = mat4.rotate(mMatrix, Math.PI / 4 + rotAngle, [0.0, 0.0, 1.0]);
  mMatrix = mat4.translate(mMatrix, [0.6, -0.8, 0]);
  pushMatrix(matrixStack, mMatrix);
  color = [1, 1, 1, 1];
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  mMatrix = mat4.scale(mMatrix, [0.005, 0.27, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
  mMatrix = popMatrix(matrixStack);
  
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  mMatrix = mat4.rotate(mMatrix, -Math.PI / 4 + rotAngle, [0.0, 0.0, 1.0]);
  mMatrix = mat4.translate(mMatrix, [0.6, -0.8, 0]);
  pushMatrix(matrixStack, mMatrix);
  color = [1, 1, 1, 1];
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.8, 0]);
  mMatrix = mat4.scale(mMatrix, [0.005, 0.27, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
  mMatrix = popMatrix(matrixStack);
}


function drawSky(mMatrix){
  // initialize the model matrix to identity matrix
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0, 0, 0, 1];  
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [0.0, 0.7, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [4.0, 1.5, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

function drawLand(mMatrix){
  // initialize the model matrix to identity matrix
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.2, 0.85, 0.5, 1];  
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [0.0, -0.75, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [4.0, -1.5, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

function drawClouds(mMatrix) {
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.8, 0.8, 0.8, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.88, 0.53, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.3, 0.16, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [1, 1, 1, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.6, 0.5, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.2, 0.1, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.8, 0.8, 0.8, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.38, 0.5, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.12, 0.06, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
} 

function drawStars(x_trans, y_trans, x_scale, y_scale, mMatrix, time){
  // blinking of the stars for animation
  const scaleFactor = 1.3 + Math.abs(0.6 * Math.sin(3 * time));

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [1, 1, 1, 1]
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans + y_scale * scaleFactor/2, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [x_scale * scaleFactor, y_scale * scaleFactor, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans - y_scale * scaleFactor/2, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [x_scale * scaleFactor, -(y_scale * scaleFactor), 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);  

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [x_trans - 2 * x_scale * scaleFactor, y_trans, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [y_scale * scaleFactor, x_scale * scaleFactor, 1.0]);
  mMatrix = mat4.rotate(mMatrix, Math.PI / 2, [0, 0, 1]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);    

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [x_trans + 2 * x_scale * scaleFactor, y_trans, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [y_scale * scaleFactor, x_scale * scaleFactor, 1.0]);
  mMatrix = mat4.rotate(mMatrix, -Math.PI / 2, [0, 0, 1]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);      
}

function drawMountains(x_trans, y_trans, x_scale, y_scale, mMatrix, dark, count){
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.82, 0.71, 0.55, 1.0];
  if(dark) color = [0.40, 0.26, 0.13, 1];
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans, 0]);
  // local scale operation for the triangle
  if(!dark && count==2) mMatrix = mat4.rotate(mMatrix, 6.4, [0, 0, 1]);
  mMatrix = mat4.scale(mMatrix, [x_scale, y_scale, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
  
}

function drawTrees(x_trans, y_trans, x_scale, y_scale, x_stem, y_stem, mMatrix){
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.55, 0.27, 0.07, 1];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [x_trans, 0.15, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [x_stem, y_stem, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.2, 0.5, 0.3, 1] ;
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [x_scale, y_scale, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);  

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.3, 0.63, 0.4, 1]; 
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans + 0.05, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [x_scale, y_scale, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);  

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.3, 0.75, 0.4, 1]; 
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans + 0.1, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [x_scale, y_scale, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}
function drawRiverLines(x_trans, y_trans, x_scale, y_scale, mMatrix){
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.8, 0.8, 0.8, 1];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [x_scale, y_scale, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

}
function drawRiver(mMatrix){
  // initialize the model matrix to identity matrix
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0, 0.4, 1, 1]; 
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [0.0, -0.17, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [4.0, -0.25, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

function drawHome(mMatrix){
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [1.0, 0.35, 0.0, 1];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [-0.575, -0.36, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.35, 0.2, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [-0.75, -0.36, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [0.3, 0.2, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [-0.4, -0.36, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [0.3, 0.2, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.9, 0.9, 0.8, 1];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [-0.575, -0.56, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.47, 0.2, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.9, 0.72, 0, 1];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [-0.72, -0.52, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.07, 0.07, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [-0.43, -0.52, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.07, 0.07, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [-0.575, -0.59, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.07, 0.14, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

function drawCar(mMatrix){
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.0, 0.1, 0.95, 0.8];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.52, -0.75, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.15, 0.1, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.6, 0.6, 0.6, 0.8];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [-0.52, -0.76, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.2, 0.12, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0, 0, 0, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.405, -0.9, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.04, 0.04, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.4, 0.4, 0.4, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.405, -0.9, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.032, 0.032, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0, 0, 0, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.635, -0.9, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.04, 0.04, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.4, 0.4, 0.4, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [-0.635, -0.9, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.032, 0.032, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.0, 0.3, 0.95, 0.8];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [-0.52, -0.825, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.37, 0.11, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.0, 0.3, 0.95, 0.8];
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [-0.705, -0.825, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [0.16, 0.11, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.0, 0.3, 0.95, 0.8];
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [-0.335, -0.825, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [0.16, 0.11, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

function drawRoad(mMatrix){
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0.1, 0.55, 0.1, 0.9];
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [0.65, -0.825, 0]);
  mMatrix = mat4.rotate(mMatrix, 1, [0, 0, 1]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [1.7, 2.2, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

function drawGrass(x_trans, y_trans, x_scale, y_scale, mMatrix){
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0, 0.7, 0, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [x_trans - (0.15 + x_scale), y_trans - 0.01, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.09 + x_scale, 0.075 + y_scale, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
  
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0, 0.4, 0, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [x_trans + 0.15 + x_scale, y_trans - 0.01, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.08 + x_scale, 0.065 + y_scale, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0, 0.53, 0, 1]; 
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.15 + x_scale, 0.1 + y_scale, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

function drawWindmill(x_trans, y_trans, y1_trans, x_scale, y_scale, x1_scale, y1_scale, fanRot, mMatrix){
  mat4.identity(mMatrix);
  pushMatrix(matrixStack, mMatrix);
  color = [0, 0, 0, 1];
  mMatrix = mat4.translate(mMatrix, [x_trans, y1_trans, 0]);
  mMatrix = mat4.scale(mMatrix, [x1_scale, y1_scale, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  color = [0.8, 0.75, 0.1, 1];
  for (let i = 0; i < 4; i++) {
    let angle = i * Math.PI / 2 + fanRot;
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [x_trans, y_trans, 0]);
    mMatrix = mat4.rotate(mMatrix, angle, [0, 0, 1]);
    mMatrix = mat4.translate(mMatrix, [-0.07 - 1.5*x_scale, -0.07 - 1.5*y_scale, 0.0]);
    mMatrix = mat4.rotate(mMatrix,  -Math.PI / 4, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.08 + 2*x_scale, 0.23 + 2*y_scale, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
  }

  pushMatrix(matrixStack, mMatrix);
  color = [0, 0, 0, 1];
  // local translation operation for the circle
  mMatrix = mat4.translate(mMatrix, [x_trans, y_trans, 0]);
  // local scale operation for the circle
  mMatrix = mat4.scale(mMatrix, [0.025 + x_scale, 0.025 + y_scale, 1.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);
}

function drawBoat(scaleFactor, distance, mMatrix, colorFlag){
  mat4.identity(mMatrix);
  mMatrix = mat4.translate(mMatrix, [distance, 0, 0]);

  pushMatrix(matrixStack, mMatrix);
  color = [0, 0, 0, 1];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [0 / scaleFactor, -0.02 / scaleFactor, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.01 / scaleFactor, 0.29 / scaleFactor, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [-0.05 / scaleFactor, -0.02 / scaleFactor, 0]);
  mMatrix = mat4.rotate(mMatrix, 5.9, [0, 0, 1]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.004 / scaleFactor, 0.29 / scaleFactor, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  color = [0.9, 0.9, 0.8, 1];
  // local translation operation for the square
  mMatrix = mat4.translate(mMatrix, [0 / scaleFactor, -0.175 / scaleFactor, 0]);
  // local scale operation for the square
  mMatrix = mat4.scale(mMatrix, [0.2 / scaleFactor, 0.07 / scaleFactor, 1.0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  color = [0.9, 0.9, 0.8, 1];
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [-0.1 / scaleFactor, -0.175 / scaleFactor, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [0.05 / scaleFactor, -0.07 / scaleFactor, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  color = [0.9, 0.9, 0.8, 1];
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [0.1 / scaleFactor, -0.175 / scaleFactor, 0]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [0.05 / scaleFactor, -0.07 / scaleFactor, 1.0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix(matrixStack);

  pushMatrix(matrixStack, mMatrix);
  // local translation operation for the triangle
  mMatrix = mat4.translate(mMatrix, [0.105 / scaleFactor, 0.01 / scaleFactor, 0]);
  mMatrix = mat4.rotate(mMatrix, Math.PI / 2, [0, 0, 1]);
  // local scale operation for the triangle
  mMatrix = mat4.scale(mMatrix, [0.23 / scaleFactor, -0.2 / scaleFactor, 1.0]);
  drawTriangle(colorFlag, mMatrix);
  mMatrix = popMatrix(matrixStack);

}
////////////////////////////////////////////////////////////////////////
function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0.95, 0.95, 0.95, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // stop the current loop of animation
  if (animation) {
      window.cancelAnimationFrame(animation);
  }

  function animate() {

    drawSky(mMatrix);
    
    rotAngle += 0.02; // For animation in moon
    fanRot += -0.05; // For animation in windmill
    distance0 += 0.01 * direction0; // For animation in boat
    distance1 += 0.01 * direction1; // For animation in boat
    if(Math.abs(distance0) > 0.75) direction0 *= -1;
    if(Math.abs(distance1) > 0.85) direction1 *= -1;
    drawMoon(mMatrix, rotAngle);
    drawClouds(mMatrix);
    const currentTime = performance.now() / 1000; // For animation in stars
    drawStars(-0.2, 0.6875, 0.005, 0.016, mMatrix, currentTime);
    drawStars(-0.1, 0.6, 0.005, 0.016, mMatrix, currentTime);
    drawStars(-0.13, 0.5, 0.004, 0.012, mMatrix, currentTime);
    drawStars(0.38, 0.8, 0.008, 0.025, mMatrix, currentTime);
    drawStars(0.55, 0.9, 0.0055, 0.0165, mMatrix, currentTime);
    drawMountains(-0.64, 0.09, 1, 0.23, mMatrix, 1, 2);
    drawMountains(-0.62, 0.09, 1, 0.23, mMatrix, 0, 2);
    drawMountains(0.05, 0.11, 1.4, 0.4, mMatrix, 1, 2);
    drawMountains(0.07, 0.11, 1.4, 0.4, mMatrix, 0, 2);
    drawMountains(0.8, 0.04, 1.3, 0.2, mMatrix, 0, 1);
    drawLand(mMatrix);
    drawTrees(0.8, 0.4, 0.4, 0.35, 0.045, 0.32, mMatrix);
    drawTrees(0.55, 0.45, 0.4, 0.35, 0.05, 0.32, mMatrix);
    drawTrees(0.35, 0.3, 0.3, 0.25, 0.04, 0.32, mMatrix);
    drawRoad(mMatrix);
    drawRiver(mMatrix);
    drawRiverLines(0.15, -0.105, 0.35, 0.004, mMatrix);
    drawRiverLines(-0.65, -0.17, 0.35, 0.004, mMatrix);
    drawRiverLines(0.72, -0.26, 0.35, 0.004, mMatrix);
    drawGrass(-0.2, -0.56, 0, 0, mMatrix);
    drawGrass(-0.86, -0.58, -0.02, -0.02, mMatrix);
    drawGrass(0, -1.05, 0.03, 0.03, mMatrix);
    drawGrass(1, -0.5, 0.01, 0.01, mMatrix);
    drawHome(mMatrix);
    drawCar(mMatrix);
    color = [0.5, 0, 1, 1];
    drawBoat(2, distance1, mMatrix, color);
    color = [1, 0, 0, 1];
    drawBoat(1, distance0, mMatrix, color);
    drawWindmill(0.48, 0.07, -0.15, 0, 0, 0.025, 0.4, fanRot, mMatrix);
    drawWindmill(0.65, 0.06, -0.2, 0.01, 0.01, 0.03, 0.55, fanRot, mMatrix);
   
    animation = window.requestAnimationFrame(animate);
  }
  animate();
}

// This is the entry point from the html
function webGLStart() {
  var canvas = document.getElementById("scenery");
  initGL(canvas);
  shaderProgram = initShaders();

  //get locations of attributes declared in the vertex shader
  const aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");

  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);

  uColorLoc = gl.getUniformLocation(shaderProgram, "color");

  initSquareBuffer();
  initTriangleBuffer();
  initCircleBuffer();

  drawScene();
}

function changeMode(modeType) {
  mode = modeType;
  drawScene();
}
