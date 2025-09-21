let recognition, mediaRecorder, audioChunks = [];
const transcriptDiv = document.getElementById("transcript");
const downloadLink = document.getElementById("downloadLink");
const gainSlider = document.getElementById("gainSlider");

let audioCtx, source, analyser, gainNode;

// === 音声認識 ===
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
  transcriptDiv.textContent = "⚠️ Web Speech API非対応ブラウザです。";
}

// === 録音開始 ===
document.getElementById("startBtn").onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  // AudioContextでマイク感度調整
  audioCtx = new AudioContext();
  source = audioCtx.createMediaStreamSource(stream);
  gainNode = audioCtx.createGain();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;

  source.connect(gainNode);
  gainNode.connect(analyser);
  gainNode.connect(audioCtx.destination); // ←自分に返す場合（モニタリング）

  // MediaRecorderセット
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // MP3に変換
    const mp3Blob = encodeMp3(audioBuffer);
    const url = URL.createObjectURL(mp3Blob);

    downloadLink.href = url;
    downloadLink.download = "recording.mp3";
    downloadLink.style.display = "block";
    downloadLink.textContent = "録音ダウンロード (MP3)";
  };

  mediaRecorder.start();
  recognition.start();

  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;

  startVisualizer();
};

// === 録音停止 ===
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

// === マイク感度スライダー ===
gainSlider.oninput = () => {
  if (gainNode) gainNode.gain.value = parseFloat(gainSlider.value);
};

// === MP3エンコード (lamejs利用) ===
function encodeMp3(audioBuffer) {
  const samples = audioBuffer.getChannelData(0);
  const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
  let mp3Data = [];
  const blockSize = 1152;

  for (let i = 0; i < samples.length; i += blockSize) {
    const sampleChunk = samples.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  const end = mp3encoder.flush();
  if (end.length > 0) mp3Data.push(end);

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

// === ビジュアライザー ===
function startVisualizer() {
  const visualizer = document.getElementById("visualizer");
  visualizer.innerHTML = "";
  for (let i = 0; i < 30; i++) {
    const bar = document.createElement("div");
    bar.className = "bar";
    visualizer.appendChild(bar);
  }
  const bars = document.getElementsByClassName("bar");

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
