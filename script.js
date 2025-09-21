const video = document.getElementById('camera');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const counter = document.getElementById('counter');
const switchBtn = document.getElementById('switch');

let model, faceMesh;
let detections = [];
let useFront = false;  // false = 背面カメラ（デフォルト）

async function setupCamera() {
  const constraints = {
    video: { facingMode: useFront ? "user" : { exact: "environment" } }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await new Promise(resolve => video.onloadedmetadata = resolve);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  } catch (err) {
    console.error("カメラ起動エラー:", err);
  }
}

function initFaceMesh() {
  faceMesh = new FaceMesh.FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({
    maxNumFaces: 10,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  faceMesh.onResults(results => {
    detections = results.multiFaceLandmarks || [];
  });
}

function calcEyeOpen(landmarks) {
  const top = landmarks[159].y;
  const bottom = landmarks[145].y;
  return (bottom - top) > 0.02 ? "目:開" : "目:閉";
}

function calcMouthOpen(landmarks) {
  const top = landmarks[13].y;
  const bottom = landmarks[14].y;
  return (bottom - top) > 0.03 ? "口:開" : "口:閉";
}

async function detect() {
  const predictions = await model.estimateFaces(video, false);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  predictions.forEach((p, i) => {
    const [x, y, w, h] = [
      p.topLeft[0],
      p.topLeft[1],
      p.bottomRight[0] - p.topLeft[0],
      p.bottomRight[1] - p.topLeft[1]
    ];

    const distance = Math.round(5000 / w);
    const isClose = distance < 100;

    ctx.strokeStyle = isClose ? "red" : "#00ffcc";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    let eyeStatus = "", mouthStatus = "";
    if (detections[i]) {
      eyeStatus = calcEyeOpen(detections[i]);
      mouthStatus = calcMouthOpen(detections[i]);
    }

    ctx.fillStyle = isClose ? "red" : "white";
    ctx.font = "16px sans-serif";
    ctx.fillText(
      `${i+1}人目: ${distance}cm ${isClose ? "接近中" : ""} ${eyeStatus} ${mouthStatus}`,
      x, y > 20 ? y - 5 : y + 15
    );
  });

  counter.textContent = `人数: ${predictions.length}`;
  requestAnimationFrame(detect);
}

(async () => {
  await setupCamera();
  model = await blazeface.load();
  initFaceMesh();

  const cameraM = new Camera(video, {
    onFrame: async () => { await faceMesh.send({image: video}); },
    width: 640,
    height: 480
  });
  cameraM.start();

  detect();
})();

// カメラ切替ボタン
switchBtn.addEventListener("click", async () => {
  useFront = !useFront;
  await setupCamera();
});
