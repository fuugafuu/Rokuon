let recognition, mediaRecorder, audioChunks = [];
const transcriptDiv = document.getElementById("transcript");
const downloadLink = document.getElementById("downloadLink");

// === 音声認識 (Web Speech API) ===
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onresult = (event) => {
    let text = "";
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript + " ";
    }
    transcriptDiv.textContent = text;
  };
} else {
  transcriptDiv.textContent = "⚠️ このブラウザはWeb Speech APIに対応していません。";
}

// === 録音 (MediaRecorder API) ===
document.getElementById("startBtn").onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(audioBlob);
    downloadLink.href = url;
    downloadLink.download = "recording.webm";
    downloadLink.style.display = "block";
    downloadLink.textContent = "録音ダウンロード";
  };

  mediaRecorder.start();
  recognition.start();

  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;

  startVisualizer(stream);
};

document.getElementById("stopBtn").onclick = () => {
  mediaRecorder.stop();
  recognition.stop();
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
};

// === コピー機能 ===
document.getElementById("copyBtn").onclick = () => {
  navigator.clipboard.writeText(transcriptDiv.textContent);
  alert("コピーしました！");
};

// === ビジュアライザー (30本) ===
function startVisualizer(stream) {
  const visualizer = document.getElementById("visualizer");
  visualizer.innerHTML = "";
  for (let i = 0; i < 30; i++) { // ← スマホ向け軽量化
    const bar = document.createElement("div");
    bar.className = "bar";
    visualizer.appendChild(bar);
  }
  const bars = document.getElementsByClassName("bar");

  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64; // 軽量化
  source.connect(analyser);

  function draw() {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    for (let i = 0; i < bars.length; i++) {
      bars[i].style.height = (dataArray[i] / 1.5) + "px";
      bars[i].style.background = `hsl(${dataArray[i]*3}, 100%, 50%)`;
    }
    requestAnimationFrame(draw);
  }
  draw();
}
