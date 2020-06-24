
var PointerLockControls = function (camera, cannonBody) {

    var velocityFactor = 0.2;
    var jumpVelocity = 20;
    var scope = this;

    var pitchObject = new THREE.Object3D();
    pitchObject.add(camera);

    var yawObject = new THREE.Object3D();
    yawObject.position.y = 2;
    yawObject.add(pitchObject);

    var quat = new THREE.Quaternion();

    var enter = false;
    var moveForward = false;
    var moveBackward = false;
    var moveLeft = false;
    var moveRight = false;

    var canJump = false;

    var contactNormal = new CANNON.Vec3(); // Normal in the contact, pointing *out* of whatever the player touched
    var upAxis = new CANNON.Vec3(0, 1, 0);
    cannonBody.addEventListener("collide", function (e) {
        var contact = e.contact;

        // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
        // We do not yet know which one is which! Let's check.
        if (contact.bi.id == cannonBody.id)  // bi is the player body, flip the contact normal
            contact.ni.negate(contactNormal);
        else
            contactNormal.copy(contact.ni); // bi is something else. Keep the normal as it is

        // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
        if (contactNormal.dot(upAxis) > 0.5) // Use a "good" threshold value between 0 and 1 here!
            canJump = true;
    });

    var velocity = cannonBody.velocity;

    var PI_2 = Math.PI / 2;

    var onMouseMove = function (event) {

        if (scope.enabled === false) return;

        var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        yawObject.rotation.y -= movementX * 0.002;
        pitchObject.rotation.x -= movementY * 0.002;

        pitchObject.rotation.x = Math.max(-PI_2, Math.min(PI_2, pitchObject.rotation.x));
    };

    var onKeyDown = function (event) {

        switch (event.keyCode) {

            case 13: // enter
                enter = true;

            case 38: // up
            case 87: // w
                moveForward = true;
                break;

            case 37: // left
            case 65: // a
                moveLeft = true;
                break;

            case 40: // down
            case 83: // s
                moveBackward = true;
                break;

            case 39: // right
            case 68: // d
                moveRight = true;
                break;
        }

    };

    var onKeyUp = function (event) {

        switch (event.keyCode) {

            case 13: // enter
                enter = false;

            case 38: // up
            case 87: // w
                moveForward = false;
                break;

            case 37: // left
            case 65: // a
                moveLeft = false;
                break;

            case 40: // down
            case 83: // a
                moveBackward = false;
                break;

            case 39: // right
            case 68: // d
                moveRight = false;
                break;

        }

    };

    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    this.enabled = false;

    this.getObject = function () {
        return yawObject;
    };

    var focused = false;

    // Moves the camera to the Cannon.js object position and adds velocity to the object if the run key is down
    var inputVelocity = new THREE.Vector3();
    var euler = new THREE.Euler();
    this.update = function (delta) {

        if (scope.enabled === false) return;

        delta *= 0.1;

        inputVelocity.set(0, 0, 0);

        // start conversation("enter")

        // enter for starting input
        if(focused === false && enter){
            document.getElementById('question-input').focus();
            enter = false;
            focused = true;
        }

        if(focused === true && enter && question && question.length > 0){
            enter = false;
            focused = false;
            fetchBotResponse(question);
            document.getElementById("question").innerText = question;
            document.getElementById("question-input").value = "";
            document.activeElement.blur();
            question = "";
        }

        if(focused === false){
            if (moveForward) {
                inputVelocity.z = -velocityFactor * delta;
            }
            if (moveBackward) {
                inputVelocity.z = velocityFactor * delta;
            }

            if (moveLeft) {
                inputVelocity.x = -velocityFactor * delta;
            }
            if (moveRight) {
                inputVelocity.x = velocityFactor * delta;
            }
        }

        // Convert velocity to world coordinates
        euler.x = pitchObject.rotation.x;
        euler.y = yawObject.rotation.y;
        euler.order = "XYZ";
        quat.setFromEuler(euler);
        inputVelocity.applyQuaternion(quat);
        //quat.multiplyVector3(inputVelocity);

        // Add to the object
        velocity.x += inputVelocity.x;
        velocity.z += inputVelocity.z;

        yawObject.position.copy(cannonBody.position);
    };
};

// code start

var sphereShape, sphereBody, world, physicsMaterial, walls = [], balls = [], ballMeshes = [], boxes = [],
    boxMeshes = [];

var camera, scene, renderer;
var geometry, material, mesh;
var controls, time = Date.now();

var blocker = document.getElementById('blocker');
var instructions = document.getElementById('instructions');

var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

var action, mixer, clock, animations;

var answer = "Ready to answer";
var question = "";

var actionList = ["Dance", "Death", "Idle", "Jump", "No",
"Punch", "Running", "Sitting", "Standing", "ThumbsUp", "Walking",
"WalkJump", "Wave", "Yes"];

var emotionIndex = 0;

if (havePointerLock) {

    var element = document.body;

    var pointerlockchange = function (event) {

        if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {

            controls.enabled = true;

            blocker.style.display = 'none';


        } else {
            controls.enabled = false;
        }
    }

    var pointerlockerror = function (event) {
        instructions.style.display = '';
    }

    // Hook pointer lock state change events
    document.addEventListener('pointerlockchange', pointerlockchange, false);
    document.addEventListener('mozpointerlockchange', pointerlockchange, false);
    document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

    document.addEventListener('pointerlockerror', pointerlockerror, false);
    document.addEventListener('mozpointerlockerror', pointerlockerror, false);
    document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

    instructions.addEventListener('click', function (event) {

        document.getElementById('ui').style = "border: #006400 3px solid; background: rgba(0,0,0,0.1); display: auto;"

        instructions.style.display = 'none';

        // Ask the browser to lock the pointer
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

        if (/Firefox/i.test(navigator.userAgent)) {

            var fullscreenchange = function (event) {

                if (document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element) {

                    document.removeEventListener('fullscreenchange', fullscreenchange);
                    document.removeEventListener('mozfullscreenchange', fullscreenchange);

                    element.requestPointerLock();
                }
            }

            document.addEventListener('fullscreenchange', fullscreenchange, false);
            document.addEventListener('mozfullscreenchange', fullscreenchange, false);

            element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;

            element.requestFullscreen();

        } else {

            element.requestPointerLock();

        }

    }, false);

} else {

    instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';

}

renderRandomEmotion();
initCannon();
init();
animate();

function renderRandomEmotion() {
    const min = 0;
    const max = 5;
    emotionIndex = Math.floor(Math.random() * (max - min)) + min;
    document.getElementById("button-" + emotionIndex).style = "border : 3px solid black";
}

function onchangeQuestionInput() {
    question = document.getElementById("question-input").value;
}

function fetchBotResponse(question) {
    document.getElementById('answer').innerText = "I'm thinking...";
    axios.post('http://172.17.0.2:8080/cakechat_api/v1/actions/get_response', {
        "context" : [ question ],
        "emotion" : "joy"
    })
        .then(function (response) {
            answer = response.data.response;
            document.getElementById('answer').innerHTML = answer;
        })
        .catch(function (error) {
            console.log(error);
        });
}

function initCannon() {

    // Setup our world
    world = new CANNON.World();
    world.quatNormalizeSkip = 0;
    world.quatNormalizeFast = false;

    var solver = new CANNON.GSSolver();

    world.defaultContactMaterial.contactEquationStiffness = 1e9;
    world.defaultContactMaterial.contactEquationRelaxation = 4;

    solver.iterations = 7;
    solver.tolerance = 0.1;
    var split = true;
    if (split)
        world.solver = new CANNON.SplitSolver(solver);
    else
        world.solver = solver;

    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();

    // Create a slippery material (friction coefficient = 0.0)
    physicsMaterial = new CANNON.Material("slipperyMaterial");
    var physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial,
        physicsMaterial,
        0.0, // friction coefficient
        0.3  // restitution
    );
    // We must add the contact materials to the world
    world.addContactMaterial(physicsContactMaterial);

    // Create a sphere
    var mass = 5, radius = 1.3;
    sphereShape = new CANNON.Sphere(radius);
    sphereBody = new CANNON.Body({mass: mass});
    sphereBody.addShape(sphereShape);
    sphereBody.position.set(0, 5, 0);
    sphereBody.linearDamping = 0.9;
    world.add(sphereBody);

    // Create a plane
    var groundShape = new CANNON.Plane();
    var groundBody = new CANNON.Body({mass: 0});
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.add(groundBody);
}

function init() {

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 0, 500);

    var ambient = new THREE.AmbientLight(0x111111);
    scene.add(ambient);

    // lights

    var light = new THREE.HemisphereLight(0xffffff, 0x444444);
    light.position.set(0, 20, 0);
    scene.add(light);

    light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 20, 10);
    scene.add(light);

    controls = new PointerLockControls(camera, sphereBody);
    scene.add(controls.getObject());

    // floor
    geometry = new THREE.PlaneGeometry(300, 300, 50, 50);
    geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

    material = new THREE.MeshLambertMaterial({color: 0xeeee00});

    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.shadowMap.enabled = true;
    renderer.shadowMapSoft = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(scene.fog.color, 1);

    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);

    // model
    var loader = new THREE.GLTFLoader();

    var pos = [{x: 5, y: 0, z: -1}, {x: -3, y: 0, z: -2}, {x: 4, y: 0, z: -3}]

    for (let i = 0; i < 1; i++) {

        loader.load('./model/RobotExpressive.glb', function (gltf) {
            model = gltf.scene;

            model.position.set(pos[i].x, pos[i].y, pos[i].z)

            scene.add(model);

            animations = gltf.animations;

            mixer = new THREE.AnimationMixer( model );
            
            let selectedAction = "";

            switch (parseInt(emotionIndex)) {
                case 0:
                    selectedAction = "Walking"
                    break;
                case 1:
                    selectedAction = "Punch"
                    break;
                case 2:
                    selectedAction = "Dance"
                    break;
                case 3:
                    selectedAction = "Idle"
                    break;
                case 4:
                    selectedAction = "Idle"
                    break;
            }

            const actionIndex = actionList.findIndex(action => action === selectedAction);

            console.log(actionIndex);

            action = mixer.clipAction( animations[ actionIndex ] );

            action.play();

            animate();

        }, undefined, function (e) {
            console.error(e);
        });
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {

    // render loop

    var dt = clock.getDelta();

    if ( mixer ) mixer.update( dt );
    requestAnimationFrame(animate);

    if (controls.enabled) {
        world.step(dt);
    }

    controls.update(Date.now() - time);
    renderer.render(scene, camera);
    time = Date.now();
}
