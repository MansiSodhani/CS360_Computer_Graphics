// ////////////////////////////////////////////////////////////////////////
// //  Ray Tracing
// //
var gl;
var canvas;

var aPositionLocation;
var uLightPositionLocation;
var uResolutionLocation;
var uShadingMode;
var buf;

var uLPosition = [0.0, 2.0, 8.5];
var mode = 4;

const vertexShaderCode = `#version 300 es
in vec3 aPosition;
void main() {
    gl_Position = vec4(aPosition,1.0);
}`;

const fragShaderCode = `#version 300 es
precision mediump float;

uniform vec3 uLPosition;
uniform int uMode;
uniform vec2 uResolution;

out vec4 fragColor;

struct Sphere {
    vec3 center;
    float radius;
    vec3 color;
    float shininess;
};

struct Ray {
    vec3 origin;
    vec3 direction;
};

float intersectWithSphere(Ray ray, Sphere sphere) {
    float a = dot(ray.direction, ray.direction);
    float b = 2.0 * dot(ray.origin - sphere.center, ray.direction);
    float c = dot(ray.origin - sphere.center, ray.origin - sphere.center) - sphere.radius * sphere.radius;
    float disc = b * b - 4.0 * a * c;

    if (disc < 0.0) {
        return 0.0; 
    } 
    else {
        float t0 = (-b - sqrt(disc)) / (2.0 * a);
        float t1 = (-b + sqrt(disc)) / (2.0 * a);
        return min(t0, t1);
    }
}
    
void main() {
    vec2 screenPos = gl_FragCoord.xy / uResolution;

    vec3 cameraPos = vec3(0.0, 0.0, 1.0);
    vec3 cameraDirec = normalize(vec3(screenPos * 2.0 - 1.0, -1.0));
   
    Sphere spheres[7];
    spheres[0] = Sphere(vec3(-0.25, -0.08, -0.05), 0.19, vec3(0.6, 0.0, 0.8), 100000.0);
    spheres[1] = Sphere(vec3(-0.3, 0.15, 0.1), 0.16, vec3(0.3, 0.0, 0.8), 10.0);
    spheres[2] = Sphere(vec3(-0.08,  0.28, 0.2), 0.15, vec3(0.0, 0.0, 0.9), 20.0);
    spheres[3] = Sphere(vec3(0.1, 0.17, 0.4), 0.12, vec3(0.0, 0.5, 0.8), 10.0);
    spheres[4] = Sphere(vec3(0.18, -0.03, 0.4), 0.12,vec3(0.2, 0.8, 0.8), 10.0);
    spheres[5] = Sphere(vec3(0.08, -0.24, 0.4), 0.12,vec3(0.3, 0.62, 0.4), 10.0);
    spheres[6] = Sphere(vec3(-0.1, -0.25, 0.5), 0.1, vec3(0.2, 0.95, 0.0), 10.0);

    vec3 refColor = vec3(0.0);
    
    Ray ray = Ray(cameraPos, cameraDirec);

    bool insideShadow = false;

    for (int bounce = 0; bounce <= 1; bounce++) {
        float lim = 1e6; 
        int nearestSphereInd = -1;

        for (int i = 0; i < 7; i++) {
            if (intersectWithSphere(ray, spheres[i]) > 0.0  && intersectWithSphere(ray, spheres[i]) < lim) {
                lim = intersectWithSphere(ray, spheres[i]);
                nearestSphereInd = i;
            }
        }

        if (nearestSphereInd == -1) {
            break;  
        }
        
        vec3 pointOfIntersection = ray.origin + lim * ray.direction;
        vec3 normal = normalize(pointOfIntersection - spheres[nearestSphereInd].center);
        vec3 lVector = normalize(uLPosition - pointOfIntersection);
        vec3 vVector = normalize(cameraPos - pointOfIntersection);
        vec3 rVector = reflect(ray.direction, normal);

        if (uMode == 1 || uMode == 3) {
            if (bounce == 1){
                break;
            }
        }

        vec3 amb = 0.15 * spheres[nearestSphereInd].color;
        vec3 diff = max(dot(normal, lVector), 0.0) * spheres[nearestSphereInd].color;
        vec3 r_Vector = reflect(-lVector, normal);
        vec3 spec = pow(max(dot(vVector, r_Vector), 0.0), spheres[nearestSphereInd].shininess) * vec3(1.0);
        refColor += amb + diff + spec;
            
        if (uMode == 2 || uMode == 4) {
            ray.origin = pointOfIntersection + 0.002 * normal;
            ray.direction = rVector;
        }

        if (uMode == 3 || uMode == 4) {
            bool flag = false;
            for (int i = 0; i < 7; i++) {
                if (i == nearestSphereInd) continue;
                if (intersectWithSphere(Ray(pointOfIntersection, lVector), spheres[i]) > 0.0) {
                    flag = true; 
                }
            }
            if (flag==true && bounce == 0) {
                refColor = vec3(0.1);
                insideShadow = true;
            }
        }   
    }

    fragColor = vec4(refColor, 1.0);
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
  
function initBuffer(){
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const bufData = new Float32Array([
    -1, 1, 0, 1, 1, 0, -1, -1, 0, -1, -1, 0, 1, 1, 0, 1, -1, 0,]);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bufData), gl.STATIC_DRAW);
}

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    color = [1.0, 0.0, 0.0];
    gl.uniform3fv(uLightPositionLocation, uLPosition);
    gl.uniform1i(uShadingMode, mode);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(aPositionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);    
}

function webGLStart() {
    canvas = document.getElementById("ray_tracing");
    initGL(canvas);
    shaderProgram = initShaders(vertexShaderCode, fragShaderCode);
    gl.enable(gl.DEPTH_TEST);
  
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    uLightPositionLocation = gl.getUniformLocation(shaderProgram, 'uLPosition');
    uShadingMode = gl.getUniformLocation(shaderProgram, 'uMode');
    uResolutionLocation = gl.getUniformLocation(shaderProgram, 'uResolution');
    gl.uniform2f(uResolutionLocation, canvas.width, canvas.height);

    gl.enableVertexAttribArray(aPositionLocation);
    document.getElementById("light_slider").addEventListener("input", (event) => {
        uLPosition[0] = parseFloat(event.target.value);
        drawScene();
    });

    document.getElementById("modePhong").addEventListener("click", (event) => {
        mode = 1;
        drawScene();
    });

    document.getElementById("modePhongReflection").addEventListener("click", (event) => {
        mode = 2;
        drawScene();
    });

    document.getElementById("modePhongShadow").addEventListener("click", (event) => {
        mode = 3;
        drawScene();
    });

    document.getElementById("modePhongShadowReflection").addEventListener("click", (event) => {
        mode = 4;
        drawScene();
    });

    initBuffer();
    drawScene();
}