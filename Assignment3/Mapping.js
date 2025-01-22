// ////////////////////////////////////////////////////////////////////////
// //  Texture Mapping and Cubemap Environment Mapping
// //
var gl;
var canvas;
var matrixStack = [];

var degree0 = 0.0;
var degree1 = 0.0;

var prevMouseX = 0;
var prevMouseY = 0;

var aPositionLocation;
var aNormalLocation;
var aTexCoordLocation;  
var uEyePosLocation;
var uLightPositionLocation;
var uObjColorLocation;
var uVMatrixLocation;
var uMMatrixLocation;
var uPMatrixLocation;
var uWNMatrixLocation;

var teaPotBuf;
var teaPotNormalBuf;
var teaPotIndexBuf;
var teaPotTexBuf;
var cubeBuf;
var cubeIndexBuf;
var cubeNormalBuf;
var cubeTexBuf;
var spBuf;
var spIndexBuf;
var spNormalBuf;
var spTexBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];
var spTexCoords = [];

var uLPosition = [-1, 2.5, 4];
var objColor = [1.0, 1.0, 1.0];
var eyePos = [-0.8, 1.3, 5];

var cubeMapTexture;
var uTextureLocation;
var uTexture2DLocation;

var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var wNMatrix = mat4.create(); // model matrix in world space

var teaPotJSON = "./texture_and_other_files/teapot.json";
var posx, posy, posz, negx, negy, negz;

var posxFile = "./texture_and_other_files/Field/posx.jpg";
var posyFile = "./texture_and_other_files/Field/posy.jpg";
var poszFile = "./texture_and_other_files/Field/posz.jpg";
var negxFile = "./texture_and_other_files/Field/negx.jpg";
var negyFile = "./texture_and_other_files/Field/negy.jpg";
var negzFile = "./texture_and_other_files/Field/negz.jpg";

var woodTexture;
var cubeTexture;
var earthTexture;
var cubeTextureFile = "./texture_and_other_files/fence_alpha.png";
var woodTextureFile = "./texture_and_other_files/wood_texture.jpg"
var earthTextureFile = "./texture_and_other_files/earthmap.jpg"

var refract = false; 

// Phong vertex shader code
const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoords;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform mat4 uWNMatrix;

out vec3 normalEyeSpace;
out vec3 vPosInEyeSpace;
out vec3 vWorldPos;
out vec3 vWorldNormal;
out vec2 fragTexCoord;

void main() {
    mat4 projectionModelView=uPMatrix*uVMatrix*uMMatrix;
    gl_Position = projectionModelView*vec4(aPosition,1.0);
    gl_PointSize = 1.0;
    normalEyeSpace = normalize(mat3(uVMatrix * uMMatrix) * aNormal);
    vPosInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;
    vWorldPos = mat3(uMMatrix) * aPosition;
    vWorldNormal = normalize(mat3(uWNMatrix) * aNormal) ;
    fragTexCoord = aTexCoords;
}`;

// Phong fragment shader code
const fragShaderCode = `#version 300 es
precision highp float;
in mat4 vMatrix;
in vec3 vPosInEyeSpace;
in vec3 normalEyeSpace;
in vec3 vWorldPos;
in vec3 vWorldNormal;
in vec2 fragTexCoord;

uniform vec3 objColor;
uniform vec3 uLPosition;
uniform vec3 eyePos;
uniform samplerCube cubeMap;
uniform sampler2D imageTexture;
uniform float uReflection;     
uniform bool uRefract; 

out vec4 fragColor;

void main() {
    // light vector
    vec3 lVector = normalize(uLPosition - vPosInEyeSpace); 
    // view vector
    vec3 vVector = normalize(-vPosInEyeSpace);
    vec3 eyeToSurfaceDirec = normalize(vWorldPos - eyePos);
    // reflection vector
    vec3 refVector = reflect(eyeToSurfaceDirec, vWorldNormal);
    // refraction vector
    vec3 rVector = refract(eyeToSurfaceDirec, vWorldNormal, 0.99);
    vec3 amb = 0.15 * vec3(1.0, 1.0, 1.0);
    vec3 diff = max(dot(normalEyeSpace, lVector), 0.0) * objColor;
    vec3 spec = pow(max(dot(rVector, vVector), 0.0), 32.0) * vec3(1.0, 1.0, 1.0);
    vec4 fColor = vec4(amb + diff + spec, 1.0);
    vec4 cubeMapReflectColor = vec4(0,0,0,0);
    if (uRefract) {
        cubeMapReflectColor = texture(cubeMap, rVector);
    }
    else {
        cubeMapReflectColor = texture(cubeMap, refVector);
    }
    vec4 textureColor =  texture(imageTexture, fragTexCoord); 
    vec4 reflectColor = cubeMapReflectColor + fColor;
    fragColor = mix(textureColor, reflectColor, uReflection);
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

function initTextures(textureFile) {
  var tex = gl.createTexture();
  tex.image = new Image();
  tex.image.src = textureFile;
  tex.image.onload = function () {
      handleTextureLoaded(tex);
  };
  return tex;
}

function handleTextureLoaded(texture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D, // 2D texture
    0, // mipmap level
    gl.RGBA, // internal format
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type of data
    texture.image // array or <img>
  );

  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );

  drawScene();
}

function initCubeMap() {
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

  const faceInfo = [
    {target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, url: posxFile,},
    {target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, url: negxFile,},
    {target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, url: posyFile,},
    {target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, url: negyFile,},
    {target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, url: poszFile,},
    {target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, url: negzFile,},
  ]
  cubeMapTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);

  faceInfo.forEach((faceInfo) => {
      const { target, url } = faceInfo;
      gl.texImage2D(target, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

      const image = new Image();
      image.src = url;
      image.addEventListener('load', function () {
          gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);
          gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
          drawScene();
      });
  });
};

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
      var utex = 1 - j / nstacks;
      var vtex = 1 - i / nslices;

      spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
      spNormals.push(xcood, ycoord, zcoord);
      spTexCoords.push(utex, vtex);
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

  spTexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spTexCoords), gl.STATIC_DRAW);
  spTexBuf.itemSize = 2;
  spTexBuf.numItems = spTexCoords.length / 2;
}

function drawSphere(tex) {

  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.vertexAttribPointer(aPositionLocation, spBuf.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.vertexAttribPointer(aNormalLocation, spNormalBuf.itemSize, gl.FLOAT, false, 0, 0);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
  gl.vertexAttribPointer(aTexCoordLocation, spTexBuf.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
  gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

  gl.uniform3fv(uEyePosLocation, eyePos);
  gl.uniform3fv(uLightPositionLocation, uLPosition);
  gl.uniform3fv(uObjColorLocation, objColor);

  gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture); 
  gl.uniform1i(uTextureLocation, 0);

  gl.activeTexture(gl.TEXTURE1); 
  gl.uniform1i(uTexture2DLocation, 1);

  if (tex > 0) {
      gl.bindTexture(gl.TEXTURE_2D, earthTexture); 
      gl.uniform1f(reflectLocation, 0.0);  
  }
  else if (tex == 0) {
      gl.bindTexture(gl.TEXTURE_2D, woodTexture); 
      gl.uniform1f(reflectLocation, 0.0);  
  }
  else {
      gl.bindTexture(gl.TEXTURE_2D, null); 
      gl.uniform1f(reflectLocation, 1.0);  
  }
  gl.uniform1i(refractLocation, 0); 
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

  var texCoords = [
      // Front face
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Back face
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Top face
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Bottom face
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Right face
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Left face
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
  ];
  cubeTexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
  cubeTexBuf.itemSize = 2;
  cubeTexBuf.numItems = texCoords.length / 2;

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

function drawCube(tex, ref, textureUnit, num, textureFile) {

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
  gl.vertexAttribPointer(aPositionLocation, cubeBuf.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
  gl.vertexAttribPointer(aNormalLocation, cubeNormalBuf.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
  gl.vertexAttribPointer(aTexCoordLocation, cubeTexBuf.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
  gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

  gl.uniform3fv(uEyePosLocation, eyePos);
  gl.uniform3fv(uLightPositionLocation, uLPosition);
  gl.uniform3fv(uObjColorLocation, objColor);

  gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture); 
  gl.uniform1i(uTextureLocation, 0);

  gl.activeTexture(textureUnit); 
  gl.uniform1i(uTexture2DLocation, num);

  if (tex > 0) {
      gl.bindTexture(gl.TEXTURE_2D, textureFile); 
      gl.uniform1f(reflectLocation, 0.0);  
  }
  else if (tex == 0) {
      gl.bindTexture(gl.TEXTURE_2D, textureFile); 
      gl.uniform1f(reflectLocation, 0.0);  
  }
  else {
      gl.bindTexture(gl.TEXTURE_2D, null); 
      gl.uniform1f(reflectLocation, 1.0);  
  }

  if (ref > 0) {
      refract = true;
      gl.uniform1i(refractLocation, refract ? 1 : 0); 
  }
  else {
      refract = false;
      gl.uniform1i(refractLocation, refract ? 1 : 0); 
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

    teaPotTexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teaPotTexBuf);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(data.vertexTextureCoords),
        gl.STATIC_DRAW
    );
    teaPotTexBuf.itemSize = 2;
    teaPotTexBuf.numItems = data.vertexTextureCoords.length / 2;

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

function drawTeaPot() {
    gl.bindBuffer(gl.ARRAY_BUFFER, teaPotBuf);
    gl.vertexAttribPointer(
        aPositionLocation,
        teaPotBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
        
    gl.bindBuffer(gl.ARRAY_BUFFER, teaPotNormalBuf);
    gl.vertexAttribPointer(
        aNormalLocation,
        teaPotNormalBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, teaPotTexBuf);
    gl.vertexAttribPointer(
        aTexCoordLocation,
        teaPotTexBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teaPotIndexBuf);
    
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
    gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

    gl.uniform3fv(uEyePosLocation, eyePos);
    gl.uniform3fv(uLightPositionLocation, uLPosition);

    gl.uniform3fv(uObjColorLocation, objColor);

    gl.activeTexture(gl.TEXTURE0); 
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture); 
    gl.uniform1i(uTextureLocation, 0); 

    gl.activeTexture(gl.TEXTURE1); 
    gl.bindTexture(gl.TEXTURE_2D, null); 
    gl.uniform1i(uTexture2DLocation, 1); 

    gl.uniform1f(reflectLocation, 1.0);  
    
    gl.uniform1i(refractLocation, 0); 

    gl.drawElements(
        gl.TRIANGLES,
        teaPotIndexBuf.numItems,
        gl.UNSIGNED_INT,
        0
    );
}

function drawSkyBox() {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-200, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(90), [1, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    drawCube(1, 0, gl.TEXTURE1, 1, negx);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [200, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    drawCube(1, 0, gl.TEXTURE1, 1, posx);
    mMatrix = popMatrix(matrixStack);
    
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -200, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(90), [0, 1, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    drawCube(1, 0, gl.TEXTURE3, 3, negy);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 200, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    drawCube(1, 0, gl.TEXTURE4, 4, posy);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0, -200]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]); 
    drawCube(1, 0, gl.TEXTURE5, 5, negz);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0, 200]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    drawCube(1, 0, gl.TEXTURE6, 6, posz);
    mMatrix = popMatrix(matrixStack);
}

function drawTable() {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.2, -1.3, -1]);
    mMatrix = mat4.scale(mMatrix, [9,0.05, 6]);
    objColor = [0, 0, 0];
    drawSphere(0);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1.9, -2.8, -0.7]);
    mMatrix = mat4.scale(mMatrix, [0.25, 3, 0.25]);
    drawCube(0, 1, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [2.8, -2.8, -0.2]);
    mMatrix = mat4.scale(mMatrix, [0.35, 3, 0.35]);
    drawCube(0, 1, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-2.8, -2.8, 0.8]);
    mMatrix = mat4.scale(mMatrix, [0.35, 3, 0.35]);
    drawCube(0, 1, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1.9, -2.8, -0.8]);
    mMatrix = mat4.scale(mMatrix, [0.25, 3, 0.25]);
    drawCube(0, 1, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(matrixStack);
}

function drawFencedCube() {
    pushMatrix(matrixStack, mMatrix);
    objColor = [0, 0, 0];
    mMatrix = mat4.translate(mMatrix, [1.6, -0.8, -0.6]);
    mMatrix = mat4.scale(mMatrix, [0.95, 0.95, 0.95]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawCube(1, 1, gl.TEXTURE1, 1, cubeTexture);
    gl.disable(gl.BLEND);
    mMatrix = popMatrix(matrixStack);
}

function drawSpheres() {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.1, -0.7, 0.7]);
    mMatrix = mat4.scale(mMatrix, [1.2, 1.2, 1.2]);
    objColor = [0.06, 0.2, 0.88];
    drawSphere(1);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    objColor = [0, 0, 0];
    mMatrix = mat4.translate(mMatrix, [1.6, -0.8, -0.6]);
    mMatrix = mat4.scale(mMatrix, [0.95, 0.95, 0.95]);
    drawSphere(-1);
    mMatrix = popMatrix(matrixStack);
}

function drawMirroredCube() {
    pushMatrix(matrixStack, mMatrix);
    objColor = [0, 0, 0];
    mMatrix = mat4.translate(mMatrix, [-1.6, -0.63, -0.4]);
    mMatrix = mat4.scale(mMatrix, [0.6, 1.3, 0.4]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-5), [0, 1, 0]);
    drawCube(-1, 1, gl.TEXTURE1, 1, null);
    mMatrix = popMatrix(matrixStack);
}

function drawTeapot() {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.37, -1.9]);
    mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 0.12]);
    objColor = [0.0, 0.0, 0.0];
    drawTeaPot();
    mMatrix = popMatrix(matrixStack);
}

function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0.8, 0.8, 0.8, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  mat4.identity(mMatrix);
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, [0, 0, 0], [0, 1, 0], vMatrix);

  mat4.identity(pMatrix);
  mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);

  drawSkyBox();
  
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0), [0, 1, 0]);

  drawTeapot();
  drawSpheres();
  drawFencedCube();
  drawMirroredCube();
  drawTable();
}    


// Movement of the objects
function onMouseDown(event) {
  isAnimating = false;
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
      var diffX = mouseX - prevMouseX;
      degree0 = degree0 + diffX / 5;
      prevMouseX = mouseX;

      var mouseY = canvas.height - event.clientY;
      var diffY = mouseY - prevMouseY;
      degree1 = degree1 - diffY / 5;
      prevMouseY = mouseY;

      drawScene();
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
  canvas = document.getElementById("mapping");
  document.addEventListener("mousedown", onMouseDown, false);

  initGL(canvas);
  shaderProgram = initShaders(vertexShaderCode, fragShaderCode);

  gl.enable(gl.DEPTH_TEST);

  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  aTexCoordLocation = gl.getAttribLocation(shaderProgram, "aTexCoords");

  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uWNMatrixLocation = gl.getUniformLocation(shaderProgram, "uWNMatrix");
  uEyePosLocation = gl.getUniformLocation(shaderProgram, "eyePos");
  uLightPositionLocation = gl.getUniformLocation(shaderProgram, 'uLPosition');
  uObjColorLocation = gl.getUniformLocation(shaderProgram, 'objColor');

  reflectLocation = gl.getUniformLocation(shaderProgram, 'uReflection');
  refractLocation = gl.getUniformLocation(shaderProgram, 'uRefract');

  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);
  gl.enableVertexAttribArray(aTexCoordLocation);

  uTextureLocation = gl.getUniformLocation(shaderProgram, "cubeMap");
  uTexture2DLocation = gl.getUniformLocation(shaderProgram, "imageTexture")

  initTeaPot();

  initCubeMap();
  posx = initTextures(posxFile);
  posy = initTextures(posyFile);
  posz = initTextures(poszFile);
  negz = initTextures(negzFile);
  negx = initTextures(negxFile);
  negy = initTextures(negyFile);

  woodTexture = initTextures(woodTextureFile);
  cubeTexture = initTextures(cubeTextureFile);
  earthTexture = initTextures(earthTextureFile);

  initSphereBuffer();
  initCubeBuffer();
}
