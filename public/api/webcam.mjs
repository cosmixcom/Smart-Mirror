import * as faceapi from "./script.mjs";

const loadingScreen = document.getElementById("loading-screen");

// configuration options
const modelPath =
  "https://raw.githubusercontent.com/vladmandic/face-api/refs/heads/master/model/";
const minScore = 0.2;
const maxResults = 5;
let optionsSSDMobileNet;

function str(json) {
  let text = '<font color="lightblue">';
  text += json
    ? JSON.stringify(json)
        .replace(/{|}|"|\[|\]/g, "")
        .replace(/,/g, ", ")
    : "";
  text += "</font>";
  return text;
}

function log(...txt) {
  // console.log(...txt);
  // const div = document.getElementById('log');
  // if (div) div.innerHTML += `<br>${txt}`;
}

// helper function to draw detected faces
function drawFaces(canvas, data, fps) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // draw title
  ctx.font = 'small-caps 20px "Segoe UI"';
  ctx.fillStyle = "white";
  ctx.fillText(`FPS: ${fps}`, 10, 25);
  for (const person of data) {
    // draw box around each face
    ctx.lineWidth = 3;
    ctx.strokeStyle = "deepskyblue";
    ctx.fillStyle = "deepskyblue";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.rect(
      person.detection.box.x,
      person.detection.box.y,
      person.detection.box.width,
      person.detection.box.height,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
    // draw text labels
    const expression = Object.entries(person.expressions).sort(
      (a, b) => b[1] - a[1],
    );
    ctx.fillStyle = "black";
    ctx.fillText(
      `gender: ${Math.round(100 * person.genderProbability)}% ${person.gender}`,
      person.detection.box.x,
      person.detection.box.y - 59,
    );
    ctx.fillText(
      `expression: ${Math.round(100 * expression[0][1])}% ${expression[0][0]}`,
      person.detection.box.x,
      person.detection.box.y - 41,
    );
    ctx.fillText(
      `age: ${Math.round(person.age)} years`,
      person.detection.box.x,
      person.detection.box.y - 23,
    );
    ctx.fillText(
      `roll:${person.angle.roll}° pitch:${person.angle.pitch}° yaw:${person.angle.yaw}°`,
      person.detection.box.x,
      person.detection.box.y - 5,
    );
    ctx.fillStyle = "lightblue";
    ctx.fillText(
      `gender: ${Math.round(100 * person.genderProbability)}% ${person.gender}`,
      person.detection.box.x,
      person.detection.box.y - 60,
    );
    ctx.fillText(
      `expression: ${Math.round(100 * expression[0][1])}% ${expression[0][0]}`,
      person.detection.box.x,
      person.detection.box.y - 42,
    );
    ctx.fillText(
      `age: ${Math.round(person.age)} years`,
      person.detection.box.x,
      person.detection.box.y - 24,
    );
    ctx.fillText(
      `roll:${person.angle.roll}° pitch:${person.angle.pitch}° yaw:${person.angle.yaw}°`,
      person.detection.box.x,
      person.detection.box.y - 6,
    );
    // draw face points for each face
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "lightblue";
    const pointSize = 2;
    for (let i = 0; i < person.landmarks.positions.length; i++) {
      ctx.beginPath();
      ctx.arc(
        person.landmarks.positions[i].x,
        person.landmarks.positions[i].y,
        pointSize,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    }
  }
}

let faceDetected = false; // Track if a face is detected
let faceLostTime = 0; // Timestamp of when the face was last lost
let faceLostDelay = 500; // Delay in milliseconds before considering the face truly gone (e.g., 2 seconds)

async function detectVideo(video, canvas) {
  if (!video || video.paused) return false;

  loadingScreen.style.display = "none";

  const t0 = performance.now();
  try {
    const result = await faceapi
      .detectAllFaces(video, optionsSSDMobileNet)
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender();

    const fps = 1000 / (performance.now() - t0);
    // drawFaces(canvas, result, fps.toLocaleString());

    let currentFaceDetected = result.length > 0; // Flag to track if face is detected in this frame

    // console.log(result[0]["gender"])
    // Check if the face detection state has changed (face appeared or disappeared)
    if (currentFaceDetected && !faceDetected) {
      // Face has just appeared
      faceDetected = true;
      console.log("Face found");
      faceFound(result[0]["gender"]);
    } else if (!currentFaceDetected && faceDetected) {
      // Face has just disappeared, but apply a delay before considering it truly gone
      if (faceLostTime === 0) {
        faceLostTime = Date.now(); // Mark the time when the face was last lost
      }

      // Check if the face has been missing long enough to consider it truly gone
      if (Date.now() - faceLostTime >= faceLostDelay) {
        faceDetected = false;
        faceLostTime = 0; // Reset the lost time
      }
    } else if (currentFaceDetected) {
      // If the face is detected again, reset the lost time
      faceLostTime = 0;
    }

    requestAnimationFrame(() => detectVideo(video, canvas));
    return true;
  } catch (err) {
    console.error(`Detect Error: ${str(err)}`);
    return false;
  }
}

// just initialize everything and call main function
async function setupCamera() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  if (!video || !canvas) return null;

  log("Setting up camera");
  // setup webcam. note that navigator.mediaDevices requires that page is accessed via https
  if (!navigator.mediaDevices) {
    log("Camera Error: access not supported");
    return null;
  }
  let stream;
  const constraints = {
    audio: false,
    video: { facingMode: "user", resizeMode: "crop-and-scale" },
  };
  if (window.innerWidth > window.innerHeight)
    constraints.video.width = { ideal: window.innerWidth };
  else constraints.video.height = { ideal: window.innerHeight };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === "PermissionDeniedError" || err.name === "NotAllowedError")
      log(`Camera Error: camera permission denied: ${err.message || err}`);
    if (err.name === "SourceUnavailableError")
      log(`Camera Error: camera not available: ${err.message || err}`);
    return null;
  }
  if (stream) {
    video.srcObject = stream;
  } else {
    log("Camera Error: stream empty");
    return null;
  }
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  if (settings.deviceId) delete settings.deviceId;
  if (settings.groupId) delete settings.groupId;
  if (settings.aspectRatio)
    settings.aspectRatio = Math.trunc(100 * settings.aspectRatio) / 100;
  log(`Camera active: ${track.label}`);
  log(`Camera settings: ${str(settings)}`);
  canvas.addEventListener("click", () => {
    if (video && video.readyState >= 2) {
      if (video.paused) {
        video.play();
        detectVideo(video, canvas);
      } else {
        video.pause();
      }
    }
    log(`Camera state: ${video.paused ? "paused" : "playing"}`);
  });
  return new Promise((resolve) => {
    video.onloadeddata = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.play();
      detectVideo(video, canvas);
      resolve(true);
    };
  });
}

async function setupFaceAPI() {
  // load face-api models
  // log('Models loading');
  // await faceapi.nets.tinyFaceDetector.load(modelPath); // using ssdMobilenetv1
  await faceapi.nets.ssdMobilenetv1.load(modelPath);
  await faceapi.nets.ageGenderNet.load(modelPath);
  await faceapi.nets.faceLandmark68Net.load(modelPath);
  await faceapi.nets.faceRecognitionNet.load(modelPath);
  await faceapi.nets.faceExpressionNet.load(modelPath);
  optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({
    minConfidence: minScore,
    maxResults,
  });
  // check tf engine state
  log(`Models loaded: ${str(faceapi.tf.engine().state.numTensors)} tensors`);
}

async function main() {
  // initialize tfjs
  log("FaceAPI WebCam Test");

  // if you want to use wasm backend location for wasm binaries must be specified
  // await faceapi.tf?.setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${faceapi.tf.version_core}/dist/`);
  // await faceapi.tf?.setBackend('wasm');
  // log(`WASM SIMD: ${await faceapi.tf?.env().getAsync('WASM_HAS_SIMD_SUPPORT')} Threads: ${await faceapi.tf?.env().getAsync('WASM_HAS_MULTITHREAD_SUPPORT') ? 'Multi' : 'Single'}`);

  // default is webgl backend
  await faceapi.tf.setBackend("webgl");
  await faceapi.tf.ready();

  // tfjs optimizations
  if (faceapi.tf?.env().flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY)
    faceapi.tf.env().set("CANVAS2D_WILL_READ_FREQUENTLY", true);
  if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV)
    faceapi.tf.env().set("WEBGL_EXP_CONV", true);
  if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV)
    faceapi.tf.env().set("WEBGL_EXP_CONV", true);

  // check version
  log(
    `Version: FaceAPI ${str(faceapi?.version || "(not loaded)")} TensorFlow/JS ${str(faceapi.tf?.version_core || "(not loaded)")} Backend: ${str(faceapi.tf?.getBackend() || "(not loaded)")}`,
  );

  await setupFaceAPI();
  await setupCamera();
}

// start processing as soon as page is loaded
window.onload = main;

let insultSaid;

function faceFound(gender) {
  const insults = {
    female: [
      "You're so skinny, you make a toothpick look fat.",
      "Your makeup looks like it was applied by a kindergartener.",
      "I've seen more attractive women on a 'before' picture in a weight loss ad.",
      "Your hair looks like it's been put through a blender.",
      "You have a face that's perfect for a 'Plain Jane' contest.",
      "Your fashion sense is so bad, it's like you got dressed in the dark.",
      "I've seen better-looking women at a bad 80s music video convention.",
      "Your lips are so thin, they look like they were drawn on with a pencil.",
      "You must have been born ugly, because you're definitely not going to grow out of it.",
      "Your skin is so pale, you must be a vampire.",
      "I'm not saying you're fat, but you have more rolls than a bakery.",
      "Your eyebrows are so thin, they look like they were drawn on with a fine-tip pen.",
      "You have a nose that's perfect for a proboscis monkey.",
      "I've seen more attractive women at a bad plastic surgery convention.",
      "Your eyes are so beady, they look like they belong on a snake.",
      "You must have a great personality, because your looks are definitely not going to get you a date.",
      "Your hair is so frizzy, it looks like you stuck your finger in a socket.",
      "I'm not saying you're ugly, but you make me want to look away.",
      "Your face is so round, it looks like you have a built-in moon.",
      "You have a face that's perfect for a 'most wanted' poster.",
      "Your lips are so big, they look like they belong on a fish.",
      "You must have been ugly as a child, because you're definitely not cute as an adult.",
      "Your skin is so dry, it looks like it's been sandblasted.",
      "I'm not saying you're fat, but you have more chins than a Chinese phone book.",
      "Your teeth are so yellow, they look like they've been stained by nicotine.",
      "You have a face that's perfect for a 'before' picture in a weight loss ad.",
      "Your eyebrows are so bushy, they look like they have their own ecosystem.",
      "I've seen more attractive women at a bad art museum.",
      "Your lips are so small, they look like they belong on a doll.",
      "You must have been born with a face that's perfect for a horror movie.",
      "Your hair is so messy, it looks like you just rolled out of bed.",
      "I'm not saying you're ugly, but you make me want to question the existence of a higher power.",
      "Your face is so flat, it looks like it was ironed.",
      "You have a nose that's so small, it looks like it's trying to hide.",
      "Your eyes are so close together, they look like they're trying to kiss.",
      "You must have a great sense of humor, because you're definitely not taking yourself seriously.",
      "Your hair is so thin, I can see your scalp from here.",
      "I'm not saying you're old, but you look like you've been around since the dawn of time.",
      "Your skin is so wrinkled, it looks like it's been put through a washing machine.",
      "You have a face that's perfect for a ' senior citizen' discount.",
      "Your lips are so thin, they look like they're trying to disappear.",
      "You must have been born with a face that's perfect for a 'before' picture in a plastic surgery ad.",
      "Your hair is so dull, it looks like it's been colored with mud.",
      "I'm not saying you're ugly, but you make me want to cry.",
      "Your face is so lopsided, it looks like it's been put together by a kindergartener.",
      "You have a nose that's so big, it has its own gravitational pull.",
      "Your eyes are so small, they look like they're trying to hide.",
      "You must have a great personality, because your looks are definitely not going to get you a job.",
      "Your hair is so messy, it looks like you just stuck your finger in a socket.",
      "I'm not saying you're fat, but you have more rolls than a sumo wrestler.",
      "Your skin is so oily, it looks like you're trying to fry an egg on your face.",
      "You have a face that's perfect for a 'greaser' convention.",
      "Your lips are so big, they look like they belong on a clown.",
      "You must have been born with a face that's perfect for a circus freak show.",
      "Your hair is so wild, it looks like it's been styled by a hurricane.",
      "I'm not saying you're ugly, but you make me want to run away.",
      "Your face is so round, it looks like it's been inflated like a balloon.",
      "You have a nose that's so small, it looks like it's trying to hide behind your lips.",
      "Your eyes are so beady, they look like they belong on a rat.",
      "You must have a great sense of humor, because you're definitely not taking yourself seriously.",
      "Your hair is so thin, I can see your scalp from here.",
      "I'm not saying you're old, but you look like you've been around since the dawn of time.",
      "Your skin is so wrinkled, it looks like it's been put through a washing machine.",
      "You have a face that's perfect for a 'senior citizen' discount.",
      "Your lips are so thin, they look like they're trying to disappear.",
      "You must have been born with a face that's perfect for a 'before' picture in a plastic surgery ad.",
      "Your hair is so dull, it looks like it's been colored with mud.",
      "I'm not saying you're ugly, but you make me want to cry.",
      "Your face is so lopsided, it looks like it's been put together by a kindergartener.",
      "You have a nose that's so big, it has its own gravitational pull.",
      "Your eyes are so small, they look like they're trying to hide.",
      "You must have a great personality, because your looks are definitely not going to get you a job.",
      "Your hair is so messy, it looks like you just stuck your finger in a socket.",
      "I'm not saying you're fat, but you have more rolls than a sumo wrestler.",
      "Your skin is so oily, it looks like you're trying to fry an egg on your face.",
      "You have a face that's perfect for a 'greaser' convention.",
      "Your lips are so big, they look like they belong on a clown.",
      "You must have been born with a face that's perfect for a circus freak show.",
      "Your hair is so wild, it looks like it's been styled by a hurricane.",
      "I'm not saying you're ugly, but you make me want to run away.",
      "Your face is so round, it looks like it's been inflated like a balloon.",
      "You have a nose that's so small, it looks like it's trying to hide behind your lips.",
      "Your eyes are so beady, they look like they belong on a rat.",
      "You must have a great sense of humor, because you're definitely not taking yourself seriously.",
      "Your hair is so thin, I can see your scalp from here.",
      "I'm not saying you're old, but you look like you've been around since the dawn of time.",
      "Your skin is so wrinkled, it looks like it's been put through a washing machine.",
      "You have a face that's perfect for a 'senior citizen' discount.",
      "Your lips are so thin, they look like they're trying to disappear.",
      "You must have been born with a face that's perfect for a 'before' picture in a plastic surgery ad.",
      "Your hair is so dull, it looks like it's been colored with mud.",
      "I'm not saying you're ugly, but you make me want to cry.",
      "Your face is so lopsided, it looks like it's been put together by a kindergartener.",
      "You have a nose that's so big, it has its own gravitational pull.",
      "Your eyes are so small, they look like they're trying to hide.",
      "You must have a great personality, because your looks are definitely not going to get you a job.",
      "Your hair is so messy, it looks like you just stuck your finger in a socket.",
      "I'm not saying you're fat, but you have more rolls than a sumo wrestler.",
      "Your skin is so oily, it looks like you're trying to fry an egg on your face.",
      "You have a face that's perfect for a 'greaser' convention.",
      "Your lips are so big, they look like they belong on a clown.",
      "You must have been born with a face that's perfect for a circus freak show.",
      "Your hair is so wild, it looks like it's been styled by a hurricane.",
      "I'm not saying you're ugly, but you make me want to run away.",
      "Your face is so round, it looks like it's been inflated like a balloon.",
      "You have a nose that's so small, it looks like it's trying to hide behind your lips.",
      "Your eyes are so beady, they look like they belong on a rat.",
      "You must have a great sense of humor, because you're definitely not taking yourself seriously.",
      "If ugliness was a crime you would be serving multiple life sentences.",
    ],
    male: [
      "You're so bald, you must be trying to start a solar panel farm on your head.",
      "Your beard looks like it was grown by a yeti.",
      "I've seen more attractive men on a 'before' picture in a weight loss ad.",
      "Your hair looks like it's been styled by a lawnmower.",
      "You have a face that's perfect for a 'tough guy' contest, but you're not fooling anyone.",
      "Your fashion sense is so bad, it's like you got dressed in the dark and then looked in a mirror and said 'yeah, this is fine'.",
      "I've seen better-looking men at a bad 80s music video convention.",
      "Your nose is so big, it has its own gravitational pull.",
      "You must have been born ugly, because you're definitely not going to grow out of it.",
      "Your skin is so oily, you must be a human oil slick.",
      "I'm not saying you're fat, but you have more belly rolls than a sumo wrestler.",
      "Your eyebrows are so bushy, they look like they have their own ecosystem.",
      "You have a face that's perfect for a 'most wanted' poster.",
      "Your eyes are so beady, they look like they belong on a snake.",
      "You must have a great personality, because your looks are definitely not going to get you a date.",
      "Your hair is so thin, I can see your scalp from here.",
      "I'm not saying you're ugly, but you make me want to look away.",
      "Your face is so round, it looks like you have a built-in moon.",
      "You have a face that's perfect for a ' Plain Jane' contest, but you're a man so that's not a thing.",
      "Your lips are so thin, they look like they were drawn on with a pencil.",
      "You must have been ugly as a child, because you're definitely not cute as an adult.",
      "Your skin is so dry, it looks like it's been sandblasted.",
      "I'm not saying you're fat, but you have more chins than a Chinese phone book.",
      "Your teeth are so yellow, they look like they've been stained by nicotine.",
      "You have a face that's perfect for a 'before' picture in a weight loss ad.",
      "Your eyebrows are so thin, they look like they were drawn on with a fine-tip pen.",
      "I've seen more attractive men at a bad art museum.",
      "Your lips are so small, they look like they belong on a doll.",
      "You must have been born with a face that's perfect for a horror movie.",
      "Your hair is so messy, it looks like you just rolled out of bed.",
      "I'm not saying you're ugly, but you make me want to question the existence of a higher power.",
      "Your face is so flat, it looks like it was ironed.",
      "You have a nose that's so small, it looks like it's trying to hide.",
      "Your eyes are so close together, they look like they're trying to kiss.",
      "You must have a great sense of humor, because you're definitely not taking yourself seriously.",
      "Your hair is so thin, I can see your scalp from here.",
      "I'm not saying you're old, but you look like you've been around since the dawn of time.",
      "Your skin is so wrinkled, it looks like it's been put through a washing machine.",
      "You have a face that's perfect for a 'senior citizen' discount.",
      "Your lips are so thin, they look like they're trying to disappear.",
      "You must have been born with a face that's perfect for a 'before' picture in a plastic surgery ad.",
      "Your hair is so dull, it looks like it's been colored with mud.",
      "I'm not saying you're ugly, but you make me want to cry.",
      "Your face is so lopsided, it looks like it's been put together by a kindergartener.",
      "You have a nose that's so big, it has its own gravitational pull.",
      "Your eyes are so small, they look like they're trying to hide.",
      "You must have a great personality, because your looks are definitely not going to get you a job.",
      "Your hair is so messy, it looks like you just stuck your finger in a socket.",
      "I'm not saying you're fat, but you have more rolls than a sumo wrestler.",
      "Your skin is so oily, it looks like you're trying to fry an egg on your face.",
      "You have a face that's perfect for a 'greaser' convention.",
      "Your lips are so big, they look like they belong on a clown.",
      "You must have been born with a face that's perfect for a circus freak show.",
      "Your hair is so wild, it looks like it's been styled by a hurricane.",
      "I'm not saying you're ugly, but you make me want to run away.",
      "Your face is so round, it looks like it's been inflated like a balloon.",
      "You have a nose that's so small, it looks like it's trying to hide behind your lips.",
      "Your eyes are so beady, they look like they belong on a rat.",
      "You must have a great sense of humor, because you're definitely not taking yourself seriously.",
      "Your hair is so thin, I can see your scalp from here.",
      "I'm not saying you're old, but you look like you've been around since the dawn of time.",
      "Your skin is so wrinkled, it looks like it's been put through a washing machine.",
      "You have a face that's perfect for a 'senior citizen' discount.",
      "Your lips are so thin, they look like they're trying to disappear.",
      "You must have been born with a face that's perfect for a 'before' picture in a plastic surgery ad.",
      "Your hair is so dull, it looks like it's been colored with mud.",
      "I'm not saying you're ugly, but you make me want to cry.",
      "Your face is so lopsided, it looks like it's been put together by a kindergartener.",
      "You have a nose that's so big, it has its own gravitational pull.",
      "Your eyes are so small, they look like they're trying to hide.",
      "You must have a great personality, because your looks are definitely not going to get you a job.",
      "Your hair is so messy, it looks like you just stuck your finger in a socket.",
      "I'm not saying you're fat, but you have more rolls than a sumo wrestler.",
      "Your skin is so oily, it looks like you're trying to fry an egg on your face.",
      "You have a face that's perfect for a 'greaser' convention.",
      "Your lips are so big, they look like they belong on a clown.",
      "You must have been born with a face that's perfect for a circus freak show.",
      "Your hair is so wild, it looks like it's been styled by a hurricane.",
      "I'm not saying you're ugly, but you make me want to run away.",
      "Your face is so round, it looks like it's been inflated like a balloon.",
      "You have a nose that's so small, it looks like it's trying to hide behind your lips.",
      "Your eyes are so beady, they look like they belong on a rat.",
      "You must have a great sense of humor, because you're definitely not taking yourself seriously.",
      "Your hair is so thin, I can see your scalp from here.",
      "I'm not saying you're old, but you look like you've been around since the dawn of time.",
      "Your skin is so wrinkled, it looks like it's been put through a washing machine.",
      "You have a face that's perfect for a 'senior citizen' discount.",
      "Your lips are so thin, they look like they're trying to disappear.",
      "You must have been born with a face that's perfect for a 'before' picture in a plastic surgery ad.",
      "Your hair is so dull, it looks like it's been colored with mud.",
      "I'm not saying you're ugly, but you make me want to cry.",
      "Your face is so lopsided, it looks like it's been put together by a kindergartener.",
      "You have a nose that's so big, it has its own gravitational pull.",
      "Your eyes are so small, they look like they're trying to hide.",
      "You must have a great personality, because your looks are definitely not going to get you a job.",
      "Your hair is so messy, it looks like you just stuck your finger in a socket.",
      "I'm not saying you're fat, but you have more rolls than a sumo wrestler.",
      "Your skin is so oily, it looks like you're trying to fry an egg on your face.",
      "You have a face that's perfect for a 'greaser' convention.",
      "Your lips are so big, they look like they belong on a clown.",
      "You must have been born with a face that's perfect for a circus freak show.",
      "Your hair is so wild, it looks like it's been styled by a hurricane.",
      "If ugliness was a crime you would be serving multiple life sentences.",
    ],
  };

  const randomInsult =
    insults[gender][Math.floor(Math.random() * insults[gender].length)];
  const insult = randomInsult;
  insultSaid = insult;

  fetch("https://api.nemesyslabs.com/api/v1/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer nm_sk_._3FT2JNJIQhGwQdB_c_ca8addd2e55a62e42e6db483", // Replace with your actual token
    },
    body: JSON.stringify({
      text: insult,
      voiceId: "Michael",
    }),
  })
    .then((response) => response.blob()) // Get the response as a blob
    .then((blob) => {
      const audioUrl = URL.createObjectURL(blob); // Create a URL for the blob
      const audio = new Audio(audioUrl); // Create an audio element with the URL
      audio.play(); // Play the audio

      setTimeout(() => {
        listenForUserInput();
      }, 3000)
    })
    .catch((error) => console.error("Error:", error));
}

// 1. Speak a system message using TTS API
function speakText(text) {
  fetch("https://api.nemesyslabs.com/api/v1/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer nm_sk_._3FT2JNJIQhGwQdB_c_ca8addd2e55a62e42e6db483", // Replace with your actual token
    },
    body: JSON.stringify({
      text: text,
      voiceId: "Michael",
    }),
  })
    .then((response) => response.blob())
    .then((blob) => {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => listenForUserInput();
    })
    .catch((error) => console.error("Error:", error));
}

// 2. Listen for user input using Speech Recognition
function listenForUserInput() {
    // Speech recognition is supported

    // Check for SpeechRecognition API (with possible vendor prefix for Chrome)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => console.log("Listening for user input...");
    recognition.onresult = (event) => {
      const userMessage = event.results[0][0].transcript;
      console.log("User said:", userMessage);

      // 3. Send user input to Cohere API for generating a response
      generateResponse(userMessage);
    };

    recognition.onerror = (event) =>
      console.error("Speech recognition error:", event);

    recognition.start();
}

// 3. Generate a response using Cohere API
function generateResponse(userMessage) {
  fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer 7ciaxvObjwRoJu8wW2jzg9S0f9pCpuXksaZrMCrj", // Replace with your actual API key
    },
    body: JSON.stringify({
      max_tokens: 50,
      model: "command-r",
      messages: [
        {
          role: "system",
          content:
            "You are snarky, annoying bot that just insulted the user. YOU MUST CONTINUE INSULTING THEM. ALWAYS ISSUE A REBUTTAL! KEEP YOUR RESPONSE SHORT. You just told them: " +
            insultSaid,
        },
        { role: "user", content: userMessage },
      ],
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      const botMessage = data.message.content[0].text;
      console.log("Bot response:", botMessage);

      // 4. Speak the bot's response using TTS API
      speakText(botMessage);

    })
    .catch((error) => console.error("Error:", error));
}
